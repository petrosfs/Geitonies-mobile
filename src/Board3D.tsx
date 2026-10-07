import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Scene3D } from './three/scene';
import type { Game } from './game/types';
import { useStore, useT } from './ui';
import { store } from './store';

export function Board3D(props: Parameters<typeof Board3DInner>[0]) {
  // if the phone drops the 3D context, start a fresh scene
  const [gen, setGen] = useState(0);
  return <Board3DInner key={gen} {...props} onLost={() => setGen((n) => n + 1)} />;
}

function Board3DInner({ g, onSquare, onBusy, overlay, onLost }: {
  g: Game;
  onSquare: (sq: number) => void;
  onBusy: (b: boolean) => void;
  overlay?: ReactNode;
  onLost?: () => void;
}) {
  const s = useStore();
  const { t } = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const cb = useRef({ onSquare, onBusy, onLost });
  cb.current = { onSquare, onBusy, onLost };
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    const sc = new Scene3D(hostRef.current!, {
      onSquare: (i) => cb.current.onSquare(i),
      onBusy: (b) => cb.current.onBusy(b),
      onFollow: setFollow,
      onLost: () => cb.current.onLost?.(),
      onQuality: (l) => store.setGfxNow(l),
    });
    sc.setQuality(store.get().fx.quality ?? 'auto');
    sceneRef.current = sc;
    // redraw text once the web font is ready
    document.fonts?.ready.then(() => { sceneRef.current?.update({ ...g }, s.lang, s.photos); });
    return () => { cb.current.onBusy(false); sc.dispose(); sceneRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { sceneRef.current?.update(g, s.lang, s.photos); }, [g, s.lang, s.photos]);
  useEffect(() => { sceneRef.current?.setFx(s.fx.sound, s.fx.vibrate, s.fx.cinema); }, [s.fx.sound, s.fx.vibrate, s.fx.cinema]);
  useEffect(() => { sceneRef.current?.setLight(s.fx.light ?? 'normal'); }, [s.fx.light]);
  useEffect(() => { sceneRef.current?.setQuality(s.fx.quality ?? 'auto'); }, [s.fx.quality]);

  return (
    <div className="board3d">
      <div ref={hostRef} className="board3d-canvas" />
      {overlay}
      {!follow && (
        <button className="btn small recenter" onClick={() => sceneRef.current?.recenter()} aria-label={t('recenter')}>🎯</button>
      )}
    </div>
  );
}
