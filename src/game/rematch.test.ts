import { describe, expect, it } from 'vitest';
import { apply, newGame } from './engine';
import { lookUnique, setupFromGame } from './rematch';
import type { Setup } from './types';

const base: Setup = {
  boardId: 'classic', names: [], city: 'thessaloniki', prices: { 1: 90 },
  customCards: [{ deck: 'chance', text: 'Bonus', fx: { t: 'money', amount: 50 } }],
  players: [
    { id: 'a', name: 'A', color: '#e5484d', emoji: '🚗', device: 'd1' },
    { id: 'b', name: 'B', color: '#30a46c', emoji: '🎩', device: 'd2' },
  ],
  rules: { auction: 'open', freeParking: true, doubleGo: false, noRentInJail: false, buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 60, underdog: true },
};

describe('rematch', () => {
  it('takes the players and every setting from the game that ended, including someone who joined during it', () => {
    let g = newGame(base, 1, 0);
    g = apply(g, 'host', { t: 'addPlayer', player: { id: 'c', name: 'C', color: '#0090ff', emoji: '🐶', device: 'd3' } }, 0);
    const s = setupFromGame(g);
    expect(s.players.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(s.players[2]).toEqual({ id: 'c', name: 'C', color: '#0090ff', emoji: '🐶', device: 'd3' });
    expect(s.city).toBe('thessaloniki');
    expect(s.prices).toEqual({ 1: 90 });
    expect(s.rules.underdog).toBe(true);
    expect(s.customCards).toEqual(base.customCards);
    // and a new game from it is a fresh start with the same cards
    const again = newGame(s, 2, 0);
    expect(again.cards.length).toBe(g.cards.length);
    expect(again.players.every((p) => p.pos === 0 && !p.out)).toBe(true);
  });

  it('a spectator who joins keeps their look unless it is taken', () => {
    const others = base.players;
    expect(lookUnique({ id: 'x', name: 'X', color: '#8e4ec6', emoji: '🦉', device: 'd9' }, others)).toMatchObject({ color: '#8e4ec6', emoji: '🦉' });
    const clash = lookUnique({ id: 'x', name: 'X', color: '#e5484d', emoji: '🚗', device: 'd9' }, others);
    expect(others.map((o) => o.color)).not.toContain(clash.color);
    expect(others.map((o) => o.emoji)).not.toContain(clash.emoji);
  });
});
