import { createElement, lazy, type ComponentType } from 'react';

/*
 * A screen whose code loads separately. Once its code has arrived (we fetch it in the background
 * early), it renders straight away like a normal component. Only if it is opened before then does
 * it wait (React.lazy), with the Suspense fallback. Plain React.lazy would always wait at least once
 * and React holds a fallback for ~300 ms, which would make the screen feel slower.
 */
export function preloadable<P extends object>(load: () => Promise<ComponentType<P>>) {
  let ready: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const preload = () => (pending ??= load()
    .then((c) => (ready = c))
    .catch((e: unknown) => { pending = null; throw e; })); // e.g. offline before it was cached: try again next time
  const Waiting = lazy(() => preload().then((c) => ({ default: c })));
  function Screen(props: P) {
    return ready ? createElement(ready, props) : createElement(Waiting as unknown as ComponentType<P>, props);
  }
  return Object.assign(Screen, { preload });
}
