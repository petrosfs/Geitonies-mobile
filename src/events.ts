import { board } from './game/engine';
import type { Card, Game } from './game/types';

export type BoardEvent = { kind: 'rent' | 'tax' | 'go' | 'parking'; p: string; o?: string; n: number; sq: number };

/** what happened on the board in these new history lines, worth a card on screen */
export function boardEvents(g: Game, recent: Game['log']): BoardEvent[] {
  const b = board(g);
  const out: BoardEvent[] = [];
  recent.forEach((e, i) => {
    const a = e.a ?? {};
    const p = String(a.p ?? '');
    if (e.k === 'rent' && Number(a.n) > 0) out.push({ kind: 'rent', p, o: String(a.o), n: Number(a.n), sq: Number(a.sq) });
    if (e.k === 'tax') out.push({ kind: 'tax', p, n: Number(a.n), sq: g.players.find((x) => x.id === p)?.pos ?? 0 });
    if (e.k === 'moved') {
      const sq = Number(a.sq);
      const kind = b.squares[sq]?.kind;
      // money that came with this landing: the salary is written just before the move, the Parking pot after it
      const prev = recent[i - 1];
      const later = recent.slice(i + 1).find((x) => x.k === 'pot' && String(x.a?.p) === p);
      if (kind === 'go') out.push({ kind: 'go', p, n: prev?.k === 'salary' && String(prev.a?.p) === p ? Number(prev.a?.n) : 0, sq });
      if (kind === 'parking') out.push({ kind: 'parking', p, n: later ? Number(later.a?.n) : 0, sq });
    }
  });
  return out;
}


/**
 * The card of the current turn, for everyone to see: the one being drawn right now,
 * or the last one drawn since the turn began.
 */
export function turnCard(g: Game): { who: string; card: Card } | null {
  const head = g.q[0];
  if (head?.k === 'card') return { who: head.who, card: g.cards[head.card] };
  for (let i = g.log.length - 1; i >= 0; i--) {
    const e = g.log[i];
    if (e.k === 'turn' || e.k === 'starts') break;
    if (e.k === 'card' && g.cards[Number(e.a?.c)]) return { who: String(e.a?.p), card: g.cards[Number(e.a?.c)] };
  }
  return null;
}
