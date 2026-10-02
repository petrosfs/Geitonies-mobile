/* Where each square sits on the board grid (shared by the 2D and 3D boards). */

/** grid position (1-based row/col) of square i on a board with s squares per side */
export function cellPos(i: number, s: number): { row: number; col: number; side: 'b' | 'l' | 't' | 'r' } {
  if (i <= s) return { row: s + 1, col: s + 1 - i, side: 'b' };
  if (i <= 2 * s) return { row: s + 1 - (i - s), col: 1, side: 'l' };
  if (i <= 3 * s) return { row: 1, col: 1 + (i - 2 * s), side: 't' };
  return { row: 1 + (i - 3 * s), col: s + 1, side: 'r' };
}
