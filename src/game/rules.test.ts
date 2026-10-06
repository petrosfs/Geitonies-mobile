import { describe, expect, it } from 'vitest';
import {
  apply, bankStock, netWorth, newGame, ownedBy, rentFor, RuleError, unmortgageCost, waiting,
} from './engine';
import type { Action, BoardId, Game, Rules } from './types';
import { BOARDS } from './boards';

/*
 * Targeted rule tests. Dice are made deterministic by choosing the random seed
 * that produces the wanted roll.
 */

function rand(st: { rng: number }): number {
  let t = (st.rng = (st.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const seedCache = new Map<string, number>();
function seedFor(...dice: number[]): number {
  const key = dice.join();
  if (seedCache.has(key)) return seedCache.get(key)!;
  for (let r = 1; r < 5_000_000; r++) {
    const st = { rng: r };
    if (dice.every((d) => 1 + Math.floor(rand(st) * 6) === d)) { seedCache.set(key, r); return r; }
  }
  throw new Error('no seed for ' + key);
}

function mk(n = 2, rules: Partial<Rules> = {}, boardId: BoardId = 'classic'): Game {
  const g = newGame({
    boardId, names: [], customCards: [],
    players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, color: '#000', emoji: '🎩', device: 'd' })),
    rules: {
      auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false,
      timeLimitMin: 0, autoMoveSec: 60, ...rules,
    },
  }, 7, 0);
  g.cur = 0;
  g.startIdx = 0;
  g.players.forEach((p) => { p.lapped = true; });
  return g;
}
const act = (g: Game, by: string, a: Action, now = 0) => apply(g, by, a, now);
function roll(g: Game, a: number, b: number): Game {
  const c = structuredClone(g);
  c.rng = seedFor(a, b);
  return act(c, c.players[c.cur].id, { t: 'roll' });
}
function expectRule(fn: () => unknown, key?: string) {
  try { fn(); } catch (e) {
    expect(e).toBeInstanceOf(RuleError);
    if (key) expect((e as Error).message).toBe(key);
    return;
  }
  throw new Error('expected a rule error' + (key ? ' ' + key : ''));
}
const own = (g: Game, id: string, ...sqs: number[]) => sqs.forEach((sq) => { g.props[sq].owner = id; });

describe('movement, buying and renaming', () => {
  it('landing on a free street offers it; buying and renaming work', () => {
    let g = roll(mk(), 1, 2);                         // 0 -> 3 (street, 60 €)
    expect(g.players[0].pos).toBe(3);
    expect(g.q[0]).toMatchObject({ k: 'buy', sq: 3, who: 'p0' });
    g = act(g, 'p0', { t: 'buy' });
    expect(g.players[0].cash).toBe(1440);
    expect(g.props[3].owner).toBe('p0');
    expect(g.q[0]).toMatchObject({ k: 'rename', sq: 3 });
    g = act(g, 'p0', { t: 'rename', name: '   ' + 'x'.repeat(50) + '   ' });
    expect(g.names[3]).toBe('x'.repeat(32));
    g = act(g, 'p0', { t: 'endTurn' });
    expect(g.cur).toBe(1);
  });

  it('passing Start pays the salary, landing on it pays double with the house rule', () => {
    let g = mk();
    g.players[0].pos = 38;
    g = roll(g, 1, 3);                                // 38 -> 2 (passes start)
    expect(g.players[0].cash).toBe(1700);
    let h = mk(2, { doubleGo: true });
    h.players[0].pos = 36;
    h = roll(h, 1, 3);                                // 36 -> 0 exactly
    expect(h.players[0].cash).toBe(1900);
  });

  it('doubles give another roll; the third doubles send you to jail', () => {
    let g = roll(mk(), 5, 5);                         // -> 10 (just visiting)
    expect(g.again).toBe(true);
    expectRule(() => act(g, 'p0', { t: 'endTurn' }), 'notNow');
    g = roll(g, 5, 5);                                // -> 20 (parking)
    g = roll(g, 5, 5);                                // third doubles
    expect(g.players[0]).toMatchObject({ pos: 10, jail: true });
    expect(g.again).toBe(false);
    g = act(g, 'p0', { t: 'endTurn' });
    expect(g.cur).toBe(1);
  });

  it('the Go to Jail square sends you to jail and ends the move', () => {
    let g = mk();
    g.players[0].pos = 27;
    g = roll(g, 1, 2);
    expect(g.players[0]).toMatchObject({ pos: 10, jail: true });
    expect(g.rolled && !g.again).toBe(true);
  });
});

