import { useEffect } from 'react';
import { store } from './store';
import { Die } from './Board';
import { GameScreen } from './Game';
import { JoinScreen, LobbyScreen, SetupScreen } from './Setup';
import { useStore, useT } from './ui';
import { Modal } from './components';

const PREVIEW = !!import.meta.env.VITE_ARTIFACT;

function Home() {
  const { t } = useT();
  const s = useStore();
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
      </div>
      <div className="langs">
        <button className={s.lang === 'el' ? 'on' : ''} onClick={() => store.setLang('el')}>Ελληνικά</button>
        <button className={s.lang === 'en' ? 'on' : ''} onClick={() => store.setLang('en')}>English</button>
      </div>
      {!PREVIEW && <p className="muted small center install">{t('installHint')}</p>}
    </div>
  );
}

export default function App() {
  const s = useStore();
  const { t } = useT();
  useEffect(() => {
    if (!PREVIEW && new URLSearchParams(location.search).get('join')) store.openJoin();
  }, []);
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
  else if (s.screen === 'game' && s.game) screen = <GameScreen key={s.room + s.game.boardId + (s.game.gid ?? '')} />;
  else screen = <Home />;

  return (
    <>
      {screen}
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
