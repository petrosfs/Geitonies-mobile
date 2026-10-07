import { BOARDS, isOwnable } from './boards';
import { buildCards } from './cards';
import { defaultName, validNameMap } from './cities';
import { cleanHouseRules, firesAt } from './houserules';
import type {
  Action, Board, Card, CustomRule, Game, Offer, Owed, Pending, Player, PlayerStats, RuleDo, RuleWho, Setup, Stats, Trade,
} from './types';

export class RuleError extends Error {}
function fail(key: string): never { throw new RuleError(key); }

// ---------- helpers ----------

export const board = (g: Game): Board => BOARDS[g.boardId];

/** the price of a square in this game (custom price from the setup, or the board's) */
export function priceOf(g: Game, sq: number): number {
  return g.prices?.[sq] ?? board(g).squares[sq].price ?? 0;
}

/** keep only sensible custom prices: buyable squares, multiples of 10, 10–5000 € */
export function validPrices(b: Board, prices: Record<number, number> | undefined): Record<number, number> | undefined {
  if (!prices) return undefined;
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(prices)) {
    const sq = Number(k);
    if (b.squares[sq]?.price === undefined) continue;
    if (!Number.isInteger(v) || v % 10 !== 0 || v < 10 || v > 5000) continue;
    if (v !== b.squares[sq].price) out[sq] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function rand(g: Game): number {
  let t = (g.rng = (g.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const die = (g: Game) => 1 + Math.floor(rand(g) * 6);

function shuffle<T>(g: Game, arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(g) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const pl = (g: Game, id: string): Player => {
  const p = g.players.find((x) => x.id === id);
  if (!p) return fail('noPlayer');
  return p as Player;
};
export const curP = (g: Game) => g.players[g.cur];
export const active = (g: Game) => g.players.filter((p) => !p.out);
const log = (g: Game, k: string, a?: Record<string, string | number>) => {
  g.log.push({ k, a });
  g.logSeq = (g.logSeq ?? 0) + 1;
  if (g.log.length > 150) g.log.splice(0, g.log.length - 150);
};

export function ownedBy(g: Game, id: string): number[] {
  return Object.keys(g.props).map(Number).filter((sq) => g.props[sq].owner === id);
}

export function hasMonopoly(g: Game, sq: number): boolean {
  const s = board(g).squares[sq];
  if (s.group === undefined) return false;
  const owner = g.props[sq].owner;
  return !!owner && board(g).groups[s.group].members.every((m) => g.props[m].owner === owner);
}

function groupOf(g: Game, sq: number): number[] {
  const s = board(g).squares[sq];
  return s.group === undefined ? [sq] : board(g).groups[s.group].members;
}
const groupHasBuildings = (g: Game, sq: number) => groupOf(g, sq).some((m) => g.props[m].houses > 0);

export function bankStock(g: Game) {
  let houses = board(g).houses;
  let hotels = board(g).hotels;
  for (const k of Object.keys(g.props)) {
    const h = g.props[Number(k)].houses;
    if (h === 5) hotels--; else houses -= h;
  }
  return { houses, hotels };
}

export function rentFor(g: Game, sq: number, dice: number, opts: { x2?: boolean; util10?: boolean } = {}): number {
  const b = board(g);
  const s = b.squares[sq];
  const pr = g.props[sq];
  if (!pr.owner || pr.mort) return 0;
  if (s.kind === 'street') {
    const r = s.rent!;
    if (pr.houses > 0) return r[pr.houses];
    return hasMonopoly(g, sq) ? r[0] * 2 : r[0];
  }
  if (s.kind === 'station') {
    const n = ownedBy(g, pr.owner).filter((m) => b.squares[m].kind === 'station').length;
    const r = b.stationRent[Math.min(n, b.stationRent.length) - 1];
    return opts.x2 ? r * 2 : r;
  }
  if (s.kind === 'utility') {
    const n = ownedBy(g, pr.owner).filter((m) => b.squares[m].kind === 'utility').length;
    const mult = opts.util10 ? 10 : b.utilMult[Math.min(n, b.utilMult.length) - 1];
    return dice * mult;
  }
  return 0;
}

export function netWorth(g: Game, id: string): number {
  const b = board(g);
  const p = pl(g, id);
  let w = p.cash;
  for (const sq of ownedBy(g, id)) {
    const s = b.squares[sq];
    const pr = g.props[sq];
    w += pr.mort ? priceOf(g, sq) / 2 : priceOf(g, sq);
    if (s.house) w += s.house * pr.houses;
  }
  return w;
}

/** half the price + 10%, in whole integers (price * 1.1 / 2 would give 110.00000000000001 -> 111 for 200 €) */
export const unmortgageCost = (price: number) => Math.ceil((price * 11) / 20);

/** who can act right now */
export function waiting(g: Game): string[] {
  if (g.over) return [];
  const h = g.q[0];
  if (h) {
    if (h.k === 'auction') {
      if (g.rules.auction === 'sealed') return h.eligible.filter((id) => !(id in h.sealed));
      return h.eligible.filter((id) => !h.passed.includes(id) && id !== h.bidder);
    }
    return [h.who];
  }
  if (g.trade) return [g.trade.to];
  return [curP(g).id];
}

// ---------- statistics ----------

function stats(g: Game): Stats {
  if (!g.stats) g.stats = { players: {}, sq: {}, worth: [] };
  return g.stats;
}
function pstat(g: Game, id: string): PlayerStats {
  const st = stats(g);
  return (st.players[id] ??= { rentIn: 0, rentOut: 0, jail: 0, bought: 0, maxWorth: 0 });
}
/** remember everyone's net worth (once per round, and at the end) */
function snapshot(g: Game) {
  const st = stats(g);
  const w: Record<string, number> = {};
  for (const p of g.players) {
    w[p.id] = p.out ? 0 : netWorth(g, p.id);
    const ps = pstat(g, p.id);
    ps.maxWorth = Math.max(ps.maxWorth, w[p.id]);
  }
  st.worth.push({ round: g.round ?? 1, w });
  if (st.worth.length > 400) st.worth = st.worth.filter((_, i) => i % 2 === 0); // keep it small
}

// ---------- setup ----------

/** starting money: the setup's choice (50 € steps, 100–20 000 €) or the board's */
export function startCashOf(rules: { startCash?: number }, boardDefault: number): number {
  const v = Number(rules.startCash);
  if (!Number.isFinite(v) || v <= 0) return boardDefault;
  return Math.min(20000, Math.max(100, Math.round(v / 50) * 50));
}

export function newGame(setup: Setup, seed: number, now: number): Game {
  const b = BOARDS[setup.boardId];
  const props: Game['props'] = {};
  b.squares.forEach((s, i) => { if (isOwnable(s)) props[i] = { owner: null, houses: 0, mort: false }; });
  const cards: Card[] = buildCards(b, setup.customCards);
  const g: Game = {
    gid: `${(seed >>> 0).toString(36)}-${Math.floor(now).toString(36)}`,
    v: 0,
    boardId: setup.boardId,
    names: b.squares.map((_, i) => setup.names[i] ?? ''),
    city: setup.city ?? 'athens',
    nameMap: validNameMap(setup.boardId, setup.nameMap),
    prices: validPrices(b, setup.prices),
    rules: cleanHouseRules(setup.rules, b),
    players: setup.players.map((p) => ({
      ...p, cash: startCashOf(setup.rules, b.startCash), pos: 0, jail: false, jailTries: 0, jailCards: [], out: false, lapped: false,
    })),
    cur: 0, startIdx: 0, rolled: false, again: false, doubles: 0, dice: null,
    props, cards,
    decks: { chance: [], chest: [] },
    q: [], trade: null, pot: 0, log: [],
    rng: seed >>> 0,
    clock: { elapsed: 0, last: now },
    timeUp: false, turnNo: 1, over: null,
  };
  g.decks.chance = shuffle(g, cards.filter((c) => c.deck === 'chance').map((c) => c.id));
  g.decks.chest = shuffle(g, cards.filter((c) => c.deck === 'chest').map((c) => c.id));
  // who starts: highest roll
  let best = -1;
  g.players.forEach((p, i) => {
    const r = die(g) + die(g);
    log(g, 'startRoll', { p: p.id, n: r });
    if (r > best) { best = r; g.cur = i; }
  });
  g.startIdx = g.cur;
  g.round = 1;
  log(g, 'starts', { p: curP(g).id });
  snapshot(g);
  return g;
}

// ---------- money ----------

function credit(g: Game, to: string, amount: number) {
  if (to === 'bank') return;
  if (to === 'pot') { g.pot += amount; return; }
  const p = g.players.find((x) => x.id === to);
  if (p && !p.out) p.cash += amount; // payments to eliminated players go to the bank
}

const feeTarget = (g: Game) => (g.rules.freeParking ? 'pot' : 'bank');

/** charge a player; if they can't pay, a debt is queued (front) */
function charge(g: Game, who: string, owed: Owed[], then?: { move: number }) {
  const list = owed.filter((o) => o.amount > 0);
  const total = list.reduce((s, o) => s + o.amount, 0);
  const p = pl(g, who);
  if (total === 0) { if (then) moveBy(g, p, then.move); return; }
  if (p.cash >= total) {
    p.cash -= total;
    list.forEach((o) => credit(g, o.to, o.amount));
    list.forEach((o) => log(g, 'paid', { p: who, n: o.amount, to: o.to }));
    if (then) moveBy(g, p, then.move);
  } else {
    g.q.push({ k: 'debt', who, owed: list, then });
    log(g, 'debt', { p: who, n: total });
  }
}

// ---------- movement ----------

function salary(g: Game, p: Player, landedOnGo: boolean) {
  const s = board(g).salary;
  let n = landedOnGo && g.rules.doubleGo ? s * 2 : s;
  // upset rule: the poorest player gets double salary
  if (g.rules.underdog && last(g)?.id === p.id) { n *= 2; log(g, 'underdog', { p: p.id }); }
  p.cash += n;
  p.lapped = true;
  log(g, 'salary', { p: p.id, n });
  customRules(g, p, (w) => w.t === 'go');
}

function moveBy(g: Game, p: Player, steps: number, dice?: number) {
  const N = board(g).squares.length;
  const from = p.pos;
  const to = (((from + steps) % N) + N) % N;
  p.pos = to;
  if (steps > 0 && from + steps >= N) salary(g, p, to === 0);
  if (p.jail) return; // a rule sent them to jail on the way
  log(g, 'moved', { p: p.id, sq: to });
  land(g, p, dice ?? Math.abs(steps));
}

function moveTo(g: Game, p: Player, sq: number, collectGo: boolean, opts: { x2?: boolean; util10?: boolean } = {}) {
  const from = p.pos;
  p.pos = sq;
  if (collectGo && (sq < from || (sq === 0 && from !== 0))) salary(g, p, sq === 0);
  if (p.jail) return;
  log(g, 'moved', { p: p.id, sq });
  land(g, p, g.dice ? g.dice[0] + g.dice[1] : 7, opts);
}

function toJail(g: Game, p: Player) {
  p.pos = board(g).jail;
  p.jail = true;
  p.jailTries = 0;
  if (curP(g).id === p.id) { g.again = false; g.rolled = true; g.doubles = 0; }
  log(g, 'jailed', { p: p.id });
  pstat(g, p.id).jail++;
}

function land(g: Game, p: Player, dice: number, opts: { x2?: boolean; util10?: boolean } = {}) {
  const b = board(g);
  const at = p.pos;
  customRules(g, p, (w) => w.t === 'land' && w.sq === at);
  if (p.jail || p.out) return;
  const s = b.squares[p.pos];
  switch (s.kind) {
    case 'street': case 'station': case 'utility': {
      const pr = g.props[p.pos];
      if (!pr.owner) {
        if (g.rules.buyAfterLap && !p.lapped) { log(g, 'noBuyYet', { p: p.id }); return; }
        g.q.push({ k: 'buy', sq: p.pos, who: p.id });
        return;
      }
      if (pr.owner === p.id || pr.mort) return;
      const owner = pl(g, pr.owner);
      if (g.rules.noRentInJail && owner.jail) { log(g, 'noRentJail', { p: owner.id }); return; }
      let d = dice;
      if (opts.util10 && s.kind === 'utility') {
        const a = die(g), c = die(g);
        d = a + c;
        log(g, 'utilRoll', { p: p.id, n: d });
      }
      const rent = rentFor(g, p.pos, d, opts);
      log(g, 'rent', { p: p.id, o: owner.id, n: rent, sq: p.pos });
      pstat(g, p.id).rentOut += rent;
      pstat(g, owner.id).rentIn += rent;
      stats(g).sq[p.pos] = (stats(g).sq[p.pos] ?? 0) + rent;
      charge(g, p.id, [{ to: owner.id, amount: rent }]);
      return;
    }
    case 'tax':
      log(g, 'tax', { p: p.id, n: s.tax! });
      charge(g, p.id, [{ to: feeTarget(g), amount: s.tax! }]);
      return;
    case 'chance': case 'chest': {
      const deck = g.decks[s.kind];
      if (deck.length === 0) return;
      const id = deck.shift()!;
      g.q.push({ k: 'card', card: id, who: p.id });
      return;
    }
    case 'gotojail': toJail(g, p); return;
    case 'parking':
      if (g.rules.freeParking && g.pot > 0) {
        log(g, 'pot', { p: p.id, n: g.pot });
        p.cash += g.pot; g.pot = 0;
      }
      return;
    default: return;
  }
}

// ---------- queue handling ----------

/** run fn with the head removed; anything fn queues goes to the front */
function resolveHead(g: Game, fn: () => void) {
  g.q.shift();
  const rest = g.q;
  g.q = [];
  fn();
  g.q = [...g.q, ...rest];
  startNext(g);
}

/** prepare the new head (auctions whose players have all left, etc.) */
function startNext(g: Game) {
  for (;;) {
    const h = g.q[0];
    if (!h) return;
    if (h.k !== 'auction') {
      if (pl(g, h.who).out) { g.q.shift(); continue; }
      return;
    }
    h.eligible = h.eligible.filter((id) => !pl(g, id).out);
    if (h.bidder && pl(g, h.bidder).out) { h.bidder = null; h.high = 0; }
    if (!checkAuction(g, h)) return;
  }
}

function startAuction(g: Game, sq: number): Pending | null {
  const eligible = active(g).filter((p) => !g.rules.buyAfterLap || p.lapped).map((p) => p.id);
  if (eligible.length === 0) return null;
  log(g, 'auction', { sq });
  return { k: 'auction', sq, high: 0, bidder: null, passed: [], sealed: {}, eligible };
}

/** returns true if the auction at the head finished (and was removed) */
function checkAuction(g: Game, a: Extract<Pending, { k: 'auction' }>): boolean {
  let winner: string | null = null;
  let price = 0;
  let done = false;
  if (g.rules.auction === 'sealed') {
    if (a.eligible.every((id) => id in a.sealed)) {
      done = true;
      // tie: earliest in turn order from the current player
      const n = g.players.length;
      const order = (id: string) => (g.players.findIndex((p) => p.id === id) - g.cur + n) % n;
      for (const id of [...a.eligible].sort((x, y) => order(x) - order(y))) {
        if (a.sealed[id] > price) { price = a.sealed[id]; winner = id; }
      }
    }
  } else {
    const left = a.eligible.filter((id) => !a.passed.includes(id));
    if (a.bidder && left.every((id) => id === a.bidder)) { done = true; winner = a.bidder; price = a.high; }
    if (!a.bidder && left.length === 0) done = true;
  }
  if (!done) return false;
  g.q.shift();
  if (winner && !pl(g, winner).out) {
    const w = pl(g, winner);
    w.cash -= price;
    g.props[a.sq].owner = winner;
    log(g, 'won', { p: winner, sq: a.sq, n: price });
    pstat(g, winner).bought++;
    g.q.unshift({ k: 'rename', sq: a.sq, who: winner });
  } else {
    log(g, 'noSale', { sq: a.sq });
  }
  return true;
}

// ---------- bankruptcy / end ----------

function bankrupt(g: Game, id: string, creditorId: string | null) {
  const b = board(g);
  const p = pl(g, id);
  const mine = ownedBy(g, id);
  // sell buildings back to the bank
  for (const sq of mine) {
    const pr = g.props[sq];
    if (pr.houses > 0) { p.cash += (b.squares[sq].house! * pr.houses) / 2; pr.houses = 0; }
  }
  const creditor = creditorId ? g.players.find((x) => x.id === creditorId && !x.out) : undefined;
  const auctions: Pending[] = [];
  if (creditor) {
    creditor.cash += Math.max(0, p.cash);
    mine.forEach((sq) => { g.props[sq].owner = creditor.id; });
    creditor.jailCards.push(...p.jailCards);
    log(g, 'bankruptTo', { p: id, o: creditor.id });
  } else {
    p.jailCards.forEach((c) => g.decks[g.cards[c].deck].push(c));
    log(g, 'bankruptBank', { p: id });
  }
  p.jailCards = [];
  p.cash = 0;
  p.out = true;
  if (!creditor) {
    // properties go back to the bank and are auctioned
    for (const sq of mine) {
      g.props[sq] = { owner: null, houses: 0, mort: false };
      const a = startAuction(g, sq);
      if (a) auctions.push(a);
    }
  }
  g.q = g.q.filter((x) => x.k === 'auction' || x.who !== id);
  g.q.push(...auctions);
  if (g.trade && (g.trade.from === id || g.trade.to === id)) g.trade = null;
  if (active(g).length <= 1) { finish(g); return; }
  if (curP(g).id === id) advance(g);
  startNext(g);
}

function finish(g: Game) {
  snapshot(g);
  const rank = g.players
    .filter((p) => !p.out)
    .map((p) => ({ id: p.id, worth: netWorth(g, p.id) }))
    .sort((a, b) => b.worth - a.worth);
  const outs = g.players.filter((p) => p.out).map((p) => ({ id: p.id, worth: 0 }));
  g.over = { rank: [...rank, ...outs] };
  g.q = [];
  g.trade = null;
  log(g, 'over', { p: rank[0]?.id ?? '' });
}

function advance(g: Game) {
  const roundBefore = g.round;
  const n = g.players.length;
  const rank = (i: number) => (i - g.startIdx + n) % n;
  let next = g.cur;
  for (let k = 1; k <= n; k++) {
    const i = (g.cur + k) % n;
    if (!g.players[i].out) { next = i; break; }
  }
  if (rank(next) <= rank(g.cur)) { g.round = (g.round ?? 1) + 1; snapshot(g); }
  if (g.timeUp && rank(next) <= rank(g.cur)) { finish(g); return; }
  // round boundary: if the starting player is out, move the boundary
  if (g.players[g.startIdx].out && rank(next) <= rank(g.cur)) g.startIdx = next;
  g.cur = next;
  g.rolled = false; g.again = false; g.doubles = 0; g.dice = null;
  g.turnNo++;
  log(g, 'turn', { p: curP(g).id });
  if (g.round !== roundBefore) roundRules(g);
}

// ---------- upset rules ----------

const worths = (g: Game) => active(g).map((p) => ({ p, w: netWorth(g, p.id) }));
/** the richest player (first in turn order on a tie), if there are two or more */
function leader(g: Game): Player | null {
  const ws = worths(g);
  if (ws.length < 2) return null;
  return ws.reduce((a, b) => (b.w > a.w ? b : a)).p;
}
/** the poorest player (first in turn order on a tie), if there are two or more */
function last(g: Game): Player | null {
  const ws = worths(g);
  if (ws.length < 2) return null;
  return ws.reduce((a, b) => (b.w < a.w ? b : a)).p;
}
const r10 = (n: number) => Math.round(n / 10) * 10;

function targets(g: Game, who: RuleWho, self: Player): Player[] {
  if (who === 'self') return self.out ? [] : [self];
  if (who === 'all') return active(g);
  const p = who === 'leader' ? leader(g) : last(g);
  return p ? [p] : [];
}

function repairsBill(g: Game, id: string, house: number, hotel: number): number {
  let n = 0;
  for (const sq of ownedBy(g, id)) {
    const h = g.props[sq].houses;
    n += h === 5 ? hotel : h * house;
  }
  return n;
}

/** take one building off a street (a hotel becomes 4 houses if the bank has them); half its price back */
function dropHouse(g: Game, sq: number) {
  const s = board(g).squares[sq];
  const pr = g.props[sq];
  if (!pr.owner || pr.houses === 0) return;
  const p = pl(g, pr.owner);
  if (pr.houses === 5 && bankStock(g).houses < 4) { p.cash += (s.house! * 5) / 2; pr.houses = 0; }
  else { pr.houses--; p.cash += s.house! / 2; }
  log(g, 'lostHouse', { p: p.id, sq });
}

function doRule(g: Game, p: Player, what: RuleDo) {
  switch (what.t) {
    case 'money':
      if (what.amount > 0) { p.cash += what.amount; log(g, 'got', { p: p.id, n: what.amount }); }
      else charge(g, p.id, [{ to: feeTarget(g), amount: -what.amount }]);
      return;
    case 'pct': charge(g, p.id, [{ to: feeTarget(g), amount: r10((netWorth(g, p.id) * what.pct) / 100) }]); return;
    case 'repairs': charge(g, p.id, [{ to: feeTarget(g), amount: repairsBill(g, p.id, what.house, what.hotel) }]); return;
    case 'jail': if (!p.jail) toJail(g, p); return;
    case 'loseHouse': {
      const mine = ownedBy(g, p.id).filter((sq) => g.props[sq].houses > 0);
      if (!mine.length) return;
      dropHouse(g, mine.reduce((a, b) => (g.props[b].houses > g.props[a].houses ? b : a)));
      return;
    }
  }
}

function runRule(g: Game, i: number, r: CustomRule, self: Player) {
  const who = targets(g, r.who, self);
  if (!who.length) return;
  log(g, 'rule', { r: i, p: self.id });
  for (const p of who) doRule(g, p, r.what);
}

function customRules(g: Game, self: Player, match: (w: CustomRule['when']) => boolean) {
  (g.rules.custom ?? []).forEach((r, i) => { if (match(r.when)) runRule(g, i, r, self); });
}

/** at the start of a new round */
function roundRules(g: Game) {
  const round = g.round ?? 1;
  const R = g.rules;
  if (R.wealthTax && firesAt(round, R.wealthTax.every)) {
    const ws = worths(g);
    const avg = ws.reduce((s, x) => s + x.w, 0) / Math.max(1, ws.length);
    const lead = leader(g);
    const who = R.wealthTax.who === 'leader' ? (lead ? [lead] : []) : ws.filter((x) => x.w > avg).map((x) => x.p);
    for (const p of who) {
      const n = r10((netWorth(g, p.id) * R.wealthTax.pct) / 100);
      if (n <= 0) continue;
      log(g, 'wealthTax', { p: p.id, n, pct: R.wealthTax.pct });
      charge(g, p.id, [{ to: feeTarget(g), amount: n }]);
    }
  }
  if (R.crisis && firesAt(round, R.crisis.every)) {
    log(g, 'crisis', { h: R.crisis.house, H: R.crisis.hotel });
    for (const p of active(g)) charge(g, p.id, [{ to: feeTarget(g), amount: repairsBill(g, p.id, R.crisis.house, R.crisis.hotel) }]);
  }
  if (R.quake && firesAt(round, R.quake.every)) {
    const b = board(g);
    const hit = b.groups.map((gr, k) => ({ k, m: gr.members })).filter((x) => x.m.some((sq) => g.props[sq]?.houses > 0));
    if (!hit.length) log(g, 'quakeNone');
    else {
      const x = hit[Math.floor(rand(g) * hit.length)];
      log(g, 'quake', { sq: x.m[0] });
      for (const sq of x.m) dropHouse(g, sq);
    }
  }
  const self = curP(g);
  customRules(g, self, (w) => w.t === 'rounds' && firesAt(round, w.n));
}

// ---------- trades ----------

function checkOffer(g: Game, who: string, o: Offer) {
  const p = pl(g, who);
  if (o.cash < 0 || o.cash > p.cash) fail('tradeCash');
  if (o.cards < 0 || o.cards > p.jailCards.length) fail('tradeCards');
  for (const sq of o.props) {
    if (g.props[sq]?.owner !== who) fail('tradeOwner');
    if (groupHasBuildings(g, sq)) fail('tradeBuildings');
  }
}

function validateTrade(g: Game, t: Trade) {
  if (t.from === t.to) fail('tradeSelf');
  if (pl(g, t.from).out || pl(g, t.to).out) fail('tradeOut');
  checkOffer(g, t.from, t.give);
  checkOffer(g, t.to, t.get);
  if (!t.give.cash && !t.give.props.length && !t.give.cards && !t.get.cash && !t.get.props.length && !t.get.cards) fail('tradeEmpty');
}

function executeTrade(g: Game, t: Trade) {
  validateTrade(g, t);
  const a = pl(g, t.from), b = pl(g, t.to);
  const fee = (props: number[]) =>
    props.filter((sq) => g.props[sq].mort).reduce((s, sq) => s + Math.ceil(priceOf(g, sq) / 20), 0);
  const aFee = fee(t.get.props), bFee = fee(t.give.props);
  if (a.cash - t.give.cash + t.get.cash < aFee) fail('tradeFeeFrom');
  if (b.cash - t.get.cash + t.give.cash < bFee) fail('tradeFeeTo');
  a.cash += t.get.cash - t.give.cash - aFee;
  b.cash += t.give.cash - t.get.cash - bFee;
  t.give.props.forEach((sq) => { g.props[sq].owner = b.id; });
  t.get.props.forEach((sq) => { g.props[sq].owner = a.id; });
  b.jailCards.push(...a.jailCards.splice(0, t.give.cards));
  a.jailCards.push(...b.jailCards.splice(0, t.get.cards));
  log(g, 'traded', { p: a.id, o: b.id });
}

// ---------- building ----------

function canManage(g: Game, by: string) {
  const h = g.q[0];
  if (h) return h.k === 'debt' && h.who === by;
  return curP(g).id === by && !g.trade;
}

function build(g: Game, by: string, sq: number) {
  const b = board(g);
  const s = b.squares[sq];
  const pr = g.props[sq];
  if (s.kind !== 'street' || pr?.owner !== by) fail('notYours');
  if (!hasMonopoly(g, sq)) fail('needGroup');
  const grp = groupOf(g, sq);
  if (grp.some((m) => g.props[m].mort)) fail('groupMortgaged');
  if (pr.houses >= 5) fail('maxBuilt');
  if (grp.some((m) => g.props[m].houses < pr.houses)) fail('buildEvenly');
  const stock = bankStock(g);
  if (pr.houses === 4 ? stock.hotels < 1 : stock.houses < 1) fail('noStock');
  const p = pl(g, by);
  if (p.cash < s.house!) fail('noCash');
  p.cash -= s.house!;
  pr.houses++;
  log(g, pr.houses === 5 ? 'builtHotel' : 'built', { p: by, sq });
}

function sell(g: Game, by: string, sq: number) {
  const b = board(g);
  const s = b.squares[sq];
  const pr = g.props[sq];
  if (pr?.owner !== by || pr.houses === 0) fail('nothingToSell');
  if (groupOf(g, sq).some((m) => g.props[m].houses > pr.houses)) fail('sellEvenly');
  const p = pl(g, by);
  if (pr.houses === 5) {
    const stock = bankStock(g);
    if (stock.houses >= 4) { pr.houses = 4; p.cash += s.house! / 2; }
    else { p.cash += (s.house! * 5) / 2; pr.houses = 0; }
  } else {
    pr.houses--;
    p.cash += s.house! / 2;
  }
  log(g, 'sold', { p: by, sq });
}

function mortgage(g: Game, by: string, sq: number) {
  const pr = g.props[sq];
  if (pr?.owner !== by) fail('notYours');
  if (pr.mort) fail('already');
  if (groupHasBuildings(g, sq)) fail('sellFirst');
  pr.mort = true;
  pl(g, by).cash += priceOf(g, sq) / 2;
  log(g, 'mortgaged', { p: by, sq });
}

function unmortgage(g: Game, by: string, sq: number) {
  const pr = g.props[sq];
  if (pr?.owner !== by || !pr.mort) fail('notMortgaged');
  const cost = unmortgageCost(priceOf(g, sq));
  const p = pl(g, by);
  if (p.cash < cost) fail('noCash');
  p.cash -= cost;
  pr.mort = false;
  log(g, 'unmortgaged', { p: by, sq });
}

// ---------- cards ----------

function applyCard(g: Game, p: Player, card: Card) {
  const b = board(g);
  const fx = card.fx;
  const back = () => g.decks[card.deck].push(card.id);
  switch (fx.t) {
    case 'money':
      back();
      if (fx.amount >= 0) { p.cash += fx.amount; log(g, 'got', { p: p.id, n: fx.amount }); }
      else charge(g, p.id, [{ to: feeTarget(g), amount: -fx.amount }]);
      return;
    case 'each': {
      back();
      const others = active(g).filter((o) => o.id !== p.id);
      if (fx.amount >= 0) others.forEach((o) => charge(g, o.id, [{ to: p.id, amount: fx.amount }]));
      else charge(g, p.id, others.map((o) => ({ to: o.id, amount: -fx.amount })));
      return;
    }
    case 'goto': back(); moveTo(g, p, Math.max(0, Math.min(fx.sq, b.squares.length - 1)), fx.go); return;
    case 'move': back(); moveBy(g, p, fx.steps, g.dice ? g.dice[0] + g.dice[1] : 7); return;
    case 'jail': back(); toJail(g, p); return;
    case 'jailCard': p.jailCards.push(card.id); return;
    case 'repairs': {
      back();
      let n = 0;
      for (const sq of ownedBy(g, p.id)) {
        const h = g.props[sq].houses;
        n += h === 5 ? fx.hotel : h * fx.house;
      }
      charge(g, p.id, [{ to: feeTarget(g), amount: n }]);
      return;
    }
    case 'nearest': {
      back();
      const N = b.squares.length;
      let sq = p.pos;
      for (let k = 1; k <= N; k++) {
        const i = (p.pos + k) % N;
        if (b.squares[i].kind === fx.kind) { sq = i; break; }
      }
      moveTo(g, p, sq, true, fx.kind === 'station' ? { x2: true } : { util10: true });
      return;
    }
  }
}

// ---------- reducer ----------

/** Applies an action. `by` = acting player id, or 'host'. Returns a new state. */
export function apply(prev: Game, by: string, a: Action, now: number): Game {
  const g: Game = structuredClone(prev);
  // clock (pauses while the game is closed: long gaps are capped)
  const dt = Math.max(0, Math.min(now - g.clock.last, 120000));
  g.clock.elapsed += dt;
  g.clock.last = now;
  if (g.rules.timeLimitMin > 0 && !g.timeUp && g.clock.elapsed >= g.rules.timeLimitMin * 60000) {
    g.timeUp = true;
    log(g, 'timeUp');
  }
  if (a.t === 'tick') { if (dt === 0 && !g.timeUp) return prev; g.v++; return g; }
  if (g.over) fail('gameOver');
  const head = g.q[0];
  const me = by === 'host' ? null : pl(g, by);
  if (me?.out) fail('youAreOut');
  const isCur = me !== null && curP(g).id === me.id;

  switch (a.t) {
    case 'roll': {
      if (!isCur || head || g.trade) fail('notNow');
      if (g.rolled && !g.again) fail('alreadyRolled');
      const p = me!;
      const d1 = die(g), d2 = die(g);
      g.dice = [d1, d2];
      g.rolls = (g.rolls ?? 0) + 1;
      const dbl = d1 === d2;
      log(g, 'rolled', { p: p.id, a: d1, b: d2 });
      g.rolled = true;
      if (p.jail) {
        g.again = false;
        if (dbl) {
          p.jail = false; p.jailTries = 0;
          log(g, 'leftJail', { p: p.id });
          moveBy(g, p, d1 + d2);
        } else {
          p.jailTries++;
          if (p.jailTries >= 3) {
            p.jail = false; p.jailTries = 0;
            charge(g, p.id, [{ to: feeTarget(g), amount: board(g).jailFine }], { move: d1 + d2 });
          } else log(g, 'stayJail', { p: p.id });
        }
        break;
      }
      if (dbl) {
        g.doubles++;
        if (g.doubles >= 3) { log(g, 'threeDoubles', { p: p.id }); toJail(g, p); break; }
      }
      g.again = dbl;
      moveBy(g, p, d1 + d2);
      break;
    }
    case 'payJail': {
      if (!isCur || head || g.rolled || !me!.jail) fail('notNow');
      if (me!.cash < board(g).jailFine) fail('noCash');
      me!.cash -= board(g).jailFine;
      credit(g, feeTarget(g), board(g).jailFine);
      me!.jail = false; me!.jailTries = 0;
      log(g, 'paidJail', { p: me!.id });
      break;
    }
    case 'useCard': {
      if (!isCur || head || g.rolled || !me!.jail || me!.jailCards.length === 0) fail('notNow');
      const c = me!.jailCards.shift()!;
      g.decks[g.cards[c].deck].push(c);
      me!.jail = false; me!.jailTries = 0;
      log(g, 'usedCard', { p: me!.id });
      break;
    }
    case 'buy': {
      if (head?.k !== 'buy' || head.who !== by) fail('notNow');
      const h = head as Extract<Pending, { k: 'buy' }>;
      const price = priceOf(g, h.sq);
      if (me!.cash < price) fail('noCash');
      me!.cash -= price;
      g.props[h.sq].owner = by;
      log(g, 'bought', { p: by, sq: h.sq, n: price });
      pstat(g, by).bought++;
      g.q[0] = { k: 'rename', sq: h.sq, who: by };
      break;
    }
    case 'decline': {
      if (head?.k !== 'buy' || head.who !== by) fail('notNow');
      const h = head as Extract<Pending, { k: 'buy' }>;
      log(g, 'declined', { p: by, sq: h.sq });
      const auc = startAuction(g, h.sq);
      if (auc) { g.q[0] = auc; startNext(g); } else resolveHead(g, () => {});
      break;
    }
    case 'skip': {
      // house rule: pass on a free property; it stays with the bank and there is no auction
      if (head?.k !== 'buy' || head.who !== by || !g.rules.allowPass) fail('notNow');
      const h = head as Extract<Pending, { k: 'buy' }>;
      log(g, 'skipped', { p: by, sq: h.sq });
      resolveHead(g, () => {});
      break;
    }
    case 'bid': {
      if (head?.k !== 'auction' || g.rules.auction !== 'open') fail('notNow');
      const h = head as Extract<Pending, { k: 'auction' }>;
      if (!h.eligible.includes(by) || h.passed.includes(by)) fail('notNow');
      if (a.amount <= h.high || !Number.isInteger(a.amount)) fail('bidLow');
      if (a.amount > me!.cash) fail('noCash');
      h.high = a.amount; h.bidder = by;
      log(g, 'bid', { p: by, n: a.amount });
      startNext(g);
      break;
    }
    case 'pass': {
      if (head?.k !== 'auction' || g.rules.auction !== 'open') fail('notNow');
      const h = head as Extract<Pending, { k: 'auction' }>;
      if (!h.eligible.includes(by) || h.passed.includes(by) || h.bidder === by) fail('notNow');
      h.passed.push(by);
      log(g, 'passed', { p: by });
      startNext(g);
      break;
    }
    case 'sealed': {
      if (head?.k !== 'auction' || g.rules.auction !== 'sealed') fail('notNow');
      const h = head as Extract<Pending, { k: 'auction' }>;
      if (!h.eligible.includes(by) || by in h.sealed) fail('notNow');
      const amt = Math.floor(a.amount);
      if (amt < 0 || amt > me!.cash) fail('noCash');
      h.sealed[by] = amt;
      log(g, 'sealedBid', { p: by });
      startNext(g);
      break;
    }
    case 'cardOk': {
      if (head?.k !== 'card' || head.who !== by) fail('notNow');
      const card = g.cards[(head as Extract<Pending, { k: 'card' }>).card];
      log(g, 'card', { p: by, c: card.id });
      resolveHead(g, () => applyCard(g, me!, card));
      break;
    }
    case 'rename': case 'skipRename': {
      if (head?.k !== 'rename' || head.who !== by) fail('notNow');
      const sq = (head as Extract<Pending, { k: 'rename' }>).sq;
      if (a.t === 'rename') {
        const name = a.name.trim().slice(0, 32);
        if (name) { g.names[sq] = name; log(g, 'renamed', { p: by, sq }); }
      }
      resolveHead(g, () => {});
      break;
    }
    case 'build': if (!canManage(g, by)) fail('notNow'); build(g, by, a.sq); break;
    case 'sell': if (!canManage(g, by)) fail('notNow'); sell(g, by, a.sq); break;
    case 'mortgage': if (!canManage(g, by)) fail('notNow'); mortgage(g, by, a.sq); break;
    case 'unmortgage': if (!canManage(g, by)) fail('notNow'); unmortgage(g, by, a.sq); break;
    case 'payDebt': {
      if (head?.k !== 'debt' || head.who !== by) fail('notNow');
      const h = head as Extract<Pending, { k: 'debt' }>;
      const total = h.owed.reduce((s, o) => s + o.amount, 0);
      if (me!.cash < total) fail('noCash');
      resolveHead(g, () => charge(g, by, h.owed, h.then));
      break;
    }
    case 'bankrupt': {
      if (head?.k !== 'debt' || head.who !== by) fail('notNow');
      const h = head as Extract<Pending, { k: 'debt' }>;
      const players = h.owed.filter((o) => o.to !== 'bank' && o.to !== 'pot');
      const creditor = players.length === 1 && h.owed.length === 1 ? players[0].to : null;
      g.q.shift();
      bankrupt(g, by, creditor);
      break;
    }
    case 'endTurn': {
      if (!isCur || head || g.trade || !g.rolled || g.again) fail('notNow');
      advance(g);
      break;
    }
    case 'propose': {
      if (!isCur || head || g.trade) fail('notNow');
      if (a.trade.from !== by) fail('notNow');
      validateTrade(g, a.trade);
      g.trade = a.trade;
      log(g, 'proposed', { p: by, o: a.trade.to });
      break;
    }
    case 'accept': {
      if (!g.trade || g.trade.to !== by) fail('notNow');
      executeTrade(g, g.trade);
      g.trade = null;
      break;
    }
    case 'reject': {
      if (!g.trade || g.trade.to !== by) fail('notNow');
      log(g, 'rejected', { p: by });
      g.trade = null;
      break;
    }
    case 'counter': {
      if (!g.trade || g.trade.to !== by) fail('notNow');
      if (a.trade.from !== by || a.trade.to !== g.trade.from) fail('notNow');
      validateTrade(g, a.trade);
      g.trade = a.trade;
      log(g, 'countered', { p: by });
      break;
    }
    case 'cancelTrade': {
      if (!g.trade || g.trade.from !== by) fail('notNow');
      g.trade = null;
      break;
    }
    case 'addPlayer': {
      if (by !== 'host') fail('notNow');
      const np = a.player;
      if (!np || !np.id || g.players.some((x) => x.id === np.id)) fail('notNow');
      if (g.players.filter((x) => !x.out).length >= 10) fail('tooMany');
      const b = board(g);
      g.players.push({
        id: np.id, name: String(np.name).trim().slice(0, 24) || '?', color: np.color, emoji: np.emoji, device: np.device,
        cash: startCashOf(g.rules, b.startCash), pos: 0, jail: false, jailTries: 0, jailCards: [], out: false, lapped: false,
      });
      log(g, 'joined', { p: np.id });
      break;
    }
    case 'kick': {
      if (by !== 'host') fail('notNow');
      const target = pl(g, a.id);
      if (target.out) fail('notNow');
      log(g, 'kicked', { p: a.id });
      bankrupt(g, a.id, null);
      break;
    }
  }
  g.v++;
  return g;
}

/** what an absent player does automatically */
export function autoAction(g: Game, id: string): Action | null {
  if (!waiting(g).includes(id)) return null;
  const h = g.q[0];
  const p = pl(g, id);
  if (h) {
    switch (h.k) {
      case 'buy': return g.rules.allowPass ? { t: 'skip' } : { t: 'decline' };
      case 'card': return { t: 'cardOk' };
      case 'rename': return { t: 'skipRename' };
      case 'auction': return g.rules.auction === 'sealed' ? { t: 'sealed', amount: 0 } : { t: 'pass' };
      case 'debt': {
        const total = h.owed.reduce((s, o) => s + o.amount, 0);
        if (p.cash >= total) return { t: 'payDebt' };
        const mine = ownedBy(g, id);
        const withHouses = mine.filter((sq) => g.props[sq].houses > 0)
          .sort((x, y) => g.props[y].houses - g.props[x].houses);
        for (const sq of withHouses) {
          if (!groupOf(g, sq).some((m) => g.props[m].houses > g.props[sq].houses)) return { t: 'sell', sq };
        }
        const m = mine.find((sq) => !g.props[sq].mort && !groupHasBuildings(g, sq));
        if (m !== undefined) return { t: 'mortgage', sq: m };
        return { t: 'bankrupt' };
      }
    }
  }
  if (g.trade) return { t: 'reject' };
  if (p.jail && !g.rolled && p.jailCards.length) return { t: 'useCard' };
  if (!g.rolled || g.again) return { t: 'roll' };
  return { t: 'endTurn' };
}

/** display name of a square for a language */
export function sqName(g: Game, sq: number, lang: 'el' | 'en'): string {
  return g.names[sq] || defaultName(g.boardId, g.city, g.nameMap, sq, lang);
}
