import { describe, expect, it } from 'vitest';
import { apply, autoAction, bankStock, newGame, ownedBy, RuleError, waiting } from './engine';
import type { Action, BoardId, Game, Rules, Setup } from './types';

function setup(n: number, boardId: BoardId, rules: Partial<Rules> = {}): Setup {
  return {
    boardId,
    names: [],
    customCards: [
      { deck: 'chance', text: 'Custom gain', fx: { t: 'money', amount: 77 } },
      { deck: 'chest', text: 'Custom pay each', fx: { t: 'each', amount: -20 } },
    ],
    players: Array.from({ length: n }, (_, i) => ({
      id: 'p' + i, name: 'P' + i, color: '#000', emoji: '🙂', device: 'd' + (i % 3),
    })),
    rules: {
      auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false,
      buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 30, ...rules,
    },
  };
}

function rnd(seed: number) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

function check(g: Game) {
  for (const p of g.players) if (!p.out) expect(p.cash).toBeGreaterThanOrEqual(0);
  const st = bankStock(g);
  expect(st.houses).toBeGreaterThanOrEqual(0);
  expect(st.hotels).toBeGreaterThanOrEqual(0);
  for (const k of Object.keys(g.props)) {
    const o = g.props[Number(k)].owner;
    if (o) expect(g.players.find((p) => p.id === o)!.out).toBe(false);
  }
}

function play(seed: number, n: number, boardId: BoardId, rules: Partial<Rules>) {
  const r = rnd(seed);
  let g = newGame(setup(n, boardId, rules), seed, 0);
  let t = 0;
  for (let step = 0; step < 6000 && !g.over; step++) {
    t += 1000;
    const w = waiting(g);
    expect(w.length).toBeGreaterThan(0);
    const id = w[Math.floor(r() * w.length)];
    let act: Action | null = autoAction(g, id);
    const h = g.q[0];
    // make it more interesting than the auto player
    if (h?.k === 'buy' && r() < 0.8) act = { t: 'buy' };
    if (h?.k === 'auction' && g.rules.auction === 'open' && r() < 0.5) act = { t: 'bid', amount: h.high + 1 + Math.floor(r() * 40) };
    if (h?.k === 'auction' && g.rules.auction === 'sealed') act = { t: 'sealed', amount: Math.floor(r() * 150) };
    if (!h && !g.trade && r() < 0.3) {
      const mine = ownedBy(g, id);
      if (mine.length) act = { t: r() < 0.7 ? 'build' : 'unmortgage', sq: mine[Math.floor(r() * mine.length)] };
    }
    if (!h && !g.trade && r() < 0.05) {
      const others = g.players.filter((p) => !p.out && p.id !== id);
      if (others.length) {
        const o = others[0];
        act = { t: 'propose', trade: { from: id, to: o.id, give: { cash: 10, props: ownedBy(g, id).slice(0, 1), cards: 0 }, get: { cash: 0, props: ownedBy(g, o.id).slice(0, 1), cards: 0 } } };
      }
    }
    if (g.trade && r() < 0.5) act = { t: 'accept' };
    if (r() < 0.002) act = { t: 'kick', id };
    if (!act) throw new Error('no action for ' + id);
    try {
      g = apply(g, act.t === 'kick' ? 'host' : id, act, t);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      g = apply(g, id, autoAction(g, id)!, t); // fall back to the automatic move
    }
    check(g);
  }
  return g;
}

describe('engine', () => {
  it('plays many random games without breaking invariants', () => {
    let finished = 0;
    for (let s = 1; s <= 60; s++) {
      const boardId: BoardId = s % 2 ? 'classic' : 'large';
      const g = play(s, 2 + (s % 9), boardId, {
        auction: s % 3 ? 'open' : 'sealed',
        freeParking: s % 4 === 0, doubleGo: s % 5 === 0,
        noRentInJail: s % 6 === 0, buyAfterLap: s % 7 === 0,
        timeLimitMin: s % 8 === 0 ? 30 : 0,
      });
      if (g.over) finished++;
    }
    console.log('finished games:', finished, '/ 60');
    expect(finished).toBeGreaterThan(10);
  }, 300000);

  it('plays random games with every upset rule on without breaking invariants', () => {
    let finished = 0;
    for (let s = 101; s <= 120; s++) {
      const boardId: BoardId = s % 2 ? 'classic' : 'large';
      const g = play(s, 2 + (s % 5), boardId, {
        auction: 'open', freeParking: s % 2 === 0,
        wealthTax: { every: 2 + (s % 3), pct: 5 + (s % 4) * 5, who: s % 2 ? 'leader' : 'above' },
        underdog: true,
        crisis: { every: 3, house: 25, hotel: 100 },
        quake: { every: 4 },
        custom: [
          { text: 'a', when: { t: 'land', sq: 10 }, who: 'leader', what: { t: 'pct', pct: 5 } },
          { text: 'b', when: { t: 'go' }, who: 'last', what: { t: 'money', amount: 100 } },
          { text: 'c', when: { t: 'rounds', n: 5 }, who: 'all', what: { t: 'loseHouse' } },
          { text: 'd', when: { t: 'land', sq: 7 }, who: 'self', what: { t: 'jail' } },
          { text: 'e', when: { t: 'rounds', n: 6 }, who: 'self', what: { t: 'repairs', house: 40, hotel: 115 } },
        ],
      });
      if (g.over) finished++;
    }
    console.log('finished games with upsets:', finished, '/ 20');
    expect(finished).toBeGreaterThan(3);
  }, 300000);

  it('boards have the planned sizes', () => {
    const c = newGame(setup(2, 'classic'), 1, 0);
    const l = newGame(setup(8, 'large'), 1, 0);
    expect(c.names.length).toBe(40);
    expect(l.names.length).toBe(56);
    expect(c.players[0].cash).toBe(1500);
    expect(l.players[0].cash).toBe(2000);
  });
});
