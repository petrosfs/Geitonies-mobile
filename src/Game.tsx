import { useEffect, useMemo, useRef, useState } from 'react';
import { Board3D } from './Board3D';
import { RulesSheet } from './Rules';
import { boardEvents, isUpset, turnCard, type BoardEvent } from './events';
import { ruleTitle } from './upsets-text';
import { ReportSheet } from './Report';
import { buzz, chime, fanfare, hasWebGL, kaching, listenShake, requestMotion, siren, taxSound, unlockAudio } from './fx';
import { CHAT_MAX, clampContrast, CONTRAST_MAX, CONTRAST_MIN, MANUAL_TAKEOVER_MS, store, TAKEOVER_MS } from './store';
import {
  bankStock, board, curP, hasMonopoly, netWorth, ownedBy, priceOf, rentFor, sqName, unmortgageCost, waiting,
} from './game/engine';
import type { Game, Offer, Pending, Player, Trade, PlayerSetup } from './game/types';
import { BoardView, Die } from './Board';
import { APP_VERSION_TEXT, cardText, groupColor, logText, playerName, useStore, useT } from './ui';
import { Avatar, Modal, PieceIcon } from './components';
import { pieceText } from './three/pieces';

type Sheet = 'none' | 'props' | 'players' | 'trade' | 'log' | 'chat';
type Auction = Extract<Pending, { k: 'auction' }>;

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(i); }, [ms]);
  return now;
}
const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function GameScreen() {
  const s = useStore();
  const { t, m, lang } = useT();
  const g = s.game!;
  const [sheetState, setSheet] = useState<Sheet>('none');
  const [info, setInfo] = useState<number | null>(null);
  const [counterOf, setCounterOf] = useState<Trade | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const use3d = useMemo(() => s.fx.gfx === '3d' && hasWebGL(), [s.fx.gfx]);

  const local = g.players.filter((p) => p.device === s.device && !p.out);
  const cur = curP(g);
  const w = waiting(g);
  const head = g.q[0];
  const openAuction = head?.k === 'auction' && g.rules.auction === 'open';
  const localWaiting = w.filter((id) => local.some((p) => p.id === id));
  const actor = openAuction ? null : localWaiting[0] ?? null;
  const [confirmed, setConfirmed] = useState<string | null>(local.length === 1 ? local[0].id : null);
  const needHandoff = !!actor && local.length > 1 && confirmed !== actor && !g.over && !busy;
  // no sheet stays open while the phone is being passed to someone else
  const sheet: Sheet = needHandoff ? 'none' : sheetState;
  const viewer = (actor && !needHandoff ? actor : null)
    ?? (confirmed && local.some((p) => p.id === confirmed) ? confirmed : null)
    ?? local[0]?.id ?? null;


  // "X goes to jail!" banner, shown once the 3D animation has finished
  const seqRef = useRef(g.logSeq ?? 0);
  const [calm, setCalm] = useState(true);
  const [jailQueue, setJailQueue] = useState<string[]>([]);
  const [rentQueue, setRentQueue] = useState<BoardEvent[]>([]);
  useEffect(() => {
    const seq = g.logSeq ?? 0;
    const fresh = Math.min(Math.max(0, seq - seqRef.current), g.log.length);
    seqRef.current = seq;
    const recent = g.log.slice(g.log.length - fresh);
    // a piece is about to move on the 3D board: hold the shown money until it gets there
    if (use3d && recent.some((e) => e.k === 'moved' || e.k === 'rolled')) setCalm(() => false);
    const names = recent.filter((e) => e.k === 'jailed').map((e) => playerName(g, String(e.a?.p)));
    if (names.length) { setCalm(() => false); setJailQueue((q) => [...q, ...names]); }
    const events = boardEvents(g, recent);
    if (events.length) { setCalm(() => false); setRentQueue((q) => [...q, ...events]); }
  }, [g, use3d]);
  // which roll the 3D board has finished showing: money and banners wait for the piece to arrive
  const rollsNow = g.rolls ?? 0;
  const [seenRolls, setSeenRolls] = useState(rollsNow);
  const rollsRef = useRef(rollsNow);
  useEffect(() => { rollsRef.current = rollsNow; }, [rollsNow]);
  const pendingMove = use3d && rollsNow !== seenRolls;
  useEffect(() => {
    if (!pendingMove) return;
    const id = window.setTimeout(() => setSeenRolls(rollsNow), 12000); // safety: never hold the money for ever
    return () => clearTimeout(id);
  }, [pendingMove, rollsNow]);
  // wait until the scene has been calm for a moment (the 3D animation starts one frame after the state changes)
  useEffect(() => {
    if (busy) return; // (calm was cleared when the animation started, in onBusy)
    const id = window.setTimeout(() => setCalm(true), use3d ? 350 : 0);
    return () => clearTimeout(id);
  }, [busy, use3d, g.v]);
  const jailNow = calm && !busy && !pendingMove ? jailQueue[0] : undefined;
  const rentNow = calm && !busy && !pendingMove && !jailNow ? rentQueue[0] : undefined;
  useEffect(() => {
    if (!rentNow) return;
    if (s.fx.sound) ({ rent: kaching, tax: taxSound, go: fanfare, parking: rentNow.n > 0 ? kaching : chime, wealth: taxSound, crisis: taxSound, quake: taxSound, rule: chime })[rentNow.kind]();
    if (s.fx.vibrate) buzz(rentNow.kind === 'quake' ? [60, 40, 60, 40, 120] : 40);
    const id = window.setTimeout(() => setRentQueue((q) => q.slice(1)), isUpset(rentNow) ? 3400 : 2400);
    return () => clearTimeout(id);
  }, [rentNow, rentQueue.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!jailNow) return;
    if (!use3d) { if (s.fx.sound) siren(); if (s.fx.vibrate) buzz(60); }
    const id = window.setTimeout(() => setJailQueue((q) => q.slice(1)), 2300);
    return () => clearTimeout(id);
  }, [jailNow, jailQueue.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // the money shown in the top bar changes when the piece arrives, not when the dice are thrown
  const liveCash = useMemo(() => Object.fromEntries(g.players.map((p) => [p.id, p.cash])), [g]);
  const [shownCash, setShownCash] = useState(liveCash);
  if (calm && !busy && !pendingMove && shownCash !== liveCash) setShownCash(liveCash); // catch up once the piece has arrived
  const cashOf = (p: Player) => shownCash[p.id] ?? p.cash;

  // money going in and out: "+200 €" / "−50 €" floating by each player's cash
  const prevCash = useRef<Record<string, number>>(Object.fromEntries(g.players.map((p) => [p.id, p.cash])));
  const owedDelta = useRef<Record<string, number>>({});
  const chipRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [floats, setFloats] = useState<{ key: string; x: number; y: number; d: number }[]>([]);
  useEffect(() => {
    for (const p of g.players) {
      const d = p.cash - (prevCash.current[p.id] ?? p.cash);
      if (d) owedDelta.current[p.id] = (owedDelta.current[p.id] ?? 0) + d;
      prevCash.current[p.id] = p.cash;
    }
  }, [g]);
  useEffect(() => {
    if (!calm || busy || pendingMove) return;
    const entries = Object.entries(owedDelta.current).filter(([, d]) => d);
    if (!entries.length) return;
    owedDelta.current = {};
    const now = Date.now();
    const add = entries.map(([id, d], i) => {
      const r = chipRefs.current[id]?.getBoundingClientRect();
      return { key: `${now}-${i}`, x: r ? r.left + r.width / 2 : 60, y: r ? r.bottom : 50, d };
    });
    setFloats((f) => [...f, ...add]);
    const tid = window.setTimeout(() => setFloats((f) => f.filter((x) => !add.includes(x))), 1900);
    return () => clearTimeout(tid);
  }, [calm, busy, pendingMove, g.v]);

  // roll by shaking the phone
  const canRoll = !!actor && !busy && !needHandoff && !head && !g.trade && cur.id === actor && (!g.rolled || g.again) && sheet === 'none';
  useEffect(() => {
    if (!s.fx.shake || !canRoll || !actor) return;
    return listenShake(() => store.act(actor, { t: 'roll' }));
  }, [s.fx.shake, canRoll, actor]);

  const now = useNow();
  const remaining = g.rules.timeLimitMin > 0
    ? g.rules.timeLimitMin * 60000 - (g.clock.elapsed + Math.max(0, Math.min(now - g.clock.last, 120000)))
    : null;

  const lastLog = g.log.slice(-3).reverse();

  const center = (
    <div className="center-in">
      <div className="turnline" style={{ color: cur.color }}>
        <Avatar color={cur.color} emoji={cur.emoji} photo={s.photos[cur.id]} size={28} />
        <span>{cur.name}</span>
      </div>
      <div className="dice" key={`${g.turnNo}-${g.doubles}-${g.dice?.join()}`}>
        {g.dice ? <><Die n={g.dice[0]} tint={cur.color} /><Die n={g.dice[1]} tint={cur.color} /></> : <><Die n={5} /><Die n={2} /></>}
      </div>
      {g.rules.freeParking && <div className="small">💰 {t('pot', { n: m(g.pot) })}</div>}
      {remaining !== null && (
        <div className={'small' + (g.timeUp ? ' warn' : '')}>{g.timeUp ? t('lastRound') : t('timeLeft', { t: fmtTime(remaining) })}</div>
      )}
      <TurnCard g={g} />
      <ul className="ticker">
        {lastLog.map((e, i) => <li key={g.log.length - i}>{logText(g, e, lang)}</li>)}
      </ul>
    </div>
  );

  return (
    <div className={'screen game light-' + (s.fx.light ?? 'normal') + ((s.fx.contrast ?? 100) !== 100 ? ' contrasted' : '')}
      style={{ ['--contrast' as string]: (s.fx.contrast ?? 100) / 100 }} onPointerDown={unlockAudio}>
      <header className="bar gamebar">
        <button className="btn ghost small" aria-label={t('menu')} onClick={() => setMenu(true)}>✕</button>
        <div className="cashes">
          {g.players.filter((p) => !p.out).map((p) => (
            <span key={p.id} ref={(el) => { chipRefs.current[p.id] = el; }} className={'cashchip' + (p.id === cur.id ? ' cur' : '')} style={{ ['--c' as string]: p.color }}>
              <PieceIcon id={p.emoji} color={p.color} size={20} /> {m(cashOf(p))}
              {s.mode !== 'local' && s.presence[p.device] === false && <span className="offdot" title={t('offline')} />}
            </span>
          ))}
        </div>
      </header>

      {floats.map((f) => (
        <span key={f.key} className={'floater ' + (f.d > 0 ? 'up' : 'down')} style={{ left: f.x, top: f.y }}>
          {f.d > 0 ? '+' : '−'}{m(Math.abs(f.d))}
        </span>
      ))}

      <VersionWarning />
      {s.mode === 'client' && s.net === 'lost' && <HostLost />}
      {s.mode === 'client' && (s.net === 'connecting' || s.net === 'error') && (
        <div className="banner warn">
          <div>{t('reconnecting')}</div>
          <button className="btn small" onClick={() => store.reconnect()}>🔄 {t('reconnect')}</button>
        </div>
      )}

      {use3d ? (
        <Board3D g={g} onSquare={setInfo} onBusy={(b) => { setBusy(b); if (b) setCalm(false); else setSeenRolls(rollsRef.current); }} overlay={
          <div className="b3-overlay">
            <div className="turnline" style={{ color: cur.color }}>
              <Avatar color={cur.color} emoji={cur.emoji} photo={s.photos[cur.id]} size={24} />
              <span>{cur.name}</span>
            </div>
            {g.rules.freeParking && <div className="small">💰 {t('pot', { n: m(g.pot) })}</div>}
            {remaining !== null && (
              <div className={'small' + (g.timeUp ? ' warn' : '')}>{g.timeUp ? t('lastRound') : t('timeLeft', { t: fmtTime(remaining) })}</div>
            )}
            {lastLog[0] && <div className="small ticker1">{logText(g, lastLog[0], lang)}</div>}
            <TurnCard g={g} />
          </div>
        } />
      ) : (
        <BoardView g={g} onSquare={setInfo} center={center} />
      )}

      {jailNow && (
        <div className="jailbanner" aria-live="polite">
          <div className="bars">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 40}ms` }} />)}</div>
          <div className="jailtext"><span className="siren">🚨</span> {t('jailBanner', { p: jailNow })}</div>
        </div>
      )}

      {rentNow && <EventCard g={g} ev={rentNow} />}

      <section className="actions">
        {busy || pendingMove ? <p className="muted center">🎲 {t('rolling')}</p> : needHandoff ? null : openAuction ? (
          <OpenAuction g={g} a={head as Auction} local={local} />
        ) : actor ? (
          <ActorPanel g={g} id={actor} onTrade={() => setSheet('trade')} />
        ) : (
          <Spectator g={g} w={w} viewer={viewer} />
        )}
      </section>

      <nav className="dock">
        <button onClick={() => setSheet('props')}>🏠 {t('myProps')}</button>
        <button onClick={() => setSheet('players')}>👥 {t('players')}</button>
        <button onClick={() => setSheet('log')}>📜 {t('log')}</button>
        {s.mode !== 'local' && (
          <button onClick={() => { setSheet('chat'); store.markChatSeen(); }}>
            💬 {t('chat')}
            {s.chat.length > s.chatSeen && <span className="badge">{s.chat.length - s.chatSeen}</span>}
          </button>
        )}
      </nav>

      {/* modals */}
      {needHandoff && actor && (
        <Modal tone={g.players.find((p) => p.id === actor)!.color}>
          <Handoff p={g.players.find((p) => p.id === actor)!} photo={s.photos[actor]} onOk={() => setConfirmed(actor)} />
        </Modal>
      )}
      {!busy && !pendingMove && !needHandoff && actor && head?.k === 'card' && head.who === actor && <CardModal g={g} p={head} />}
      {!busy && !needHandoff && actor && head?.k === 'rename' && head.who === actor && <RenameModal g={g} sq={head.sq} who={actor} />}
      {!busy && !needHandoff && actor && !head && g.trade?.to === actor && sheet !== 'trade' && (
        <TradeResponse g={g} tr={g.trade} onCounter={() => { setCounterOf(g.trade); setSheet('trade'); }} />
      )}
      {sheet === 'props' && viewer && <PropsSheet g={g} id={viewer} onClose={() => setSheet('none')} />}
      {sheet === 'players' && <PlayersSheet g={g} onClose={() => setSheet('none')} />}
      {sheet === 'log' && (
        <Modal onClose={() => setSheet('none')}>
          <h2>{t('log')}</h2>
          <ul className="loglist">
            {g.log.slice().reverse().map((e, i) => (
              <li key={i}>{logText(g, e, lang)}</li>
            ))}
          </ul>
          <button className="btn wide" onClick={() => setSheet('none')}>{t('close')}</button>
        </Modal>
      )}
      {sheet === 'chat' && <ChatSheet g={g} local={local} viewer={viewer} onClose={() => { store.markChatSeen(); setSheet('none'); }} />}
      {sheet === 'trade' && viewer && (
        <TradeBuilder g={g} me={counterOf ? counterOf.to : viewer} base={counterOf}
          onClose={() => { setSheet('none'); setCounterOf(null); }} />
      )}
      {menu && (
        <Modal onClose={() => setMenu(false)}>
          <h2>{t('menu')}</h2>
          <button className="btn primary wide" onClick={() => setMenu(false)}>{t('continueGame')}</button>
          <button className="btn wide" onClick={() => { setMenu(false); setShowRules(true); }}>📖 {t('rules')}</button>
          <LightPicker />
          <ContrastPicker />
          <button className="btn wide ghost" onClick={() => { setMenu(false); setShowReport(true); }}>🛠️ {t('report')}</button>
          {s.mode !== 'local' && (
            <button className="btn wide" onClick={() => { store.reconnect(); setMenu(false); }}>🔄 {t('reconnect')}</button>
          )}
          <button className="btn wide" onClick={() => store.goHome()}>{t('exitSaved')}</button>
          <p className="small muted">{t('exitSavedHint')}</p>
          {s.mode !== 'client' && (
            <button className="btn danger ghost wide" onClick={() => store.confirm({
              key: s.mode === 'host' ? 'deleteConfirmHost' : 'deleteConfirm', yes: 'deleteGame', danger: true,
              onYes: () => store.deleteGame(),
            })}>{t('deleteGame')}</button>
          )}
          <p className="app-version">{APP_VERSION_TEXT}</p>
        </Modal>
      )}
      {s.mode === 'host' && s.lateReqs[0] && <LateRequest g={g} req={s.lateReqs[0]} />}
      {showRules && <RulesSheet g={g} onClose={() => setShowRules(false)} />}
      {showReport && <ReportSheet onClose={() => setShowReport(false)} />}
      {info !== null && <SquareInfo g={g} sq={info} onClose={() => setInfo(null)} />}
      {g.over && !busy && <GameOver g={g} />}
    </div>
  );
}

// ---------------- panels ----------------

function Handoff({ p, photo, onOk }: { p: Player; photo?: string; onOk: () => void }) {
  const { t } = useT();
  return (
    <div className="handoff">
      <div className="muted">{t('handTo')}</div>
      <Avatar color={p.color} emoji={p.emoji} photo={photo} size={88} />
      <h1 style={{ color: p.color }}>{p.name}</h1>
      <button className="btn primary wide" style={{ background: p.color, color: '#fff' }} onClick={onOk}>{t('iAm', { p: p.name })}</button>
    </div>
  );
}

function ActorPanel({ g, id, onTrade }: { g: Game; id: string; onTrade: () => void }) {
  const { t, m, lang } = useT();
  const p = g.players.find((x) => x.id === id)!;
  const head = g.q[0];
  const b = board(g);

  if (head?.k === 'buy') {
    const price = priceOf(g, head.sq);
    return (
      <div className="panel-act">
        <div className="who" style={{ color: p.color }}>{p.name}</div>
        <p className="big">{t('buyQ', { sq: sqName(g, head.sq, lang) })}</p>
        {p.cash < price && <p className="muted small">{t('cantAfford')}</p>}
        <div className="row">
          <button className="btn primary grow" disabled={p.cash < price} onClick={() => store.act(id, { t: 'buy' })}>{t('buy', { n: m(price) })}</button>
          <button className="btn ghost" onClick={() => store.act(id, { t: 'decline' })}>{t(g.rules.allowPass ? 'toAuction' : 'decline')}</button>
          {g.rules.allowPass && (
            <button className="btn ghost" onClick={() => store.act(id, { t: 'skip' })}>{t('passProp')}</button>
          )}
        </div>
      </div>
    );
  }
  if (head?.k === 'debt') {
    const total = head.owed.reduce((s, o) => s + o.amount, 0);
    return (
      <div className="panel-act">
        <div className="who" style={{ color: p.color }}>{p.name}</div>
        <p className="big warn">{t('debtQ', { n: m(total), c: m(p.cash) })}</p>
        <p className="muted small">{t('debtHint')}</p>
        <div className="row">
          <button className="btn primary grow" disabled={p.cash < total} onClick={() => store.act(id, { t: 'payDebt' })}>{t('payDebt', { n: m(total) })}</button>
          <button className="btn danger ghost" onClick={() => store.confirm({ key: 'bankruptConfirm', yes: 'bankrupt', danger: true, onYes: () => store.act(id, { t: 'bankrupt' }) })}>{t('bankrupt')}</button>
        </div>
      </div>
    );
  }
  if (head?.k === 'auction') return <SealedBid g={g} a={head} p={p} />;
  if (head) return null; // card / rename shown as modals
  if (g.trade) return null; // trade response shown as modal

  // own turn
  const canRoll = !g.rolled || g.again;
  return (
    <div className="panel-act">
      <div className="who" style={{ color: p.color }}>{t('turnOf', { p: p.name })}</div>
      {p.jail && !g.rolled && (
        <>
          <p className="small">{t('inJail', { n: p.jailTries + 1 })}</p>
          <div className="row">
            <button className="btn ghost grow" disabled={p.cash < b.jailFine} onClick={() => store.act(id, { t: 'payJail' })}>{t('payJail', { n: m(b.jailFine) })}</button>
            {p.jailCards.length > 0 && <button className="btn ghost grow" onClick={() => store.act(id, { t: 'useCard' })}>{t('useCard')}</button>}
          </div>
        </>
      )}
      <div className="row">
        {canRoll ? (
          <button className="btn primary grow roll" style={{ background: p.color }} onClick={() => {
            unlockAudio();
            if (store.get().fx.shake) void requestMotion();
            store.act(id, { t: 'roll' });
          }}>
            🎲 {g.rolled && g.again ? t('rollAgain') : t('roll')}
            {store.get().fx.shake && <span className="hint">{t('shakeHint')}</span>}
          </button>
        ) : (
          <button className="btn primary grow" onClick={() => store.act(id, { t: 'endTurn' })}>{t('endTurn')}</button>
        )}
        <button className="btn ghost" onClick={onTrade}>⇄ {t('trade')}</button>
      </div>
    </div>
  );
}

function Spectator({ g, w, viewer }: { g: Game; w: string[]; viewer: string | null }) {
  const { t } = useT();
  const head = g.q[0];
  const names = w.map((id) => playerName(g, id)).join(', ');
  return (
    <div className="panel-act">
      {head?.k === 'auction' && g.rules.auction === 'sealed' && (
        <p className="small">{t('sealedWaiting', { a: Object.keys(head.sealed).length, b: head.eligible.length })}</p>
      )}
      <p className="muted">{t('waitingFor', { p: names })}</p>
      {g.trade && viewer && g.trade.from === viewer && (
        <>
          <p className="small">{t('tradePending', { p: playerName(g, g.trade.to) })}</p>
          <button className="btn ghost" onClick={() => store.act(viewer, { t: 'cancelTrade' })}>{t('cancelTrade')}</button>
        </>
      )}
    </div>
  );
}

function OpenAuction({ g, a, local }: { g: Game; a: Auction; local: Player[] }) {
  const { t, m, lang } = useT();
  const bidders = local.filter((p) => a.eligible.includes(p.id) && !a.passed.includes(p.id));
  return (
    <div className="panel-act">
      <p className="big">{t('auctionFor', { sq: sqName(g, a.sq, lang) })}</p>
      <p>{a.bidder ? t('highBid', { n: m(a.high), p: playerName(g, a.bidder) }) : t('noBids')}</p>
      {bidders.map((p) => (
        <div key={p.id} className="bidrow" style={{ borderLeftColor: p.color }}>
          <span className="bname"><PieceIcon id={p.emoji} color={p.color} size={22} /> {p.name}</span>
          {a.bidder === p.id ? (
            <span className="tag">{t('youLead')}</span>
          ) : (
            <>
              {[10, 50, 100].map((inc) => (
                <button key={inc} className="btn small ghost" disabled={a.high + inc > p.cash}
                  onClick={() => store.act(p.id, { t: 'bid', amount: a.high + inc })}>{t('bidBtn', { n: inc })}</button>
              ))}
              <button className="btn ghost small" onClick={() => store.act(p.id, { t: 'pass' })}>{t('passBtn')}</button>
            </>
          )}
        </div>
      ))}
      {bidders.length === 0 && <p className="muted small">{t('waitingFor', { p: waiting(g).map((id) => playerName(g, id)).join(', ') })}</p>}
    </div>
  );
}

function SealedBid({ g, a, p }: { g: Game; a: Auction; p: Player }) {
  const { t, lang } = useT();
  const [v, setV] = useState('');
  const n = Math.max(0, Math.floor(Number(v) || 0));
  return (
    <div className="panel-act">
      <p className="big">{t('auctionFor', { sq: sqName(g, a.sq, lang) })}</p>
      <p>{t('sealedQ', { p: p.name })}</p>
      <p className="muted small">{t('sealedHint')}</p>
      <div className="row">
        <input type="password" inputMode="numeric" className="grow" value={v} placeholder="0"
          onChange={(e) => setV(e.target.value.replace(/\D/g, ''))} />
        <button className="btn primary" disabled={n > p.cash} onClick={() => { store.act(p.id, { t: 'sealed', amount: n }); setV(''); }}>{t('submit')}</button>
      </div>
    </div>
  );
}

// ---------------- modals ----------------

function CardModal({ g, p }: { g: Game; p: Extract<Pending, { k: 'card' }> }) {
  const { t, lang } = useT();
  const c = g.cards[p.card];
  return (
    <Modal>
      <div className={'bigcard ' + c.deck}>
        <div className="small">{t('cardTitle_' + c.deck)}</div>
        <p>{cardText(g, c, lang)}</p>
      </div>
      <button className="btn primary wide" onClick={() => store.act(p.who, { t: 'cardOk' })}>{t('ok')}</button>
    </Modal>
  );
}

function RenameModal({ g, sq, who }: { g: Game; sq: number; who: string }) {
  const { t, lang } = useT();
  const [v, setV] = useState('');
  return (
    <Modal tone={groupColor(g, sq)}>
      <h2>{sqName(g, sq, lang)}</h2>
      <p>{t('renameQ')}</p>
      <input value={v} maxLength={32} placeholder={sqName(g, sq, lang)} onChange={(e) => setV(e.target.value)} />
      <div className="row">
        <button className="btn ghost grow" onClick={() => store.act(who, { t: 'skipRename' })}>{t('keepName')}</button>
        <button className="btn primary grow" disabled={!v.trim()} onClick={() => store.act(who, { t: 'rename', name: v })}>{t('rename')}</button>
      </div>
    </Modal>
  );
}

function SquareInfo({ g, sq, onClose }: { g: Game; sq: number; onClose: () => void }) {
  const { t, m, lang } = useT();
  const b = board(g);
  const s = b.squares[sq];
  const pr = g.props[sq];
  const labels = t('rentRow').split('|');
  return (
    <Modal onClose={onClose} tone={groupColor(g, sq)}>
      <h2>{sqName(g, sq, lang)}</h2>
      {pr && (
        <p>
          {t('owner')}: <strong>{pr.owner ? playerName(g, pr.owner) : t('noOwner')}</strong>
          {pr.mort ? ` · ${t('mortgaged')}` : ''}
          {pr.houses > 0 ? ` · ${pr.houses === 5 ? t('hotel') : t('houses', { n: pr.houses })}` : ''}
        </p>
      )}
      {s.price !== undefined && <p>{t('price')}: {m(priceOf(g, sq))}</p>}
      {s.kind === 'street' && (
        <table className="rent">
          <tbody>
            {s.rent!.map((r, i) => <tr key={i}><td>{labels[i]}</td><td>{m(r)}</td></tr>)}
            <tr><td>{t('houseCost')}</td><td>{m(s.house!)}</td></tr>
          </tbody>
        </table>
      )}
      {s.kind === 'station' && <p>{t('stationRentInfo', { r: b.stationRent.map((x) => m(x)).join(' / ') })}</p>}
      {s.kind === 'utility' && <p>{t('utilRentInfo', { r: b.utilMult.join(' / ') })}</p>}
      {s.kind === 'tax' && <p>{t('taxInfo', { n: m(s.tax!) })}</p>}
      {pr?.owner && s.kind === 'street' && <p className="small muted">{t('rent')}: {m(rentFor(g, sq, 7))}</p>}
      <button className="btn wide" onClick={onClose}>{t('close')}</button>
    </Modal>
  );
}

function PropsSheet({ g, id, onClose }: { g: Game; id: string; onClose: () => void }) {
  const { t, m, lang } = useT();
  const b = board(g);
  const p = g.players.find((x) => x.id === id)!;
  const head = g.q[0];
  const canManage = head ? head.k === 'debt' && head.who === id : curP(g).id === id && !g.trade;
  const mine = ownedBy(g, id).sort((x, y) => x - y);
  const stock = bankStock(g);
  return (
    <Modal onClose={onClose} tone={p.color}>
      <h2><PieceIcon id={p.emoji} color={p.color} size={30} /> {p.name}</h2>
      <p className="small">{t('cash')}: <strong>{m(p.cash)}</strong> · {t('worth')}: {m(netWorth(g, id))}
        {p.jailCards.length > 0 && ` · ${t('jailCards', { n: p.jailCards.length })}`}</p>
      <p className="small muted">{t('bank')}: 🏠 {stock.houses} · 🏨 {stock.hotels}</p>
      {mine.length === 0 && <p className="muted">{t('noProps')}</p>}
      <ul className="proplist">
        {mine.map((sq) => {
          const s = b.squares[sq];
          const pr = g.props[sq];
          return (
            <li key={sq} style={{ borderLeftColor: groupColor(g, sq) ?? 'var(--ink-soft)' }}>
              <div className="pl-head">
                <strong>{sqName(g, sq, lang)}</strong>
                <span className="small muted">
                  {pr.mort ? t('mortgaged') : pr.houses === 5 ? t('hotel') : pr.houses ? t('houses', { n: pr.houses }) : ''}
                </span>
              </div>
              {canManage && (
                <div className="pl-act">
                  {s.kind === 'street' && hasMonopoly(g, sq) && !pr.mort && pr.houses < 5 && (
                    <button className="btn small" onClick={() => store.act(id, { t: 'build', sq })}>{t('build', { n: m(s.house!) })}</button>
                  )}
                  {pr.houses > 0 && (
                    <button className="btn small ghost" onClick={() => store.act(id, { t: 'sell', sq })}>{t('sellHouse', { n: m(s.house! / 2) })}</button>
                  )}
                  {!pr.mort && pr.houses === 0 && (
                    <button className="btn small ghost" onClick={() => store.act(id, { t: 'mortgage', sq })}>{t('mortgage', { n: m(priceOf(g, sq) / 2) })}</button>
                  )}
                  {pr.mort && (
                    <button className="btn small ghost" onClick={() => store.act(id, { t: 'unmortgage', sq })}>{t('unmortgage', { n: m(unmortgageCost(priceOf(g, sq))) })}</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button className="btn wide" onClick={onClose}>{t('close')}</button>
    </Modal>
  );
}

function PlayersSheet({ g, onClose }: { g: Game; onClose: () => void }) {
  const s = useStore();
  const { t, m } = useT();
  return (
    <Modal onClose={onClose}>
      <h2>{t('players')}</h2>
      {s.mode === 'host' && <p className="small muted">{t('youAreHost')} · {t('roomCode')}: <strong>{s.room}</strong></p>}
      {s.mode === 'client' && <p className="small muted">{t('roomCode')}: <strong>{s.room}</strong></p>}
      <ul className="plist big">
        {g.players.map((p) => (
          <li key={p.id} className={p.out ? 'out' : ''}>
            <Avatar color={p.color} emoji={p.emoji} photo={s.photos[p.id]} size={34} />
            <div className="grow">
              <div><strong>{p.name}</strong> {p.out && <span className="muted">({t('out')})</span>}</div>
              {!p.out && (
                <div className="small muted">
                  {m(p.cash)} · {t('worth')} {m(netWorth(g, p.id))}
                  {p.jail ? ' · ⛓' : ''}
                  {s.mode !== 'local' && (p.device === s.device ? ` · ${t('here')}` : s.presence[p.device] === false ? ` · ${t('offline')}` : ` · ${t('remote')}`)}
                </div>
              )}
            </div>
            {s.mode === 'host' && !p.out && p.device !== s.device && (
              <button className="btn danger ghost small" onClick={() => store.confirm({ key: 'kickConfirm', params: { p: p.name }, yes: 'kick', danger: true, onYes: () => store.kick(p.id) })}>{t('kick')}</button>
            )}
          </li>
        ))}
      </ul>
      <button className="btn wide" onClick={onClose}>{t('close')}</button>
    </Modal>
  );
}

// ---------------- trades ----------------

const emptyOffer = (): Offer => ({ cash: 0, props: [], cards: 0 });

function OfferPicker({ g, owner, offer, set }: { g: Game; owner: string; offer: Offer; set: (o: Offer) => void }) {
  const { t, lang } = useT();
  const p = g.players.find((x) => x.id === owner)!;
  const props = ownedBy(g, owner).sort((a, b) => a - b);
  const blocked = (sq: number) => {
    const s = board(g).squares[sq];
    const grp = s.group !== undefined ? board(g).groups[s.group].members : [sq];
    return grp.some((x) => g.props[x].houses > 0);
  };
  return (
    <div className="offer">
      <label className="field"><span>{t('money')}</span>
        <input type="number" inputMode="numeric" min={0} max={p.cash} value={offer.cash || ''} placeholder="0"
          onChange={(e) => set({ ...offer, cash: Math.max(0, Math.min(p.cash, Math.floor(Number(e.target.value) || 0))) })} />
      </label>
      {props.map((sq) => (
        <label key={sq} className={'check' + (blocked(sq) ? ' disabled' : '')}>
          <input type="checkbox" disabled={blocked(sq)} checked={offer.props.includes(sq)}
            onChange={(e) => set({ ...offer, props: e.target.checked ? [...offer.props, sq] : offer.props.filter((x) => x !== sq) })} />
          <span className="dot" style={{ background: groupColor(g, sq) ?? 'var(--ink-soft)' }} />
          {sqName(g, sq, lang)}{g.props[sq].mort ? ` (${t('mortgaged')})` : ''}
        </label>
      ))}
      {p.jailCards.length > 0 && (
        <label className="field"><span>{t('cards')}</span>
          <input type="number" min={0} max={p.jailCards.length} value={offer.cards}
            onChange={(e) => set({ ...offer, cards: Math.max(0, Math.min(p.jailCards.length, Number(e.target.value) || 0)) })} />
        </label>
      )}
    </div>
  );
}

function TradeBuilder({ g, me, base, onClose }: { g: Game; me: string; base: Trade | null; onClose: () => void }) {
  const { t } = useT();
  const others = g.players.filter((p) => !p.out && p.id !== me);
  const isCounter = !!base;
  const [to, setTo] = useState(base ? base.from : others[0]?.id ?? '');
  const [give, setGive] = useState<Offer>(base ? base.get : emptyOffer());
  const [get, setGet] = useState<Offer>(base ? base.give : emptyOffer());
  const allowed = isCounter ? g.trade?.to === me : curP(g).id === me && !g.q.length && !g.trade;
  const send = () => {
    const trade: Trade = { from: me, to, give, get };
    store.act(me, { t: isCounter ? 'counter' : 'propose', trade });
    onClose();
  };
  return (
    <Modal onClose={onClose}>
      <h2>{isCounter ? t('counter') : t('trade')}</h2>
      {!allowed ? <p className="muted">{t('tradeOnlyYourTurn')}</p> : (
        <>
          <label className="field"><span>{t('tradeWith')}</span>
            <select value={to} disabled={isCounter} onChange={(e) => { setTo(e.target.value); setGet(emptyOffer()); }}>
              {others.map((p) => <option key={p.id} value={p.id}>{pieceText(p.emoji)} {p.name}</option>)}
            </select>
          </label>
          <div className="tradecols">
            <div><h3>{t('youGive')}</h3><OfferPicker g={g} owner={me} offer={give} set={setGive} /></div>
            {to && <div><h3>{t('youGet')}</h3><OfferPicker g={g} owner={to} offer={get} set={setGet} /></div>}
          </div>
          <p className="small muted">{t('mortFee')}</p>
          <button className="btn primary wide" disabled={!to} onClick={send}>{t('propose')}</button>
        </>
      )}
      <button className="btn ghost wide" onClick={onClose}>{t('cancel')}</button>
    </Modal>
  );
}

function OfferView({ g, o }: { g: Game; o: Offer }) {
  const { t, m, lang } = useT();
  return (
    <ul className="offerview">
      {o.cash > 0 && <li>{m(o.cash)}</li>}
      {o.props.map((sq) => (
        <li key={sq}><span className="dot" style={{ background: groupColor(g, sq) ?? 'var(--ink-soft)' }} />{sqName(g, sq, lang)}{g.props[sq].mort ? ` (${t('mortgaged')})` : ''}</li>
      ))}
      {o.cards > 0 && <li>{t('jailCards', { n: o.cards })}</li>}
      {!o.cash && !o.props.length && !o.cards && <li className="muted">—</li>}
    </ul>
  );
}

function TradeResponse({ g, tr, onCounter }: { g: Game; tr: Trade; onCounter: () => void }) {
  const { t } = useT();
  const from = g.players.find((p) => p.id === tr.from)!;
  return (
    <Modal tone={from.color}>
      <h2>{t('tradeOffer', { p: from.name })}</h2>
      <div className="tradecols">
        <div><h3>{t('youGet')}</h3><OfferView g={g} o={tr.give} /></div>
        <div><h3>{t('youGive')}</h3><OfferView g={g} o={tr.get} /></div>
      </div>
      <p className="small muted">{t('mortFee')}</p>
      <div className="row">
        <button className="btn primary grow" onClick={() => store.act(tr.to, { t: 'accept' })}>{t('accept')}</button>
        <button className="btn ghost" onClick={() => store.act(tr.to, { t: 'reject' })}>{t('reject')}</button>
      </div>
      <button className="btn ghost wide" onClick={onCounter}>{t('counter')}</button>
    </Modal>
  );
}

// ---------------- the card of this turn, shown to everyone ----------------

function TurnCard({ g }: { g: Game }) {
  const { t, lang } = useT();
  const tc = turnCard(g);
  if (!tc) return null;
  const p = g.players.find((x) => x.id === tc.who);
  return (
    <div className={'turncard ' + tc.card.deck} key={tc.card.id}>
      <div className="tc-head">🃏 {t('cardTitle_' + tc.card.deck)} · <strong style={{ color: p?.color }}>{p?.name}</strong></div>
      <div className="tc-text">{cardText(g, tc.card, lang)}</div>
    </div>
  );
}

// ---------------- board events: rent, tax, Start, Parking ----------------

function EventCard({ g, ev }: { g: Game; ev: BoardEvent }) {
  const { t, m, lang } = useT();
  const who = g.players.find((x) => x.id === ev.p);
  const owner = ev.o ? g.players.find((x) => x.id === ev.o) : undefined;
  const look = {
    rent: { icon: '🏠', title: t('rentTitle'), color: owner?.color, sign: '', rain: '🪙' },
    tax: { icon: '🧾', title: t('taxTitle'), color: '#e5484d', sign: '−', rain: '💸' },
    go: { icon: '🏁', title: t('goTitle'), color: '#f4b33d', sign: '+', rain: '⭐' },
    parking: { icon: '🅿️', title: t('parkingTitle'), color: '#30a46c', sign: '+', rain: ev.n > 0 ? '🪙' : '🌿' },
    wealth: { icon: '💰', title: t('wealthTitle'), color: '#e5484d', sign: '−', rain: '💸' },
    crisis: { icon: '📉', title: t('crisisTitle'), color: '#e5484d', sign: '', rain: '📉' },
    quake: { icon: '🌋', title: t('quakeTitle'), color: '#7a5c48', sign: '', rain: '🧱' },
    rule: { icon: '📜', title: t('ruleTitle'), color: '#8e4ec6', sign: '', rain: '✨' },
  }[ev.kind];
  const rule = ev.kind === 'rule' ? g.rules.custom?.[ev.r ?? -1] : undefined;
  const words = ev.kind === 'crisis' ? t('crisisText', { h: m(g.rules.crisis?.house ?? 0), H: m(g.rules.crisis?.hotel ?? 0) })
    : ev.kind === 'quake' ? (ev.sq < 0 ? t('quakeNoneText') : t('quakeText', { sq: sqName(g, ev.sq, lang) }))
    : rule ? ruleTitle(lang, rule, (sq) => sqName(g, sq, lang))
    : null;
  return (
    <div className={'rentbanner ev-' + ev.kind} aria-live="polite">
      <div className="coins" aria-hidden>{Array.from({ length: 10 }, (_, i) => <span key={i} style={{ left: `${6 + i * 9.5}%`, animationDelay: `${(i % 5) * 90}ms` }}>{look.rain}</span>)}</div>
      <div className="rentcard" style={{ borderColor: look.color }}>
        <div className="rent-title">{look.icon} {look.title}</div>
        {words !== null ? <div className="rent-words">{words}</div>
          : ev.n > 0
            ? <div className={'rent-amount' + (look.sign === '+' ? ' plus' : '')}>{look.sign}{m(ev.n)}</div>
            : <div className="rent-amount calm">{t('parkingRest')}</div>}
        <div className="rent-who">
          {who && <PieceIcon id={who.emoji} color={who.color} size={26} />} <span style={{ color: who?.color }}>{who?.name}</span>
          {owner && <><span className="arrow">→</span><PieceIcon id={owner.emoji} color={owner.color} size={26} /> <span style={{ color: owner.color }}>{owner.name}</span></>}
        </div>
        {ev.sq >= 0 && ev.kind !== 'quake' && <div className="small muted">{sqName(g, ev.sq, lang)}</div>}
      </div>
    </div>
  );
}

// ---------------- someone asks to join the game in progress (host) ----------------

function LateRequest({ g, req }: { g: Game; req: { device: string; player: PlayerSetup; photo?: string } }) {
  const { t } = useT();
  const full = g.players.filter((p) => !p.out).length >= 10;
  return (
    <Modal>
      <h2>🙋 {t('lateReqTitle', { p: req.player.name })}</h2>
      <div className="handoff">
        <Avatar color={req.player.color} emoji={req.player.emoji} photo={req.photo} size={72} />
      </div>
      <p className="small muted center">{t('lateReqHelp')}</p>
      <button className="btn primary wide" disabled={full} onClick={() => store.answerLate(req.device, 'player')}>🎲 {t('lateAsPlayer')}</button>
      {full && <p className="small muted center">{t('e_tooMany')}</p>}
      <button className="btn wide" onClick={() => store.answerLate(req.device, 'spectator')}>👁️ {t('lateAsSpectator')}</button>
      <button className="btn ghost wide" onClick={() => store.answerLate(req.device, 'no')}>{t('lateRefuse')}</button>
    </Modal>
  );
}

// ---------------- everyone must run the same version ----------------

/** online: warn when a phone runs a different (older) version of the app */
export function VersionWarning() {
  const { t } = useT();
  const s = useStore();
  if (s.mode === 'host') {
    const players = s.game?.players ?? s.setup.players;
    const stale = Object.entries(s.versions).filter(([d, v]) => v !== __APP_VERSION__ && d !== s.device);
    if (!stale.length) return null;
    const names = stale.map(([d, v]) => {
      const who = players.filter((p) => p.device === d).map((p) => p.name).join(', ') || (s.spectators[d] ? '👁️ ' + s.spectators[d] : '?');
      return `${who} (${v === 'old' ? t('verOld') : 'v' + v})`;
    });
    return <div className="banner warn">⚠️ {t('verOthers', { p: names.join(' · '), v: __APP_VERSION__ })}</div>;
  }
  if (s.mode === 'client' && s.hostVersion && s.hostVersion !== __APP_VERSION__) {
    return <div className="banner warn">⚠️ {t('verHost', { h: s.hostVersion === 'old' ? t('verOld') : 'v' + s.hostVersion, v: __APP_VERSION__ })}</div>;
  }
  return null;
}

// ---------------- board brightness ----------------

export function LightPicker() {
  const { t } = useT();
  const s = useStore();
  const cur = s.fx.light ?? 'normal';
  return (
    <div className="field">
      <span>💡 {t('boardLight')}</span>
      <div className="seg">
        {(['normal', 'dim', 'night'] as const).map((l) => (
          <button key={l} className={cur === l ? 'on' : ''} onClick={() => store.setFx({ light: l })}>{t('light_' + l)}</button>
        ))}
      </div>
    </div>
  );
}

export function ContrastPicker() {
  const { t } = useT();
  const s = useStore();
  const cur = s.fx.contrast ?? 100;
  return (
    <div className="field">
      <span>◐ {t('boardContrast')}: <b>{cur}%</b></span>
      <div className="row contrast-row">
        <input type="range" min={CONTRAST_MIN} max={CONTRAST_MAX} step={5} value={cur} aria-label={t('boardContrast')}
          onChange={(e) => store.setFx({ contrast: clampContrast(e.target.value) })} />
        <button className="btn ghost small" disabled={cur === 100} onClick={() => store.setFx({ contrast: 100 })}>↺</button>
      </div>
    </div>
  );
}

// ---------------- chat ----------------

function ChatSheet({ g, local, viewer, onClose }: { g: Game; local: Player[]; viewer: string | null; onClose: () => void }) {
  const s = useStore();
  const { t } = useT();
  const [text, setText] = useState('');
  // spectators write under their name (the host checks it)
  const [as, setAs] = useState(viewer ?? local[0]?.id ?? (s.spectatorName ? '~' + s.spectatorName : ''));
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    store.markChatSeen();
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [s.chat.length]);
  const send = (msg: string) => { if (as && msg.trim()) { store.sendChat(as, msg); setText(''); } };
  const time = (ms: number) => new Date(ms).toLocaleTimeString(s.lang === 'el' ? 'el-GR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <Modal onClose={onClose}>
      <h2>💬 {t('chat')}</h2>
      <div className="chatlist" ref={listRef}>
        {s.chat.length === 0 && <p className="muted">{t('chatEmpty')}</p>}
        {s.chat.map((c) => {
          const p = g.players.find((x) => x.id === c.from);
          const watcher = c.from.startsWith('~') ? c.from.slice(1) : null;
          const mine = !!local.find((x) => x.id === c.from) || (!!watcher && watcher === s.spectatorName && local.length === 0);
          return (
            <div key={c.id} className={'chatmsg' + (mine ? ' mine' : '')}>
              {p && <Avatar color={p.color} emoji={p.emoji} photo={s.photos[p.id]} size={26} />}
              <div className="bubble" style={{ borderColor: p?.color }}>
                <div className="small"><strong style={{ color: p?.color }}>{p?.name ?? (watcher ? `👁️ ${watcher}` : '?')}</strong> <span className="muted">{time(c.t)}</span></div>
                <div className="chattext">{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>
      {local.length > 1 && (
        <label className="field"><span>{t('chatAs')}</span>
          <select value={as} onChange={(e) => setAs(e.target.value)}>
            {local.map((p) => <option key={p.id} value={p.id}>{pieceText(p.emoji)} {p.name}</option>)}
          </select>
        </label>
      )}
      <div className="quick">
        {t('chatQuick').split('|').map((q) => <button key={q} className="btn small ghost" onClick={() => send(q)}>{q}</button>)}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input className="grow" value={text} maxLength={CHAT_MAX} placeholder={t('chatPlaceholder')} onChange={(e) => setText(e.target.value)} enterKeyHint="send" />
        <button className="btn primary" type="submit" disabled={!text.trim() || s.net !== 'ok'}>{t('chatSend')}</button>
      </form>
      <button className="btn wide" onClick={onClose}>{t('close')}</button>
    </Modal>
  );
}

// ---------------- end / network ----------------

function WorthChart({ g }: { g: Game }) {
  const { t, m } = useT();
  const pts = g.stats?.worth ?? [];
  if (pts.length < 2) return null;
  const W = 320, H = 150, pad = 6;
  const max = Math.max(1, ...pts.flatMap((p) => Object.values(p.w)));
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  return (
    <figure className="chart">
      <figcaption className="small muted">{t('worthChart')} · max {m(max)}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('worthChart')}>
        <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--line)" />
        {g.players.map((p) => (
          <polyline key={p.id} fill="none" stroke={p.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"
            points={pts.map((s, i) => `${x(i).toFixed(1)},${y(s.w[p.id] ?? 0).toFixed(1)}`).join(' ')} />
        ))}
      </svg>
      <div className="small muted chart-x"><span>{t('roundN', { n: pts[0].round })}</span><span>{t('roundN', { n: pts[pts.length - 1].round })}</span></div>
    </figure>
  );
}

function Awards({ g }: { g: Game }) {
  const { t, m, lang } = useT();
  const st = g.stats;
  if (!st) return null;
  const best = (f: (id: string) => number) => {
    let id = '', v = 0;
    for (const p of g.players) { const n = f(p.id); if (n > v) { v = n; id = p.id; } }
    return id ? { id, v } : null;
  };
  const ps = (id: string) => st.players[id] ?? { rentIn: 0, rentOut: 0, jail: 0, bought: 0, maxWorth: 0 };
  const rows: [string, string, { id: string; v: number } | null, boolean][] = [
    ['🏆', 'aw_rentIn', best((id) => ps(id).rentIn), true],
    ['💸', 'aw_rentOut', best((id) => ps(id).rentOut), true],
    ['⛓️', 'aw_jail', best((id) => ps(id).jail), false],
    ['🏘️', 'aw_bought', best((id) => ps(id).bought), false],
    ['📈', 'aw_peak', best((id) => ps(id).maxWorth), true],
  ];
  const topSq = Object.entries(st.sq).sort((a, b) => b[1] - a[1])[0];
  return (
    <ul className="awards">
      {rows.filter((r) => r[2]).map(([icon, key, w, money]) => {
        const p = g.players.find((x) => x.id === w!.id)!;
        return <li key={key}><span className="aw-i">{icon}</span><span>{t(key, { p: p.name, n: money ? m(w!.v) : w!.v })}</span></li>;
      })}
      {topSq && <li><span className="aw-i">⭐</span><span>{t('aw_sq', { sq: sqName(g, Number(topSq[0]), lang), n: m(topSq[1]) })}</span></li>}
    </ul>
  );
}

function GameOver({ g }: { g: Game }) {
  const { t, m } = useT();
  const s = useStore();
  const winner = g.players.find((p) => p.id === g.over!.rank[0]?.id);
  return (
    <Modal tone={winner?.color}>
      <h2>{t('gameOver')}</h2>
      {winner && (
        <div className="handoff">
          <Avatar color={winner.color} emoji={winner.emoji} photo={s.photos[winner.id]} size={88} />
          <h1 style={{ color: winner.color }}>{t('winner', { p: winner.name })}</h1>
        </div>
      )}
      <ol className="rank">
        {g.over!.rank.map((r) => {
          const p = g.players.find((x) => x.id === r.id)!;
          return <li key={r.id}><PieceIcon id={p.emoji} color={p.color} size={22} /> {p.name} <span className="grow" /> {p.out ? t('out') : m(r.worth)}</li>;
        })}
      </ol>
      {g.stats && <h3>{t('statsTitle')}</h3>}
      <Awards g={g} />
      <WorthChart g={g} />
      {s.mode === 'client' ? (
        <p className="small muted center">{t('rematchWait')}</p>
      ) : (
        <>
          <button className="btn primary wide" onClick={() => store.rematch()}>🔁 {t('rematch')}</button>
          <p className="small muted center">{t('rematchHint')}</p>
        </>
      )}
      <button className="btn wide" onClick={() => store.goHome()}>{t('newGame')}</button>
    </Modal>
  );
}

function HostLost() {
  const { t } = useT();
  const s = useStore();
  const now = useNow();
  const lost = now - s.lostSince;
  const order = store.successors();
  const next = order[0];
  const nextName = s.game?.players.filter((p) => p.device === next && !p.out).map((p) => p.name).join(', ') ?? '';
  const left = TAKEOVER_MS - lost;
  const mine = order.indexOf(s.device);
  return (
    <div className="banner warn">
      <div>{t('hostLost')}</div>
      {next && left > 0 && (
        <div className="small">{t(next === s.device ? 'takeOverMeIn' : 'takeOverIn', { t: fmtTime(left), p: nextName })}</div>
      )}
      {mine >= 0 && lost >= MANUAL_TAKEOVER_MS && (
        <button className="btn primary" onClick={() => store.takeOver()}>{t('takeOver')}</button>
      )}
    </div>
  );
}
