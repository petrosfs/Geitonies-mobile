import type { Rules } from './types';

/*
 * Ready-made rule sets by how long the players want a game to last. The time limit is what keeps
 * the promise (when time is up, the round is finished and the richest player wins); the other
 * rules set the pace: less starting money and a periodic maintenance bill end games sooner,
 * Free Parking money, a wealth tax and the underdog bonus keep them open for longer.
 */
export type PresetId = 'quick' | 'normal' | 'long' | 'classic';
export const PRESET_IDS: PresetId[] = ['quick', 'normal', 'long', 'classic'];

const round50 = (n: number) => Math.round(n / 50) * 50;

/** the rules a preset sets (the others — auction type, automatic move — stay as the players chose) */
export function presetRules(id: PresetId, boardStartCash: number): Partial<Rules> {
  const off: Partial<Rules> = {
    freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false, allowPass: false,
    wealthTax: undefined, underdog: undefined, crisis: undefined, quake: undefined,
  };
  switch (id) {
    case 'quick':
      return { ...off, timeLimitMin: 30, startCash: round50((boardStartCash * 2) / 3), crisis: { every: 5, house: 25, hotel: 100 } };
    case 'normal':
      return { ...off, timeLimitMin: 60, startCash: undefined, crisis: { every: 8, house: 25, hotel: 100 } };
    case 'long':
      return {
        ...off, timeLimitMin: 90, startCash: undefined, freeParking: true, underdog: true,
        wealthTax: { every: 6, pct: 10, who: 'leader' },
      };
    case 'classic':
      return { ...off, timeLimitMin: 0, startCash: undefined };
  }
}

export function applyPreset(rules: Rules, id: PresetId, boardStartCash: number): Rules {
  const out = { ...rules, ...presetRules(id, boardStartCash) };
  for (const k of Object.keys(out) as (keyof Rules)[]) if (out[k] === undefined) delete out[k];
  return out;
}

/** which preset these rules are, if they are exactly one (else null: the players changed something) */
export function matchPreset(rules: Rules, boardStartCash: number): PresetId | null {
  const norm = (r: Partial<Rules>) => JSON.stringify({
    fp: !!r.freeParking, dg: !!r.doubleGo, nr: !!r.noRentInJail, bl: !!r.buyAfterLap, ap: !!r.allowPass,
    tl: r.timeLimitMin ?? 0, sc: r.startCash ?? boardStartCash,
    wt: r.wealthTax ?? null, ud: !!r.underdog, cr: r.crisis ?? null, qk: r.quake ?? null, cu: (r.custom ?? []).length,
  });
  const mine = norm(rules);
  return PRESET_IDS.find((id) => norm({ ...rules, ...presetRules(id, boardStartCash), custom: [] }) === mine) ?? null;
}
