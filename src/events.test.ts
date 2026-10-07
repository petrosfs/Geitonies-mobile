import { describe, expect, it } from 'vitest';
import { apply, newGame } from './game/engine';
import type { Game, Rules } from './game/types';
import { boardEvents, turnCard } from './events';

/* Which landings get an animation card, checked against real moves of the rules engine. */

function rand(st: { rng: number }): number {
  let t = (st.rng = (st.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function seedFor(a: number, b: number): number {
  for (let r = 1; r < 5_000_000; r++) {
    const st = { rng: r };
    if (1 + Math.floor(rand(st) * 6) === a && 1 + Math.floor(rand(st) * 6) === b) return r;
  }
  throw new Error('no seed');
}
function mk(rules: Partial<Rules> = {}): Game {
  const g = newGame({
    boardId: 'classic', names: [], customCards: [],
    players: [0, 1].map((i) => ({ id: 'p' + i, name: 'P' + i, color: '#000', emoji: '🎩', device: 'd' })),
    rules: { auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 60, ...rules },
  }, 7, 0);
  g.cur = 0;
  return g;
}
/** roll the given dice for the current player; return the new state and the history lines it added */
function roll(g: Game, a: number, b: number) {
  const c = structuredClone(g);
  c.rng = seedFor(a, b);
  const before = c.logSeq ?? 0;
  const h = apply(c, 'p0', { t: 'roll' }, 0);
  return { h, recent: h.log.slice(h.log.length - ((h.logSeq ?? 0) - before)) };
}

describe('event cards', () => {
  it('tax', () => {
    const g = mk(); g.players[0].pos = 1;
    const { h, recent } = roll(g, 1, 2);                // 1 -> 4: income tax
    expect(boardEvents(h, recent)).toEqual([{ kind: 'tax', p: 'p0', n: 200, sq: 4 }]);
  });
  it('landing exactly on Start, with the salary; passing Start gives no card', () => {
    const g = mk(); g.players[0].pos = 36;
    const { h, recent } = roll(g, 1, 3);                // 36 -> 0
    expect(boardEvents(h, recent)).toEqual([{ kind: 'go', p: 'p0', n: 200, sq: 0 }]);
    const k = mk(); k.players[0].pos = 38;
    const r2 = roll(k, 1, 3);                           // 38 -> 2, passes Start
    expect(boardEvents(r2.h, r2.recent).filter((e) => e.kind === 'go')).toEqual([]);
  });
  it('Free Parking: with the pot, and with nothing to collect', () => {
    const g = mk({ freeParking: true }); g.players[0].pos = 17; g.pot = 350;
    const { h, recent } = roll(g, 1, 2);                // 17 -> 20
    expect(boardEvents(h, recent)).toEqual([{ kind: 'parking', p: 'p0', n: 350, sq: 20 }]);
    const k = mk(); k.players[0].pos = 17;
    const r2 = roll(k, 1, 2);
    expect(boardEvents(r2.h, r2.recent)).toEqual([{ kind: 'parking', p: 'p0', n: 0, sq: 20 }]);
  });
  it('rent', () => {
    const g = mk(); g.props[3].owner = 'p1';
    const { h, recent } = roll(g, 1, 2);                // 0 -> 3
    expect(boardEvents(h, recent)).toEqual([{ kind: 'rent', p: 'p0', o: 'p1', n: 4, sq: 3 }]);
  });
});

describe('cards for everyone', () => {
  it('the card being drawn, then the one drawn this turn; the history says what it was', async () => {
    let g = mk();
    const card = g.cards.find((c) => c.fx.t === 'jail')!;
    g.q = [{ k: 'card', card: card.id, who: 'p0' }];
    expect(turnCard(g)?.card.id).toBe(card.id);
    g = apply(g, 'p0', { t: 'cardOk' }, 0);
    expect(turnCard(g)).toMatchObject({ who: 'p0', card: { id: card.id } });
    const line = g.log.find((e) => e.k === 'card')!;
    // the history line names the deck and the card (ui.ts needs a page, so a tiny stand-in)
    (globalThis as unknown as { document: unknown }).document ??= { createElement: () => ({ getContext: () => null }), addEventListener: () => {}, visibilityState: 'visible' };
    (globalThis as unknown as { window: unknown }).window ??= globalThis;
    (globalThis as unknown as { localStorage: unknown }).localStorage ??= { getItem: () => null, setItem: () => {} };
    const { logText } = await import('./ui');
    expect(logText(g, line, 'el')).toMatch(/^P0 τράβηξε (Ευκαιρία|Κοινοτικό Ταμείο): «.+»$/);
    g = apply(g, 'p0', { t: 'endTurn' }, 0);
    expect(turnCard(g)).toBeNull();                     // next turn: gone
  });
});
