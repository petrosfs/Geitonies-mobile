import { useEffect, useReducer } from 'react';

/*
 * The 3D piece pictures need three.js, which loads separately from the first screen.
 * Screens that show pieces wait for it before they open (see App.tsx), so a picture never
 * appears late; this hook is only a safety net.
 */
type Thumbs = typeof import('./three/thumbs');
let thumbs: Thumbs | null = null;
let loadingThumbs: Promise<void> | null = null;
const thumbWaiters = new Set<() => void>();
export function loadThumbs(): Promise<void> {
  loadingThumbs ??= import('./three/thumbs')
    .then((m) => { thumbs = m; thumbWaiters.forEach((f) => f()); })
    .catch(() => { loadingThumbs = null; }); // offline before it was cached: try again next time
  return loadingThumbs;
}
export function useThumbs(): Thumbs | null {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (thumbs) return;
    thumbWaiters.add(redraw);
    void loadThumbs();
    return () => { thumbWaiters.delete(redraw); };
  }, []);
  return thumbs;
}