describe('jail', () => {
  it('pay the fine or use a card to get out', () => {
    let g = mk();
    Object.assign(g.players[0], { pos: 10, jail: true });
    g = act(g, 'p0', { t: 'payJail' });
    expect(g.players[0]).toMatchObject({ jail: false, cash: 1450 });

    let h = mk();
    const card = h.cards.find((c) => c.fx.t === 'jailCard')!.id;
    h.decks[h.cards[card].deck] = h.decks[h.cards[card].deck].filter((c) => c !== card);
    Object.assign(h.players[0], { pos: 10, jail: true, jailCards: [card] });
    h = act(h, 'p0', { t: 'useCard' });
    expect(h.players[0].jail).toBe(false);
    expect(h.players[0].jailCards).toEqual([]);
    expect(h.decks[h.cards[card].deck]).toContain(card);
  });

  it('after three failed tries you pay and move', () => {
    let g = mk();
    Object.assign(g.players[0], { pos: 10, jail: true, jailTries: 2 });
    g = roll(g, 1, 2);
    expect(g.players[0]).toMatchObject({ jail: false, pos: 13, cash: 1450 });
    expect(g.q[0]).toMatchObject({ k: 'buy', sq: 13 });
  });

  it('doubles get you out and move you, without another roll', () => {
    let g = mk();
    Object.assign(g.players[0], { pos: 10, jail: true });
    g = roll(g, 2, 2);
    expect(g.players[0]).toMatchObject({ jail: false, pos: 14 });
    expect(g.again).toBe(false);
  });
});

describe('rent', () => {
  it('streets: base, whole group doubles, houses, mortgaged pays nothing', () => {
    const g = mk();
    own(g, 'p1', 1);
    expect(rentFor(g, 1, 7)).toBe(2);
    own(g, 'p1', 3);
    expect(rentFor(g, 1, 7)).toBe(4);
    g.props[1].houses = 2;
    expect(rentFor(g, 1, 7)).toBe(30);
    g.props[3].mort = true;
    expect(rentFor(g, 3, 7)).toBe(0);
  });

  it('stations by count, companies by dice', () => {
    const g = mk();
    own(g, 'p1', 5);
    expect(rentFor(g, 5, 7)).toBe(25);
    own(g, 'p1', 15, 25, 35);
    expect(rentFor(g, 5, 7)).toBe(200);
    own(g, 'p1', 12);
    expect(rentFor(g, 12, 7)).toBe(28);
    own(g, 'p1', 28);
    expect(rentFor(g, 12, 7)).toBe(70);
  });

  it('rent is paid to the owner when you land', () => {
    const g = mk();
    own(g, 'p1', 1, 3);
    const h = roll(g, 1, 2);                          // lands on 3: base 4, whole group -> 8
    expect(h.players[0].cash).toBe(1492);
    expect(h.players[1].cash).toBe(1508);
  });

  it('house rule: no rent while the owner is in jail', () => {
    const g = mk(2, { noRentInJail: true });
    own(g, 'p1', 3);
    g.players[1].jail = true;
    const h = roll(g, 1, 2);
    expect(h.players[0].cash).toBe(1500);
  });
});

