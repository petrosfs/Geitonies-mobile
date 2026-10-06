import type { DataConnection } from 'peerjs';
import { netlog } from './netlog';

/*
 * PeerJS's JSON data channel silently refuses any message of 16 300 bytes or more
 * ("Message too big for JSON channel"). Game states grow past that during a game, so big
 * messages are split into parts here and put back together on the other side.
 */

/** messages below this many bytes go as they are */
const LIMIT = 14_000;
/** characters per part: at most 3 bytes each in UTF-8, so a part stays well under the limit */
const PART_CHARS = 4_000;

interface Part { type: 'part'; id: string; i: number; n: number; s: string }

let seq = 0;
const enc = new TextEncoder();

/** send any message, splitting it if it is too big for the channel */
export function sendFramed<M extends { type: string }>(conn: DataConnection | null | undefined, m: M): void {
  if (!conn || !conn.open) return;
  const text = JSON.stringify(m);
  const bytes = enc.encode(text).length;
  if (bytes < LIMIT) { conn.send(m); return; }
  const id = Date.now().toString(36) + '-' + (seq++).toString(36);
  const n = Math.ceil(text.length / PART_CHARS);
  netlog('send-split', `${m.type} ${Math.round(bytes / 1024)} KB in ${n} parts`);
  for (let i = 0; i < n; i++) {
    conn.send({ type: 'part', id, i, n, s: text.slice(i * PART_CHARS, (i + 1) * PART_CHARS) } satisfies Part);
  }
}

/** wrap a message handler so split messages arrive whole */
export function receiveFramed<T>(onMsg: (m: T) => void): (raw: unknown) => void {
  const pending = new Map<string, { parts: string[]; got: number; n: number; at: number }>();
  return (raw: unknown) => {
    const m = raw as Part;
    if (!m || m.type !== 'part') { onMsg(raw as T); return; }
    let p = pending.get(m.id);
    if (!p) {
      p = { parts: new Array(m.n), got: 0, n: m.n, at: Date.now() };
      pending.set(m.id, p);
      // forget unfinished messages after a minute
      for (const [k, v] of pending) if (Date.now() - v.at > 60_000) pending.delete(k);
    }
    if (p.parts[m.i] === undefined) { p.parts[m.i] = m.s; p.got++; }
    if (p.got < p.n) return;
    pending.delete(m.id);
    try {
      onMsg(JSON.parse(p.parts.join('')) as T);
    } catch (e) {
      netlog('recv-bad', `could not join ${p.n} parts: ${String(e)}`);
    }
  };
}
