import { money, tr } from './i18n';
import type { CustomRule, Lang, RuleDo, Rules } from './game/types';

/* Words for the upset rules (setup, rules sheet, history). */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** where fees go in this game: the Parking pot or the bank */
export const feeTo = (lang: Lang, r: Rules) => tr(lang, r.freeParking ? 'toParking' : 'toBank');

/** what a rule does; `many` for the plural ("everyone pay" in Greek) */
export function whatText(lang: Lang, d: RuleDo, many = false): string {
  const m = (n: number) => money(lang, n);
  const k = many ? 'doDp_' : 'doD_';
  switch (d.t) {
    case 'money': return d.amount >= 0 ? tr(lang, k + 'gain', { n: m(d.amount) }) : tr(lang, k + 'pay', { n: m(-d.amount) });
    case 'pct': return tr(lang, k + 'pct', { p: d.pct });
    case 'repairs': return tr(lang, k + 'repairs', { h: m(d.house), H: m(d.hotel) });
    default: return tr(lang, k + d.t);
  }
}

/** "Every 5 rounds: the richest player pays 10 % of their net worth." */
export function customRuleText(lang: Lang, r: CustomRule, sqLabel: (sq: number) => string): string {
  const w = r.when;
  const when = w.t === 'rounds' ? tr(lang, 'whenD_rounds', { n: w.n }) : w.t === 'land' ? tr(lang, 'whenD_land', { sq: sqLabel(w.sq) }) : tr(lang, 'whenD_go');
  return cap(tr(lang, 'ruleLine', { when, who: tr(lang, 'who_' + r.who), what: whatText(lang, r.what, r.who === 'all') }));
}

/** the rule's name if it has one, else what it does */
export const ruleTitle = (lang: Lang, r: CustomRule, sqLabel: (sq: number) => string) =>
  r.text.trim() || customRuleText(lang, r, sqLabel);

export function wealthTaxText(lang: Lang, r: Rules): string {
  const w = r.wealthTax;
  if (!w) return '';
  return tr(lang, 'u_wealthTaxDesc_' + w.who, { e: w.every, p: w.pct, to: feeTo(lang, r) });
}

/** one line per built-in upset rule that is on */
export function upsetLines(lang: Lang, r: Rules): string[] {
  const m = (n: number) => money(lang, n);
  const out: string[] = [];
  if (r.wealthTax) {
    out.push('💰 ' + wealthTaxText(lang, r));
  }
  if (r.underdog) out.push('🆙 ' + tr(lang, 'u_underdog'));
  if (r.crisis) out.push('📉 ' + tr(lang, 'u_crisisDesc', { e: r.crisis.every, h: m(r.crisis.house), H: m(r.crisis.hotel), to: feeTo(lang, r) }));
  if (r.quake) out.push('🌋 ' + tr(lang, 'u_quakeDesc', { e: r.quake.every }));
  return out;
}
