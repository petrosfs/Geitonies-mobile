import { describe, expect, it } from 'vitest';
import { BOARDS } from './boards';

/*
 * The classic board must match the official classic game (US/euro editions; same numbers in €).
 * Prices: OEIS A060225. Rents/house costs: the standard title deeds.
 */
const OFFICIAL: [number, number[], number][] = [
  [60, [2, 10, 30, 90, 160, 250], 50], [60, [4, 20, 60, 180, 320, 450], 50],
  [100, [6, 30, 90, 270, 400, 550], 50], [100, [6, 30, 90, 270, 400, 550], 50], [120, [8, 40, 100, 300, 450, 600], 50],
  [140, [10, 50, 150, 450, 625, 750], 100], [140, [10, 50, 150, 450, 625, 750], 100], [160, [12, 60, 180, 500, 700, 900], 100],
  [180, [14, 70, 200, 550, 750, 950], 100], [180, [14, 70, 200, 550, 750, 950], 100], [200, [16, 80, 220, 600, 800, 1000], 100],
  [220, [18, 90, 250, 700, 875, 1050], 150], [220, [18, 90, 250, 700, 875, 1050], 150], [240, [20, 100, 300, 750, 925, 1100], 150],
  [260, [22, 110, 330, 800, 975, 1150], 150], [260, [22, 110, 330, 800, 975, 1150], 150], [280, [24, 120, 360, 850, 1025, 1200], 150],
  [300, [26, 130, 390, 900, 1100, 1275], 200], [300, [26, 130, 390, 900, 1100, 1275], 200], [320, [28, 150, 450, 1000, 1200, 1400], 200],
  [350, [35, 175, 500, 1100, 1300, 1500], 200], [400, [50, 200, 600, 1400, 1700, 2000], 200],
];

describe('the classic board matches the official game', () => {
  const b = BOARDS.classic;
  it('streets: prices, rents and house costs, in board order', () => {
    const streets = b.squares.filter((s) => s.kind === 'street');
    expect(streets.map((s) => [s.price, s.rent, s.house])).toEqual(OFFICIAL);
  });
  it('positions of the special squares', () => {
    const at = (k: string) => b.squares.map((s, i) => (s.kind === k ? i : -1)).filter((i) => i >= 0);
    expect(at('station')).toEqual([5, 15, 25, 35]);
    expect(at('utility')).toEqual([12, 28]);
    expect(at('chance')).toEqual([7, 22, 36]);
    expect(at('chest')).toEqual([2, 17, 33]);
    expect(at('tax')).toEqual([4, 38]);
    expect([b.squares[0].kind, b.squares[10].kind, b.squares[20].kind, b.squares[30].kind]).toEqual(['go', 'jail', 'parking', 'gotojail']);
  });
  it('stations, companies, taxes and money', () => {
    expect(b.squares.filter((s) => s.kind === 'station').map((s) => s.price)).toEqual([200, 200, 200, 200]);
    expect(b.squares.filter((s) => s.kind === 'utility').map((s) => s.price)).toEqual([150, 150]);
    expect(b.stationRent).toEqual([25, 50, 100, 200]);
    expect(b.utilMult).toEqual([4, 10]);
    expect(b.squares.filter((s) => s.kind === 'tax').map((s) => s.tax)).toEqual([200, 100]);
    expect([b.startCash, b.salary, b.jailFine, b.houses, b.hotels]).toEqual([1500, 200, 50, 32, 12]);
  });
});
