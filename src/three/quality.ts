/*
 * Graphics quality for the 3D board. 'auto' starts at the top and steps down (never up) when the
 * board can't keep up; the player can also pick a level in the settings.
 * No three.js here, so the settings screens can use it without loading the 3D code.
 */

export type GfxLevel = 'high' | 'medium' | 'low';
export type GfxQuality = 'auto' | GfxLevel;
export const GFX_QUALITIES: GfxQuality[] = ['auto', 'high', 'medium', 'low'];

export interface LevelSpec {
  /** most screen pixels per CSS pixel */
  dpr: number;
  shadows: boolean;
  shadowMap: number;
  /** largest board picture (the device may allow less) */
  tex: number;
}
export const LEVELS: Record<GfxLevel, LevelSpec> = {
  high: { dpr: 2, shadows: true, shadowMap: 1024, tex: 4096 },
  medium: { dpr: 1.5, shadows: true, shadowMap: 512, tex: 3072 },
  low: { dpr: 1, shadows: false, shadowMap: 512, tex: 2048 },
};
export const lower = (l: GfxLevel): GfxLevel => (l === 'high' ? 'medium' : 'low');

/** how long to measure, and the bar */
export const WINDOW_MS = 3000;
export const MIN_FPS = 40;
/** frames needed before deciding (a very slow board gives only a few in the window) */
export const MIN_FRAMES = 5;
/** a gap this long means the app was paused (hidden, phone locked), not slow */
export const PAUSE_MS = 2000;

/**
 * Is the board struggling, judging by the time between frames (ms) over a few seconds?
 * Below 40 fps with uneven frames means real overload. A steady 30 fps is a screen or
 * battery-saver limit, not overload, so the quality stays (unless it is really low, under 27).
 */
export function struggling(intervals: number[]): boolean {
  if (intervals.length < MIN_FRAMES) return false;
  const mean = intervals.reduce((s, x) => s + x, 0) / intervals.length;
  const fps = 1000 / mean;
  if (fps >= MIN_FPS) return false;
  if (fps < 27) return true;
  const sd = Math.sqrt(intervals.reduce((s, x) => s + (x - mean) ** 2, 0) / intervals.length);
  return sd > 4;
}

export const cleanQuality = (q: unknown): GfxQuality => (GFX_QUALITIES.includes(q as GfxQuality) ? (q as GfxQuality) : 'auto');
