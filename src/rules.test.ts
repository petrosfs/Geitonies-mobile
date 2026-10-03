import { describe, expect, it } from 'vitest';
import { BOARDS } from './game/boards';
import { fill, RULES, ruleValues } from './rules';

describe('rules text', () => {
  it('Greek and English have the same sections', () => {
    expect(RULES.en.map((s) => s.id)).toEqual(RULES.el.map((s) => s.id));
    RULES.el.forEach((s, i) => expect(RULES.en[i].details.length, s.id).toBe(s.details.length));
  });

  it('every amount is filled in, on both boards, and matches the board', () => {
    for (const id of ['classic', 'large'] as const) {
      const b = BOARDS[id];
      const v = ruleValues(b, (n) => n + ' €');
      for (const lang of ['el', 'en'] as const) {
        for (const s of RULES[lang]) {
          for (const text of [s.short, ...s.details]) expect(fill(text, v), `${lang}.${s.id}`).not.toMatch(/\{\w+\}/);
        }
      }
      expect(v.start).toBe(b.startCash + ' €');
      expect(v.salary).toBe('200 €');
      expect(v.fine).toBe('50 €');
      expect(v.squares).toBe(String(b.squares.length));
    }
  });
});
