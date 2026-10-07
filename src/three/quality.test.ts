import { describe, expect, it } from 'vitest';
import { cleanQuality, lower, struggling } from './quality';

const steady = (ms: number, n = 90) => Array.from({ length: n }, () => ms);
// a fixed pseudo-random wobble, so the test is the same every time
const uneven = (mean: number, spread: number, n = 90) => Array.from({ length: n }, (_, i) => mean + spread * Math.sin(i * 2.399));

describe('graphics quality', () => {
  it('a smooth 60 fps board keeps its quality', () => {
    expect(struggling(steady(16.7))).toBe(false);
    expect(struggling(uneven(18, 6))).toBe(false); // ~55 fps with hiccups
  });
  it('a screen locked at 30 fps (battery saver) is not overload', () => {
    expect(struggling(steady(33.3))).toBe(false);
    expect(struggling(uneven(33.3, 1))).toBe(false);
  });
  it('uneven frames under 40 fps, or anything under 27 fps, steps down', () => {
    expect(struggling(uneven(30, 12))).toBe(true);
    expect(struggling(steady(45))).toBe(true); // 22 fps
  });
  it('too few frames: no decision yet; a very slow board decides with a few', () => {
    expect(struggling(steady(60, 4))).toBe(false);
    expect(struggling(steady(700, 5))).toBe(true); // 1.4 fps (software 3D)
  });
  it('levels go down and stop at low; unknown settings mean auto', () => {
    expect(lower('high')).toBe('medium');
    expect(lower('medium')).toBe('low');
    expect(lower('low')).toBe('low');
    expect(cleanQuality('ultra')).toBe('auto');
    expect(cleanQuality('low')).toBe('low');
  });
});
