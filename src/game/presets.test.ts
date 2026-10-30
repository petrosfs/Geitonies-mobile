import { describe, expect, it } from 'vitest';
import { applyPreset, matchPreset, PRESET_IDS } from './presets';
import { cleanHouseRules } from './houserules';
import { BOARDS } from './boards';
import type { Rules } from './types';

const base: Rules = { auction: 'sealed', freeParking: true, doubleGo: true, noRentInJail: false, buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 120 };

describe('rule presets by game length', () => {
  it('each preset sets its rules, keeps the auction type and automatic move, and is recognised', () => {
    for (const id of PRESET_IDS) {
      const r = applyPreset(base, id, 1500);
      expect(r.auction).toBe('sealed');
      expect(r.autoMoveSec).toBe(120);
      expect(matchPreset(r, 1500)).toBe(id);
      // what a preset sets survives the cleaning a game applies
      expect(cleanHouseRules(r, BOARDS.classic)).toEqual(r);
    }
  });

  it('shorter games: a time limit, less starting money; longer ones: catch-up rules', () => {
    const quick = applyPreset(base, 'quick', 1500);
    expect(quick).toMatchObject({ timeLimitMin: 30, startCash: 1000, freeParking: false, doubleGo: false });
    expect(quick.crisis).toBeTruthy();
    expect(applyPreset(base, 'quick', 2000).startCash).toBe(1350);
    const long = applyPreset(base, 'long', 1500);
    expect(long).toMatchObject({ timeLimitMin: 90, freeParking: true, underdog: true });
    expect(long.startCash).toBeUndefined();
    expect(applyPreset(base, 'classic', 1500)).toEqual({ auction: 'sealed', freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false, allowPass: false, timeLimitMin: 0, autoMoveSec: 120 });
  });

  it('a change by the players means no preset any more', () => {
    const r = { ...applyPreset(base, 'normal', 1500), timeLimitMin: 45 };
    expect(matchPreset(r, 1500)).toBeNull();
  });
});
