import { describe, expect, it } from 'vitest';
import type { DataConnection } from 'peerjs';
import { receiveFramed, sendFramed } from './frame';

/** a fake connection that, like PeerJS's JSON channel, refuses messages of 16 300 bytes or more */
function pipe(onMsg: (m: unknown) => void) {
  const recv = receiveFramed(onMsg);
  const sent: number[] = [];
  const conn = {
    open: true,
    send(m: unknown) {
      const bytes = new TextEncoder().encode(JSON.stringify(m)).length;
      if (bytes >= 16300) throw new Error('Message too big for JSON channel');
      sent.push(bytes);
      recv(JSON.parse(JSON.stringify(m)));
    },
  } as unknown as DataConnection;
  return { conn, sent };
}

describe('splitting big messages', () => {
  it('small messages go as they are', () => {
    const got: unknown[] = [];
    const { conn, sent } = pipe((m) => got.push(m));
    sendFramed(conn, { type: 'chat', text: 'γεια σου 👋' });
    expect(got).toEqual([{ type: 'chat', text: 'γεια σου 👋' }]);
    expect(sent.length).toBe(1);
  });

  it('a big game state (Greek text and emoji) arrives whole and identical', () => {
    const got: unknown[] = [];
    const { conn, sent } = pipe((m) => got.push(m));
    const state = {
      type: 'state',
      game: { log: Array.from({ length: 900 }, (_, i) => ({ k: 'rent', a: { p: 'Νίκος 🚗', n: i, sq: 'Κολωνάκι 🏠' } })) },
    };
    expect(new TextEncoder().encode(JSON.stringify(state)).length).toBeGreaterThan(50_000);
    sendFramed(conn, state);
    expect(sent.length).toBeGreaterThan(3);
    expect(Math.max(...sent)).toBeLessThan(16_300);
    expect(got).toEqual([state]);
  });

  it('messages keep their order around a split one', () => {
    const got: string[] = [];
    const { conn } = pipe((m) => got.push((m as { type: string }).type));
    sendFramed(conn, { type: 'a' });
    sendFramed(conn, { type: 'big', s: 'x'.repeat(40_000) });
    sendFramed(conn, { type: 'c' });
    expect(got).toEqual(['a', 'big', 'c']);
  });
});
