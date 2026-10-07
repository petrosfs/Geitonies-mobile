import { describe, expect, it } from 'vitest';
import { apply, newGame } from './engine';
import { cleanHouseRules, firesAt } from './houserules';
import { BOARDS } from './boards';
import { boardEvents } from '../events';
import type { Action, Game, Rules } from './types';

/* Upset rules: wealth tax, underdog salary, market crisis, earthquake, and rules the players made up. */

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

function mk(n: number, rules: Partial<Rules>, cash?: number[]): Game {
  const g = newGame({
    boardId: 'classic', names: [], customCards: [],
    players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: '#000', emoji: '🎩', device: 'd' })),
    rules: { auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 60, ...rules },
  }, 7, 0);
  g.cur = 0; g.startIdx = 0;
  g.players.forEach((p, i) => { p.lapped = true; if (cash) p.cash = cash[i]; });
  return g;
}
const act = (g: Game, by: string, a: Action) => apply(g, by, a, 0);
function endTurn(g: Game): Game {
  const c = structuredClone(g);
  c.rolled = true; c.again = false;
  return act(c, c.players[c.cur].id, { t: 'endTurn' });
}
/** play turns without moving until the next round starts */
function nextRound(g: Game): Game {
  const r = g.round;
  while (g.round === r) g = endTurn(g);
  return g;
}
function roll(g: Game, a: number, b: number): Game {
  const c = structuredClone(g);
  c.rng = seedFor(a, b);
  return act(c, c.players[c.cur].id, { t: 'roll' });
}
const cash = (g: Game) => g.players.map((p) => p.cash);
const keys = (g: Game) => g.log.map((e) => e.k);