describe('building and mortgages', () => {
  it('build evenly, respect the bank stock, hotel after four houses', () => {
    let g = mk();
    own(g, 'p0', 1, 3);
    g = act(g, 'p0', { t: 'build', sq: 1 });
    expect(g.props[1].houses).toBe(1);
    expectRule(() => act(g, 'p0', { t: 'build', sq: 1 }), 'buildEvenly');
    for (let k = 0; k < 7; k++) g = act(g, 'p0', { t: 'build', sq: k % 2 ? 1 : 3 });
    expect([g.props[1].houses, g.props[3].houses]).toEqual([4, 4]);
    const housesBefore = bankStock(g).houses;
    g = act(g, 'p0', { t: 'build', sq: 1 });
    expect(g.props[1].houses).toBe(5);
    expect(bankStock(g).houses).toBe(housesBefore + 4);
    expectRule(() => act(g, 'p0', { t: 'sell', sq: 3 }), 'sellEvenly');
  });

  it('no building without the whole group, or when the bank has none left', () => {
    let g = mk();
    own(g, 'p0', 1);
    expectRule(() => act(g, 'p0', { t: 'build', sq: 1 }), 'needGroup');
    own(g, 'p0', 3, 6, 8, 9, 11, 13, 14, 16, 18, 19);
    // use up all 32 houses elsewhere
    [6, 8, 9, 11, 13, 14, 16, 18].forEach((sq) => { g.props[sq].houses = 4; });
    expect(bankStock(g).houses).toBe(0);
    expectRule(() => act(g, 'p0', { t: 'build', sq: 1 }), 'noStock');
  });

  it('mortgage gives half the price, lifting it costs 10% more', () => {
    let g = mk();
    own(g, 'p0', 3);
    g = act(g, 'p0', { t: 'mortgage', sq: 3 });
    expect(g.players[0].cash).toBe(1530);
    expect(unmortgageCost(60)).toBe(33);
    g = act(g, 'p0', { t: 'unmortgage', sq: 3 });
    expect(g.players[0].cash).toBe(1497);
    own(g, 'p0', 1);
    g.props[1].houses = 1;
    expectRule(() => act(g, 'p0', { t: 'mortgage', sq: 3 }), 'sellFirst');
  });
});

describe('auctions', () => {
  it('open auction: highest bid wins; nobody bids -> stays with the bank', () => {
    let g = roll(mk(), 1, 2);
    g = act(g, 'p0', { t: 'decline' });
    expect(g.q[0].k).toBe('auction');
    g = act(g, 'p1', { t: 'bid', amount: 10 });
    expectRule(() => act(g, 'p0', { t: 'bid', amount: 10 }), 'bidLow');
    g = act(g, 'p0', { t: 'bid', amount: 20 });
    g = act(g, 'p1', { t: 'pass' });
    expect(g.props[3].owner).toBe('p0');
    expect(g.players[0].cash).toBe(1480);

    let h = roll(mk(), 1, 2);
    h = act(h, 'p0', { t: 'decline' });
    h = act(h, 'p0', { t: 'pass' });
    h = act(h, 'p1', { t: 'pass' });
    expect(h.props[3].owner).toBeNull();
    expect(h.q).toEqual([]);
  });

  it('sealed auction: a tie goes to the earliest player after the current one', () => {
    let g = roll(mk(3, { auction: 'sealed' }), 1, 2);
    g = act(g, 'p0', { t: 'decline' });
    g = act(g, 'p2', { t: 'sealed', amount: 50 });
    g = act(g, 'p0', { t: 'sealed', amount: 10 });
    g = act(g, 'p1', { t: 'sealed', amount: 50 });
    expect(g.props[3].owner).toBe('p1');
    expect(g.players[1].cash).toBe(1450);
  });

  it('house rule: nobody buys before completing a lap', () => {
    const g = mk(2, { buyAfterLap: true });
    g.players[0].lapped = false;
    const h = roll(g, 1, 2);
    expect(h.q).toEqual([]);
    expect(h.props[3].owner).toBeNull();
  });
});

