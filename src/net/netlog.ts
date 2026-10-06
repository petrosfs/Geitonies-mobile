/*
 * A small diary of what the network did (last 300 events), shown in the ✕ menu
 * under "Report a problem" so a player can copy it and send it.
 */

export interface NetEvent { t: number; ev: string; detail: string }

const MAX = 300;
const events: NetEvent[] = [];

export function netlog(ev: string, detail = ''): void {
  events.push({ t: Date.now(), ev, detail: detail.slice(0, 300) });
  if (events.length > MAX) events.splice(0, events.length - MAX);
}

export function netEvents(): NetEvent[] {
  return events.slice();
}

export function netReport(header: Record<string, unknown>): string {
  const time = (t: number) => new Date(t).toISOString().slice(11, 23);
  return [
    '--- Geitonies report ---',
    ...Object.entries(header).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`),
    '--- events ---',
    ...events.map((e) => `${time(e.t)} ${e.ev}${e.detail ? ' ' + e.detail : ''}`),
  ].join('\n');
}
