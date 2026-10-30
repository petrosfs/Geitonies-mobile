import { COLORS } from '../colors';
import { PIECES } from '../three/piece-list';
import type { CustomCard, Game, PlayerSetup, Setup } from './types';

/*
 * A rematch takes its players and settings from the game that just ended, not from the setup screen:
 * players who joined during the game are in it, and a player who took over as host (and never saw the
 * setup) has everything they need.
 */
export function setupFromGame(g: Game): Setup {
  const customCards: CustomCard[] = g.cards
    .filter((c) => typeof c.text === 'string') // the built-in cards are bilingual, the players' own are plain text
    .map((c) => ({ deck: c.deck, text: c.text as string, fx: c.fx }));
  return {
    players: g.players.map(({ id, name, color, emoji, device }) => ({ id, name, color, emoji, device })),
    boardId: g.boardId,
    names: g.names,
    city: g.city,
    nameMap: g.nameMap,
    prices: g.prices,
    customCards,
    rules: g.rules,
  };
}

/** the first colour nobody in `taken` has (or `want` if it is free) */
export function freeColor(want: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(want)) return want;
  return COLORS.find((c) => !used.has(c)) ?? want;
}

/** no two players with the same colour: whoever came first keeps it, the others get a free one */
export function uniqueColors<T extends { color: string }>(players: T[]): T[] {
  const used: string[] = [];
  return players.map((p) => {
    const color = freeColor(p.color, used);
    used.push(color);
    return color === p.color ? p : { ...p, color };
  });
}

/** a player joining the line-up keeps their colour and piece unless someone already has them */
export function lookUnique(p: PlayerSetup, others: PlayerSetup[]): PlayerSetup {
  const colors = new Set(others.map((o) => o.color));
  const pieces = new Set(others.map((o) => o.emoji));
  return {
    ...p,
    color: colors.has(p.color) ? COLORS.find((c) => !colors.has(c)) ?? p.color : p.color,
    emoji: pieces.has(p.emoji) ? PIECES.find((e) => !pieces.has(e)) ?? p.emoji : p.emoji,
  };
}