describe('debts and bankruptcy', () => {
  it('owing a player more than you have: debt, then bankruptcy hands everything over and ends the game', () => {
    let g = mk();
    own(g, 'p1', 37, 39);
    g.props[39].houses = 5;                             // rent 2000
    own(g, 'p0', 1);
    Object.assign(g.players[0], { pos: 36, cash: 100 });
    g = roll(g, 1, 2);
    expect(g.q[0]).toMatchObject({ k: 'debt', who: 'p0' });
    expectRule(() => act(g, 'p0', { t: 'payDebt' }), 'noCash');
    g = act(g, 'p0', { t: 'mortgage', sq: 1 });       // allowed while in debt
    g = act(g, 'p0', { t: 'bankrupt' });
    expect(g.players[0].out).toBe(true);
    expect(g.props[1].owner).toBe('p1');
    expect(g.over?.rank[0].id).toBe('p1');
  });

  it('owing the bank: properties go to auction', () => {
    let g = mk(3);
    own(g, 'p0', 6);
    Object.assign(g.players[0], { pos: 1, cash: 100 });
    g = roll(g, 1, 2);                                // tax 200
    g = act(g, 'p0', { t: 'bankrupt' });
    expect(g.players[0].out).toBe(true);
    expect(g.props[6].owner).toBeNull();
    expect(g.q[0]).toMatchObject({ k: 'auction', sq: 6 });
    expect(waiting(g).sort()).toEqual(['p1', 'p2']);
    expect(g.cur).toBe(1);
  });

  it('free parking pot collects fees and pays out', () => {
    let g = mk(2, { freeParking: true });
    Object.assign(g.players[0], { pos: 1 });
    g = roll(g, 1, 2);                                // tax 200 -> pot
    expect(g.pot).toBe(200);
    g = act(g, 'p0', { t: 'endTurn' });
    g.players[1].pos = 17;
    g = roll(g, 1, 2);                                // -> 20 parking
    expect(g.players[1].cash).toBe(1700);
    expect(g.pot).toBe(0);
  });
});

describe('cards', () => {
  const withCard = (g: Game, pick: (c: Game['cards'][number]) => boolean) => {
    const card = g.cards.find(pick)!;
    g.q = [{ k: 'card', card: card.id, who: 'p0' }];
    return act(g, 'p0', { t: 'cardOk' });
  };

  it('collect from each player: a broke player gets a debt', () => {
    const g = mk(3);
    g.players[1].cash = 5;
    const h = withCard(g, (c) => c.fx.t === 'each' && c.fx.amount > 0);
    expect(h.players[0].cash).toBe(1510);
    expect(h.players[2].cash).toBe(1490);
    expect(h.q[0]).toMatchObject({ k: 'debt', who: 'p1' });
  });

  it('repairs charge per house and per hotel', () => {
    const g = mk();
    own(g, 'p0', 1, 3);
    g.props[1].houses = 2;
    g.props[3].houses = 5;
    const h = withCard(g, (c) => c.fx.t === 'repairs' && c.fx.house === 25);
    expect(h.players[0].cash).toBe(1500 - 50 - 100);
  });

  it('nearest station charges double rent; going back 3 pays no salary', () => {
    const g = mk();
    g.players[0].pos = 7;
    own(g, 'p1', 15);
    const h = withCard(g, (c) => c.fx.t === 'nearest' && c.fx.kind === 'station');
    expect(h.players[0].pos).toBe(15);
    expect(h.players[0].cash).toBe(1450);

    const k = mk();
    k.players[0].pos = 7;
    const j = withCard(k, (c) => c.fx.t === 'move');
    expect(j.players[0].pos).toBe(4);
    expect(j.players[0].cash).toBe(1300);             // tax 200, no salary
  });
});

