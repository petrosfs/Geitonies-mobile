import { describe, expect, it } from 'vitest';
import { BOARDS } from './boards';
import { CITIES, CITY_IDS, cityName, validNameMap } from './cities';
import { newGame, sqName } from './engine';
import type { BoardId, CityId, Setup } from './types';

const setup = (boardId: BoardId, city?: CityId, nameMap?: number[]): Setup => ({
  boardId, city, nameMap, names: [], customCards: [],
  players: [0, 1].map((i) => ({ id: 'p' + i, name: 'P' + i, color: '#000', emoji: '🎩', device: 'd' })),
  rules: { auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 60 },
});

describe('city name sets', () => {
  it('every city has 11 groups (2,3,…,3,2), 6 stations, and no repeated names', () => {
    for (const id of CITY_IDS) {
      const c = CITIES[id];
      expect(c.streets.map((g) => g.length)).toEqual([2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 2]);
      expect(c.stations.length).toBe(6);
      const all = [...c.streets.flat(), ...c.stations];
      for (const [el, en] of all) { expect(el.trim()).not.toBe(''); expect(en.trim()).not.toBe(''); }
      expect(new Set(all.map((n) => n[0])).size, id).toBe(all.length);
    }
  });

  it('every street and station gets a city name on both boards; Athens matches the original board', () => {
    for (const boardId of ['classic', 'large'] as const) {
      const b = BOARDS[boardId];
      b.squares.forEach((sq, i) => {
        expect(cityName('athens', boardId, i, 'el')).toBe(sq.name.el);
        if (sq.kind === 'street') expect(cityName('thessaloniki', boardId, i, 'el')).not.toBe(sq.name.el);
      });
    }
    expect(cityName('patras', 'classic', 1, 'el')).toBe('Ζαρουχλέικα');
    expect(cityName('thessaloniki', 'classic', 39, 'en')).toBe('Aristotelous Square');
  });

  it('a game uses its city, and names moved between squares (Glyfada to the blue group)', () => {
    const b = BOARDS.classic;
    const glyfada = b.squares.findIndex((s) => s.name.el === 'Γλυφάδα');
    const map = b.squares.map((_, i) => i);
    [map[glyfada], map[39]] = [map[39], map[glyfada]];
    const g = newGame(setup('classic', 'athens', map), 1, 0);
    expect(sqName(g, 39, 'el')).toBe('Γλυφάδα');
    expect(b.groups[b.squares[39].group!].color).toBe('#2c4fae'); // the blue group
    expect(sqName(g, glyfada, 'el')).toBe('Πλάκα');
    const t = newGame(setup('large', 'thessaloniki'), 1, 0);
    expect(sqName(t, 1, 'el')).toBe('Μενεμένη');
    expect(newGame(setup('classic'), 1, 0).city).toBe('athens'); // default stays Athens
  });

  it('a name map that mixes kinds of squares is ignored', () => {
    const map = BOARDS.classic.squares.map((_, i) => i);
    [map[1], map[5]] = [map[5], map[1]]; // a street with a station
    expect(validNameMap('classic', map)).toBeUndefined();
    expect(validNameMap('classic', [1, 2, 3])).toBeUndefined();
  });
});