describe('upset rules', () => {
  it('fires every N rounds, from round N+1', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 11].filter((r) => firesAt(r, 5))).toEqual([6, 11]);
    expect([1, 2, 3].filter((r) => firesAt(r, 1))).toEqual([2, 3]);
  });

  it('wealth tax on the leader only, into the Parking pot', () => {
    let g = mk(3, { freeParking: true, wealthTax: { every: 1, pct: 10, who: 'leader' } }, [3000, 2000, 1000]);
    g = nextRound(g);
    expect(cash(g)).toEqual([2700, 2000, 1000]);
    expect(g.pot).toBe(300);
    expect(keys(g)).toContain('wealthTax');
  });

  it('wealth tax on everyone above the average, to the bank without Free Parking', () => {
    let g = mk(3, { wealthTax: { every: 1, pct: 20, who: 'above' } }, [2000, 2000, 1000]);
    g = nextRound(g);
    expect(cash(g)).toEqual([1600, 1600, 1000]);
    expect(g.pot).toBe(0);
  });

  it('wealth tax counts property too, and waits for its round', () => {
    let g = mk(2, { wealthTax: { every: 2, pct: 10, who: 'leader' } }, [1000, 1500]);
    g.props[39].owner = 'p0'; // 400 €
    g.props[37].owner = 'p0'; // 350 €
    g = nextRound(g);
    expect(cash(g)).toEqual([1000, 1500]); // round 2: not yet
    g = nextRound(g);
    expect(cash(g)).toEqual([1000 - 180, 1500]); // round 3: 10 % of 1750, rounded to 10 €
  });

  it('underdog: the poorest player gets double salary', () => {
    let g = mk(2, { underdog: true }, [100, 1500]);
    g.players[0].pos = 38;
    g = roll(g, 1, 2); // passes Start
    expect(g.players[0].cash).toBe(100 + 400);
    expect(keys(g)).toContain('underdog');
    // the richer one gets the normal salary
    let h = mk(2, { underdog: true }, [2000, 1500]);
    h.players[0].pos = 38;
    h = roll(h, 1, 2);
    expect(h.players[0].cash).toBe(2200);
  });

  it('market crisis: everyone pays per house and per hotel', () => {
    let g = mk(2, { crisis: { every: 1, house: 25, hotel: 100 } }, [1500, 1500]);
    for (const sq of [1, 3]) { g.props[sq].owner = 'p0'; g.props[sq].houses = 2; }
    for (const sq of [6, 8, 9]) { g.props[sq].owner = 'p1'; g.props[sq].houses = 5; }
    g = nextRound(g);
    expect(cash(g)).toEqual([1500 - 100, 1500 - 300]);
    expect(keys(g)).toContain('crisis');
  });

  it('earthquake: one group with buildings loses a house per street, half the price back', () => {
    let g = mk(2, { quake: { every: 1 } }, [1500, 1500]);
    g.props[1].owner = 'p0'; g.props[1].houses = 3;
    g.props[3].owner = 'p0'; g.props[3].houses = 5;
    g = nextRound(g);
    expect(g.props[1].houses).toBe(2);
    expect(g.props[3].houses).toBe(4);
    expect(g.players[0].cash).toBe(1500 + 25 + 25);
    expect(keys(g)).toContain('quake');
    // no buildings anywhere: nothing happens
    let h = mk(2, { quake: { every: 1 } });
    h = nextRound(h);
    expect(keys(h)).toContain('quakeNone');
  });

  it('custom rule: landing on a square makes the leader pay', () => {
    let g = mk(2, { custom: [{ text: 'Visit', when: { t: 'land', sq: 10 }, who: 'leader', what: { t: 'money', amount: -100 } }] }, [1500, 1600]);
    g.players[0].pos = 7;
    g = roll(g, 1, 2);
    expect(g.players[0].pos).toBe(10);
    expect(cash(g)).toEqual([1500, 1500]);
    expect(keys(g)).toContain('rule');
  });

  it('custom rule: passing Start sends you to jail (and you do not land anywhere)', () => {
    let g = mk(2, { custom: [{ text: '', when: { t: 'go' }, who: 'self', what: { t: 'jail' } }] });
    g.players[0].pos = 38;
    g = roll(g, 1, 2);
    expect(g.players[0].jail).toBe(true);
    expect(g.players[0].pos).toBe(10);
    expect(g.q).toEqual([]);
  });

  it('custom rule every N rounds: the last player gets money; another loses a house', () => {
    let g = mk(2, {
      custom: [
        { text: 'Help', when: { t: 'rounds', n: 1 }, who: 'last', what: { t: 'money', amount: 300 } },
        { text: 'Storm', when: { t: 'rounds', n: 1 }, who: 'leader', what: { t: 'loseHouse' } },
      ],
    }, [1000, 1500]);
    g.props[39].owner = 'p1'; g.props[39].houses = 2;
    g = nextRound(g);
    expect(g.players[0].cash).toBe(1300);
    expect(g.props[39].houses).toBe(1);
    expect(g.players[1].cash).toBe(1500 + 100); // half of 200 €
  });

  it('custom rule: pay a share of your net worth; a debt if you cannot pay', () => {
    let g = mk(2, { custom: [{ text: '', when: { t: 'rounds', n: 1 }, who: 'all', what: { t: 'pct', pct: 50 } }] }, [1000, 0]);
    g.props[39].owner = 'p1'; // worth 400, pays 200 with no cash
    g = nextRound(g);
    expect(g.players[0].cash).toBe(500);
    expect(g.q[0]).toMatchObject({ k: 'debt', who: 'p1' });
  });

  it('everyone gets a banner: wealth tax, crisis, earthquake, a custom rule; Start still shows its salary', () => {
    let g = mk(2, {
      wealthTax: { every: 1, pct: 10, who: 'leader' }, crisis: { every: 1, house: 25, hotel: 100 }, quake: { every: 1 },
      custom: [{ text: 'Bonus', when: { t: 'go' }, who: 'self', what: { t: 'money', amount: 50 } }],
    }, [2000, 1500]);
    const before = g.log.length;
    g = nextRound(g);
    const ev = boardEvents(g, g.log.slice(before));
    expect(ev.map((e) => e.kind)).toEqual(['wealth', 'crisis', 'quake']);
    expect(ev[0]).toMatchObject({ p: 'p0', n: 200 });
    g.players[g.cur].pos = 38;
    const at = g.log.length;
    g = roll(g, 1, 2); // passes Start: rule lines come between the salary and the move
    const ev2 = boardEvents(g, g.log.slice(at));
    expect(ev2.find((e) => e.kind === 'rule')).toMatchObject({ r: 0 });
    g.players[g.cur].pos = 38;
    const at2 = g.log.length;
    g.rolled = false; g.again = false; g.q = [];
    g = roll(g, 1, 1); // lands on Start
    expect(boardEvents(g, g.log.slice(at2)).find((e) => e.kind === 'go')?.n).toBe(200);
  });

  it('cleaning: limits, defaults and broken custom rules dropped', () => {
    const b = BOARDS.classic;
    const r = cleanHouseRules({
      auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 60,
      wealthTax: { every: 0, pct: 99, who: 'x' as 'leader' },
      crisis: { every: 3, house: 27, hotel: -5 },
      custom: [
        { text: 'x'.repeat(200), when: { t: 'land', sq: 99 }, who: 'all', what: { t: 'jail' } },
        { text: 'ok', when: { t: 'go' }, who: 'nobody' as 'all', what: { t: 'money', amount: 33 } },
        { text: 'zero', when: { t: 'go' }, who: 'all', what: { t: 'money', amount: 0 } },
      ],
    }, b);
    expect(r.wealthTax).toEqual({ every: 1, pct: 50, who: 'leader' });
    expect(r.crisis).toEqual({ every: 3, house: 25, hotel: 0 });
    expect(r.quake).toBeUndefined();
    expect(r.custom).toEqual([{ text: 'ok', when: { t: 'go' }, who: 'self', what: { t: 'money', amount: 30 } }]);
  });
});
