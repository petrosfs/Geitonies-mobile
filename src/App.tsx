import { Component, Suspense, useEffect, useState, type ReactNode } from 'react';
import { preloadable } from './lazy';
import { Board3D } from './board3d-lazy';
import { store } from './store';
import { Die } from './Board';
import { APP_VERSION_TEXT, useStore, useT } from './ui';
import { Modal } from './components';
import { loadThumbs } from './thumbs-loader';

/*
 * The first screen loads on its own; the rest (setup, game, the 3D board, rules) come in separate
 * pieces, fetched in the background right after the home screen appears. Screens with piece
 * pictures open only once those pictures can be drawn.
 */
const withThumbs = <T,>(p: Promise<T>) => Promise.all([p, loadThumbs()]).then(([m]) => m);
const SetupScreen = preloadable(() => withThumbs(import('./Setup')).then((m) => m.SetupScreen));
const JoinScreen = preloadable(() => withThumbs(import('./Setup')).then((m) => m.JoinScreen));
const LobbyScreen = preloadable(() => withThumbs(import('./Setup')).then((m) => m.LobbyScreen));
const LateJoinScreen = preloadable(() => withThumbs(import('./Setup')).then((m) => m.LateJoinScreen));
// with 3D on, the game screen opens together with its 3D board
const GameScreen = preloadable(() =>
  withThumbs(Promise.all([import('./Game'), store.get().fx.gfx === '3d' ? Board3D.preload() : null]).then(([m]) => m.GameScreen)));
const RulesSheet = preloadable(() => import('./Rules').then((m) => m.RulesSheet));

/** fetch the other screens right away, while the player looks at the home screen (in the order they are needed) */
function prefetch() {
  const quiet = (p: Promise<unknown>) => { p.catch(() => { /* tried again when the screen opens */ }); };
  [SetupScreen, JoinScreen, LobbyScreen, LateJoinScreen, GameScreen, RulesSheet].forEach((c) => quiet(c.preload()));
  if (store.get().fx.gfx === '3d') quiet(Board3D.preload());
}

/*
 * A piece of the app couldn't be fetched (offline before it was saved, or a new version replaced the
 * files while this one was open). Reload once by itself (the game is saved), else offer a button.
 */
const RELOAD_KEY = 'gtn-chunk-reload';
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return false; // just tried: don't loop
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { return false; }
  location.reload();
  return true;
}
if (typeof window !== 'undefined') window.addEventListener('vite:preloadError', (e) => { if (reloadOnce()) e.preventDefault(); });

class LoadGuard extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { reloadOnce(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function LoadFailed() {
  const { t } = useT();
  return (
    <div className="screen center-screen">
      <p>{t('loadFailed')}</p>
      <button className="btn primary" onClick={() => location.reload()}>{t('reload')}</button>
    </div>
  );
}

function Loading() {
  return <div className="screen center-screen loading-screen" aria-busy="true"><span className="loading-dot" /></div>;
}

const PREVIEW = !!import.meta.env.VITE_ARTIFACT;

function Home() {
  const { t } = useT();
  const s = useStore();
  const [rules, setRules] = useState(false);
  return (
    <div className="screen home">
      <div className="hero">
        <div className="hero-dice" aria-hidden>
          <span className="hd a"><Die n={4} /></span><span className="hd b"><Die n={2} /></span>
        </div>
        <h1>{t('appName')}</h1>
        <p className="tagline">{t('tagline')}</p>
      </div>
      <div className="menu">
        {s.hasSave && <button className="btn primary wide" onClick={() => store.resume()}>{t('resume')}</button>}
        <button className={'btn wide ' + (s.hasSave ? '' : 'primary')} onClick={() => store.newLocal()}>{t('newLocal')}</button>
        {!PREVIEW && <button className="btn wide" onClick={() => store.newHost()}>{t('hostOnline')}</button>}
        {!PREVIEW && <button className="btn wide" onClick={() => store.openJoin()}>{t('joinOnline')}</button>}
        <button className="btn wide ghost-light" onClick={() => setRules(true)}>📖 {t('rules')}</button>
      </div>
      {rules && <Suspense fallback={null}><RulesSheet onClose={() => setRules(false)} /></Suspense>}
      <div className="langs">
        <button className={s.lang === 'el' ? 'on' : ''} onClick={() => store.setLang('el')}>Ελληνικά</button>
        <button className={s.lang === 'en' ? 'on' : ''} onClick={() => store.setLang('en')}>English</button>
      </div>
      {!PREVIEW && <p className="muted small center install">{t('installHint')}</p>}
      <p className="app-version">{APP_VERSION_TEXT}</p>
    </div>
  );
}

export default function App() {
  const s = useStore();
  const { t } = useT();
  useEffect(() => {
    if (!PREVIEW && new URLSearchParams(location.search).get('join')) store.openJoin();
    prefetch();
  }, []);
  // 3D turned on in the settings: fetch the 3D board before the game opens
  useEffect(() => { if (s.fx.gfx === '3d') Board3D.preload().catch(() => { /* tried again when the board opens */ }); }, [s.fx.gfx]);
  useEffect(() => { document.documentElement.lang = s.lang; document.title = t('appName'); }, [s.lang]); // eslint-disable-line react-hooks/exhaustive-deps

  let screen;
  if (s.kicked) {
    screen = (
      <div className="screen center-screen">
        <p>{t('kicked')}</p>
        <button className="btn primary" onClick={() => store.goHome()}>{t('leave')}</button>
      </div>
    );
  } else if (s.screen === 'setup') screen = <SetupScreen />;
  else if (s.screen === 'join') screen = <JoinScreen />;
  else if (s.screen === 'lobby') screen = <LobbyScreen />;
  else if (s.screen === 'latejoin') screen = <LateJoinScreen />;
  else if (s.screen === 'game' && s.game) screen = <GameScreen key={s.room + s.game.boardId + (s.game.gid ?? '')} />;
  else screen = <Home />;

  return (
    <>
      <LoadGuard key={s.screen} fallback={<LoadFailed />}><Suspense fallback={<Loading />}>{screen}</Suspense></LoadGuard>
      {s.ask && (
        <Modal onClose={() => store.closeAsk()}>
          <p className="big-q">{t(s.ask.key, s.ask.params)}</p>
          <div className="row">
            <button className="btn ghost grow" onClick={() => store.closeAsk()}>{t('no')}</button>
            <button className={'btn grow ' + (s.ask.danger ? 'danger' : 'primary')} onClick={() => { const f = s.ask!.onYes; store.closeAsk(); f(); }}>
              {t(s.ask.yes)}
            </button>
          </div>
        </Modal>
      )}
      {s.toast && <div className="toast" role="status">{s.toast.startsWith('#') ? s.toast.slice(1) : t(s.toast)}</div>}
    </>
  );
}
