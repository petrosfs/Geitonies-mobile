import { describe, expect, it } from 'vitest';
import { apply, newGame, RuleError } from './engine';
import { uniqueColors } from './rematch';
import type { Setup } from './types';

const setup = (colors: string[]): Setup => ({
  boardId: 'classic', names: [], customCards: [],
  players: colors.map((color, i) => ({ id: 'p' + i, name: 'P' + i, color, emoji: '🎩', device: 'd' + i })),
  rules: { auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false, buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 60 },
});

describe('one colour per player', () => {
  it('a game never starts with two players of the same colour (the first keeps it)', () => {
    const g = newGame(setup(['#e5484d', '#e5484d', '#30a46c', '#30a46c']), 1, 0);
    const colors = g.players.map((p) => p.color);
    expect(new Set(colors).size).toBe(4);
    expect(colors[0]).toBe('#e5484d');
    expect(colors[2]).toBe('#30a46c');
    expect(uniqueColors([{ color: 'a' }, { color: 'b' }])).toEqual([{ color: 'a' }, { color: 'b' }]);
  });

  it('someone joining during the game gets a free colour if theirs is taken', () => {
    let g = newGame(setup(['#e5484d', '#30a46c']), 1, 0);
    g = apply(g, 'host', { t: 'addPlayer', player: { id: 'n', name: 'N', color: '#e5484d', emoji: '🐶', device: 'dn' } }, 0);
    expect(new Set(g.players.map((p) => p.color)).size).toBe(3);
  });

  it('a player can change colour during the game, only to a free one', () => {
    let g = newGame(setup(['#e5484d', '#30a46c']), 1, 0);
    g = apply(g, 'p1', { t: 'setColor', color: '#0090ff' }, 0); // not their turn: still fine
    expect(g.players[1].color).toBe('#0090ff');
    expect(g.log.at(-1)?.k).toBe('recolored');
    expect(() => apply(g, 'p1', { t: 'setColor', color: '#e5484d' }, 0)).toThrow(RuleError);
    expect(() => apply(g, 'p1', { t: 'setColor', color: 'pink' }, 0)).toThrow(RuleError);
  });
});
