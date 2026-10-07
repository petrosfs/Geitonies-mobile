import type { Board, Crisis, CustomRule, Quake, RuleDo, RuleWhen, RuleWho, Rules, WealthTax } from './types';

/* Upset rules: defaults, limits and cleaning (settings come from other phones too). */

export const DEFAULT_WEALTH_TAX: WealthTax = { every: 5, pct: 10, who: 'leader' };
export const DEFAULT_CRISIS: Crisis = { every: 8, house: 25, hotel: 100 };
export const DEFAULT_QUAKE: Quake = { every: 10 };
export const MAX_CUSTOM_RULES = 10;
export const RULE_TEXT_MAX = 80;

const int = (v: unknown, lo: number, hi: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def;
};
/** money in 10 € steps (5 € for amounts per house/hotel) */
const money = (v: unknown, lo: number, hi: number, def: number, step = 10) => int(Math.round(Number(v) / step) * step, lo, hi, def);

export function cleanWealthTax(w: WealthTax | undefined): WealthTax | undefined {
  if (!w) return undefined;
  return { every: int(w.every, 1, 50, 5), pct: int(w.pct, 1, 50, 10), who: w.who === 'above' ? 'above' : 'leader' };
}
export function cleanCrisis(c: Crisis | undefined): Crisis | undefined {
  if (!c) return undefined;
  return { every: int(c.every, 1, 50, 8), house: money(c.house, 0, 1000, 25, 5), hotel: money(c.hotel, 0, 5000, 100, 5) };
}
export function cleanQuake(q: Quake | undefined): Quake | undefined {
  if (!q) return undefined;
  return { every: int(q.every, 1, 50, 10) };
}

const WHO: RuleWho[] = ['self', 'all', 'leader', 'last'];

export function cleanCustomRule(r: CustomRule, b: Board): CustomRule | null {
  if (!r || typeof r !== 'object') return null;
  const text = String(r.text ?? '').trim().slice(0, RULE_TEXT_MAX);
  let when: RuleWhen;
  const w = r.when;
  if (w?.t === 'rounds') when = { t: 'rounds', n: int(w.n, 1, 50, 5) };
  else if (w?.t === 'go') when = { t: 'go' };
  else if (w?.t === 'land' && Number.isInteger(w.sq) && w.sq >= 0 && w.sq < b.squares.length) when = { t: 'land', sq: w.sq };
  else return null;
  const who: RuleWho = WHO.includes(r.who) ? r.who : 'self';
  let what: RuleDo;
  const d = r.what;
  switch (d?.t) {
    case 'money': what = { t: 'money', amount: money(d.amount, -5000, 5000, 0) }; if (!what.amount) return null; break;
    case 'pct': what = { t: 'pct', pct: int(d.pct, 1, 50, 10) }; break;
    case 'repairs': what = { t: 'repairs', house: money(d.house, 0, 1000, 25, 5), hotel: money(d.hotel, 0, 5000, 100, 5) }; break;
    case 'jail': what = { t: 'jail' }; break;
    case 'loseHouse': what = { t: 'loseHouse' }; break;
    default: return null;
  }
  return { text, when, who, what };
}

/** the upset rules of a game, cleaned (unknown or out-of-range values fixed, broken custom rules dropped) */
export function cleanHouseRules(r: Rules, b: Board): Rules {
  const out: Rules = { ...r };
  for (const k of ['wealthTax', 'crisis', 'quake', 'custom', 'underdog'] as const) delete out[k];
  const wt = cleanWealthTax(r.wealthTax); if (wt) out.wealthTax = wt;
  const cr = cleanCrisis(r.crisis); if (cr) out.crisis = cr;
  const qk = cleanQuake(r.quake); if (qk) out.quake = qk;
  if (r.underdog) out.underdog = true;
  const custom = (Array.isArray(r.custom) ? r.custom : [])
    .slice(0, MAX_CUSTOM_RULES)
    .map((c) => cleanCustomRule(c, b))
    .filter((c): c is CustomRule => c !== null);
  if (custom.length) out.custom = custom;
  return out;
}

/** does this round (the one just starting) fire a rule that comes every `every` rounds? */
export const firesAt = (round: number, every: number) => every > 0 && round > 1 && (round - 1) % every === 0;
