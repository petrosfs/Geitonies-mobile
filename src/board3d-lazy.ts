import { preloadable } from './lazy';
import type { Board3D as Board3DType } from './Board3D';

/** the 3D board (three.js and the dice physics) comes in its own piece */
export const Board3D = preloadable<Parameters<typeof Board3DType>[0]>(() => import('./Board3D').then((m) => m.Board3D));