describe('trades', () => {
  it('buildings block, mortgaged properties cost 10%, counter-offers swap sides', () => {
    let g = mk();
    own(g, 'p0', 1, 3);
    own(g, 'p1', 5);
    g.props[1].houses = 1;
    expectRule(() => act(g, 'p0', { t: 'propose', trade: { from: 'p0', to: 'p1', give: { cash: 0, props: [3], cards: 0 }, get: { cash: 0, props: [], cards: 0 } } }), 'tradeBuildings');
    g.props[1].houses = 0;
    g.props[5].mort = true;
    g = act(g, 'p0', { t: 'propose', trade: { from: 'p0', to: 'p1', give: { cash: 100, props: [], cards: 0 }, get: { cash: 0, props: [5], cards: 0 } } });
    expect(waiting(g)).toEqual(['p1']);
    expectRule(() => act(g, 'p0', { t: 'roll' }), 'notNow');
    g = act(g, 'p1', { t: 'counter', trade: { from: 'p1', to: 'p0', give: { cash: 0, props: [5], cards: 0 }, get: { cash: 150, props: [], cards: 0 } } });
    expect(waiting(g)).toEqual(['p0']);
    g = act(g, 'p0', { t: 'accept' });
    expect(g.props[5].owner).toBe('p0');
    expect(g.players[0].cash).toBe(1500 - 150 - 10);  // 10% of the 100 mortgage value
    expect(g.players[1].cash).toBe(1650);
  });
});

describe('game flow', () => {
  it('time limit: the round is finished, then the richest wins', () => {
    let g = mk(2, { timeLimitMin: 1 });
    g = act(g, 'host', { t: 'tick' }, 30000);
    g = act(g, 'host', { t: 'tick' }, 61000);
    expect(g.timeUp).toBe(true);
    g.rolled = true;
    g = act(g, 'p0', { t: 'endTurn' }, 62000);
    expect(g.over).toBeNull();
    own(g, 'p1', 39);
    g.rolled = true;
    g = act(g, 'p1', { t: 'endTurn' }, 63000);
    expect(g.over?.rank.map((r) => r.id)).toEqual(['p1', 'p0']);
    expect(g.over?.rank[0].worth).toBe(netWorth(g, 'p1'));
  });

  it('only the right player may act; kicking is host-only', () => {
    const g = mk(3);
    expectRule(() => act(g, 'p1', { t: 'roll' }), 'notNow');
    expectRule(() => act(g, 'p0', { t: 'kick', id: 'p1' }), 'notNow');
    own(g, 'p1', 6);
    const h = act(g, 'host', { t: 'kick', id: 'p1' });
    expect(h.players[1].out).toBe(true);
    expect(h.q[0]).toMatchObject({ k: 'auction', sq: 6 });
    expectRule(() => act(h, 'p1', { t: 'pass' }));
  });

  it('older saved games (without newer fields) still load and play', () => {
    const g = mk();
    delete g.rolls;
    delete g.logSeq;
    const back = JSON.parse(JSON.stringify(g)) as Game;
    expect(back).toEqual(g);
    const h = roll(back, 1, 2);
    expect(h.rolls).toBe(1);
    expect(h.logSeq).toBeGreaterThan(0);
  });

  it('the large board: round prices, rising from group to group', () => {
    const b = BOARDS.large;
    let prev = 0;
    for (const grp of b.groups) {
      for (const m of grp.members) {
        expect(b.squares[m].price! % 10).toBe(0);                         // only round prices
        expect(b.squares[m].house! % 50).toBe(0);
      }
      const first = b.squares[grp.members[0]].price!;
      expect(first).toBeGreaterThan(prev);
      prev = first;
    }
  });

  it('the large board has the planned layout and sane prices', () => {
    const g = mk(8, {}, 'large');
    expect(g.names.length).toBe(56);
    expect(g.players[0].cash).toBe(2000);
    const b = Object.keys(g.props).map(Number);
    expect(b.length).toBe(31 + 6 + 3);
    const h = mk(8, {}, 'large');
    own(h, 'p0', ...b);
    expect(ownedBy(h, 'p0').length).toBe(40);
  });

  it('statistics: rent, jail, purchases and worth per round are recorded', () => {
    let g = mk();
    own(g, 'p1', 1, 3);
    g = roll(g, 1, 2);                                // p0 pays 8 rent on square 3
    expect(g.stats!.players.p0.rentOut).toBe(8);
    expect(g.stats!.players.p1.rentIn).toBe(8);
    expect(g.stats!.sq[3]).toBe(8);
    g = act(g, 'p0', { t: 'endTurn' });
    g.players[1].pos = 27;
    g = roll(g, 1, 2);                                // p1 -> go to jail
    expect(g.stats!.players.p1.jail).toBe(1);
    g = act(g, 'p1', { t: 'endTurn' });               // new round
    expect(g.round).toBe(2);
    expect(g.stats!.worth.length).toBe(2);
    expect(g.stats!.worth[1].w.p0).toBe(netWorth(g, 'p0'));
  });

  it('every new game (rematch) gets its own id', () => {
    const a = mk();
    const b = newGame({ boardId: 'classic', names: [], customCards: [], players: a.players.map((p) => ({ ...p })), rules: a.rules }, 8, 1000);
    expect(a.gid).toBeTruthy();
    expect(b.gid).not.toBe(a.gid);
  });

  it('house rule "pass": the property stays with the bank, no auction; without the rule it is not allowed', () => {
    let g = roll(mk(2, { allowPass: true }), 1, 2);
    expect(g.q[0]).toMatchObject({ k: 'buy', sq: 3 });
    g = act(g, 'p0', { t: 'skip' });
    expect(g.q).toEqual([]);
    expect(g.props[3].owner).toBeNull();
    const h = roll(mk(), 1, 2);
    expectRule(() => act(h, 'p0', { t: 'skip' }), 'notNow');
  });

  it('custom prices: used for buying, mortgages, worth; bad values are ignored', () => {
    const base = mk();
    const g0 = newGame({
      boardId: 'classic', names: [], customCards: [], players: base.players.map((p) => ({ ...p })), rules: base.rules,
      prices: { 3: 500, 1: 75, 5: 0, 4: 300, 39: 400 },  // 75 not a multiple of 10, 0 too low, 4 is a tax square, 39 = normal price
    }, 7, 0);
    expect(g0.prices).toEqual({ 3: 500 });
    g0.cur = 0; g0.players.forEach((p) => { p.lapped = true; });
    let g = roll(g0, 1, 2);
    g = act(g, 'p0', { t: 'buy' });
    expect(g.players[0].cash).toBe(1000);
    g = act(g, 'p0', { t: 'skipRename' });
    g = act(g, 'p0', { t: 'mortgage', sq: 3 });
    expect(g.players[0].cash).toBe(1250);
    expect(netWorth(g, 'p0')).toBe(1250 + 250);
    g = act(g, 'p0', { t: 'unmortgage', sq: 3 });
    expect(g.players[0].cash).toBe(1250 - 275);
  });

  it('a player can join a game in progress (host only), with the starting money, playing last', () => {
    let g = mk(2, { startCash: 1000 });
    expect(g.players.map((p) => p.cash)).toEqual([1000, 1000]);
    const np = { id: 'p9', name: 'Νέος', color: '#123456', emoji: '🎩', device: 'd9' };
    expectRule(() => act(g, 'p0', { t: 'addPlayer', player: np }), 'notNow');
    g = act(g, 'host', { t: 'addPlayer', player: np });
    expect(g.players.length).toBe(3);
    expect(g.players[2]).toMatchObject({ id: 'p9', cash: 1000, pos: 0, out: false });
    expect(g.cur).toBe(0);
    expectRule(() => act(g, 'host', { t: 'addPlayer', player: np }), 'notNow'); // same id twice
  });
});
