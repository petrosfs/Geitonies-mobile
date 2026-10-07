import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { store } from './store';
import { hasWebGL, requestMotion } from './fx';
import { BOARDS } from './game/boards';
import { startCashOf } from './game/engine';
import { CITIES, CITY_IDS, defaultName } from './game/cities';
import { CUSTOM_EFFECTS, type CustomEffectKind } from './game/cards';
import type { CustomCard, CustomRule, Deck, Effect, PlayerSetup, RuleWho, Setup } from './game/types';
import { cleanCrisis, cleanCustomRule, DEFAULT_CRISIS, DEFAULT_QUAKE, DEFAULT_WEALTH_TAX, MAX_CUSTOM_RULES, RULE_TEXT_MAX } from './game/houserules';
import { customRuleText, wealthTaxText } from './upsets-text';
import { canUseCamera, COLORS, EMOJIS, readPhoto, useStore, useT } from './ui';
import { Avatar, PieceIcon } from './components';
import { CameraSheet } from './Camera';
import { pieceText } from './three/piece-list';
import { ContrastPicker, LightPicker, QualityPicker, VersionWarning } from './Game';

const newId = () => Math.random().toString(36).slice(2, 10);

// ---------------- players ----------------

export function PlayersEditor(props: Omit<Parameters<typeof PlayersEditorInner>[0], 'setCameraFor'>) {
  const [cameraFor, setCameraFor] = useState<string | null>(null);
  return (
    <>
      <PlayersEditorInner {...props} setCameraFor={setCameraFor} />
      {cameraFor && (
        <CameraSheet
          onClose={() => setCameraFor(null)}
          onShot={(photo) => { props.onChange(props.players, { ...props.photos, [cameraFor]: photo }); setCameraFor(null); }}
          onFail={() => { const id = cameraFor; setCameraFor(null); document.getElementById('cam-' + id)?.click(); }}
        />
      )}
    </>
  );
}

function PlayersEditorInner({ players, photos, onChange, canRemoveOthers, showDevice, others = [], setCameraFor }: {
  setCameraFor: (id: string | null) => void;
  players: PlayerSetup[];
  photos: Record<string, string>;
  onChange: (players: PlayerSetup[], photos: Record<string, string>) => void;
  canRemoveOthers?: boolean;
  showDevice?: boolean;
  /** players of other devices, so new players get a free colour/piece */
  others?: PlayerSetup[];
}) {
  const { t } = useT();
  const { device } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const usedColors = new Set([...players, ...others].map((p) => p.color));
  const usedEmoji = new Set([...players, ...others].map((p) => p.emoji));

  const add = () => {
    if (players.length >= 10) { store.toast('tooMany'); return; }
    const p: PlayerSetup = {
      id: newId(), name: '', device,
      color: COLORS.find((c) => !usedColors.has(c)) ?? COLORS[0],
      emoji: EMOJIS.find((e) => !usedEmoji.has(e)) ?? EMOJIS[0],
    };
    onChange([...players, p], photos);
    setOpen(p.id);
  };
  const upd = (id: string, patch: Partial<PlayerSetup>) =>
    onChange(players.map((p) => (p.id === id ? { ...p, ...patch } : p)), photos);
  const remove = (id: string) => {
    const ph = { ...photos }; delete ph[id];
    onChange(players.filter((p) => p.id !== id), ph);
  };

  return (
    <div className="players-ed">
      {players.map((p, i) => {
        const mine = p.device === device;
        const isOpen = open === p.id && mine;
        return (
          <div key={p.id} className={'pcard' + (isOpen ? ' open' : '')} style={{ borderLeftColor: p.color }}>
            <button className="prow" onClick={() => mine && setOpen(isOpen ? null : p.id)}>
              <Avatar color={p.color} emoji={p.emoji} photo={photos[p.id]} size={40} />
              <span className="pname">{p.name || `${t('playerName')} ${i + 1}`}</span>
              {showDevice && <span className="muted small">{mine ? t('here') : t('remote')}</span>}
            </button>
            {isOpen && (
              <div className="pedit">
                <div className="piece-hero" style={{ ['--c' as string]: p.color }}>
                  <PieceIcon id={p.emoji} color={p.color} size={150} />
                  <span className="piece-hero-name">{p.name || `${t('playerName')} ${i + 1}`}</span>
                </div>
                <label className="field">
                  <span>{t('playerName')}</span>
                  <input value={p.name} maxLength={16} autoFocus onChange={(e) => upd(p.id, { name: e.target.value })} />
                </label>
                <div className="field">
                  <span>{t('color')}</span>
                  <div className="swatches">
                    {COLORS.map((c) => (
                      <button key={c} className={'swatch' + (p.color === c ? ' on' : '')} style={{ background: c }}
                        aria-label={c} onClick={() => upd(p.id, { color: c })} />
                    ))}
                  </div>
                </div>
                <div className="field">
                  <span>{t('piece')}</span>
                  <div className="emojis">
                    {EMOJIS.map((e) => (
                      <button key={e} className={'emoji' + (p.emoji === e ? ' on' : '')} onClick={() => upd(p.id, { emoji: e })}
                        aria-label={pieceText(e)}><PieceIcon id={e} color={p.color} size={40} /></button>
                    ))}
                  </div>
                </div>
                <div className="field row photo-row">
                  <button className="btn ghost" onClick={() => {
                    if (canUseCamera()) setCameraFor(p.id);
                    else document.getElementById('cam-' + p.id)?.click();
                  }}>📷 {t('takePhoto')}</button>
                  {/* fallback: the phone's own camera app */}
                  <input id={'cam-' + p.id} type="file" accept="image/*" capture="user" hidden onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) onChange(players, { ...photos, [p.id]: await readPhoto(f) });
                    e.target.value = '';
                  }} />
                  <label className="btn ghost">
                    🖼️ {t('choosePhoto')}
                    <input type="file" accept="image/*" hidden onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) onChange(players, { ...photos, [p.id]: await readPhoto(f) });
                      e.target.value = '';
                    }} />
                  </label>
                  {photos[p.id] && (
                    <button className="btn ghost" onClick={() => { const ph = { ...photos }; delete ph[p.id]; onChange(players, ph); }}>
                      {t('removePhoto')}
                    </button>
                  )}
                  <span className="grow" />
                  <button className="btn danger ghost" onClick={() => remove(p.id)}>{t('remove')}</button>
                </div>
              </div>
            )}
            {!mine && canRemoveOthers && (
              <button className="btn danger ghost small kickbtn" onClick={() => store.kick(p.id)}>{t('kick')}</button>
            )}
          </div>
        );
      })}
      <button className="btn ghost wide" onClick={add} disabled={players.length >= 10}>+ {t('addPlayer')}</button>
    </div>
  );
}

// ---------------- host share panel ----------------

/** while a join keeps retrying: elapsed time, what to do, and a way out */
function JoinProgress({ started, notFound }: { started: number; notFound: boolean }) {
  const { t } = useT();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const i = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const sec = Math.max(0, Math.round((now - started) / 1000));
  return (
    <div className="join-progress" role="status">
      <div className="spinner" aria-hidden />
      <div>
        <strong>{t('joinTrying', { t: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` })}</strong>
        {notFound && <p className="small join-notfound">⚠️ {t('connectNotFound')}</p>}
        <p className="small muted">{t('joinHint')}</p>
        <button className="btn ghost small" onClick={() => store.cancelJoin()}>{t('cancel')}</button>
      </div>
    </div>
  );
}

export function SharePanel({ room }: { room: string }) {
  const { t } = useT();
  const { net } = useStore();
  const [qr, setQr] = useState('');
  const url = `${location.origin}${location.pathname}?join=${room}`;
  useEffect(() => { import('qrcode').then((m) => m.default.toDataURL(url, { margin: 1, width: 220 })).then(setQr).catch(() => setQr('')); }, [url]);
  return (
    <div className="share">
      <div>
        <div className="muted small">{t('roomCode')}</div>
        <div className="code">{room}</div>
        <div className="muted small">{net === 'ok' ? t('shareHint') : t('connecting')}</div>
        <button className="btn small share-btn" onClick={async () => {
          const text = t('shareText', { c: room });
          try {
            if (navigator.share) await navigator.share({ title: t('appName'), text, url });
            else { await navigator.clipboard.writeText(`${text}\n${url}`); store.toast('copied'); }
          } catch { /* the user closed the share sheet */ }
        }}>{t('shareCode')}</button>
        <div className="small host-stay">{t('hostStay')}</div>
      </div>
      {qr && <img className="qr" src={qr} alt="QR" />}
    </div>
  );
}

// ---------------- setup ----------------

type Tab = 'players' | 'board' | 'names' | 'cards' | 'rules';

export function SetupScreen() {
  const s = useStore();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('players');
  const setup = s.setup;
  const set = (patch: Partial<Setup>) => store.updateSetup({ ...setup, ...patch });

  const problem = useMemo(() => {
    const ps = setup.players;
    if (ps.length < 2) return 'needPlayers';
    if (ps.length > 10) return 'tooMany';
    const names = ps.map((p) => p.name.trim().toLowerCase());
    if (names.some((n) => !n) || new Set(names).size !== names.length) return 'nameTaken';
    return null;
  }, [setup.players]);

  return (
    <div className="screen setup">
      <header className="bar">
        <button className="btn ghost" onClick={() => store.goHome()}>← {t('back')}</button>
        <strong>{s.mode === 'host' ? t('hostOnline') : t('newLocal')}</strong>
      </header>
      {s.mode === 'host' && <SharePanel room={s.room} />}
      {s.mode === 'host' && <VersionWarning />}
      <nav className="tabs">
        {(['players', 'board', 'names', 'cards', 'rules'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t('setup' + k[0].toUpperCase() + k.slice(1))}
          </button>
        ))}
      </nav>
      <main className="pane">
        {tab === 'players' && (
          <>
            <p className="muted">{t('playersCount', { n: setup.players.length })}</p>
            <PlayersEditor players={setup.players} photos={s.photos} canRemoveOthers={s.mode === 'host'} showDevice={s.mode === 'host'}
              onChange={(players, photos) => store.updateSetup({ ...setup, players }, photos)} />
          </>
        )}
        {tab === 'board' && <BoardTab setup={setup} set={set} />}
        {tab === 'names' && <NamesTab setup={setup} set={set} />}
        {tab === 'cards' && <CardsTab setup={setup} set={set} />}
        {tab === 'rules' && <><RulesTab setup={setup} set={set} online={s.mode === 'host'} /><DeviceSettings /></>}
      </main>
      <footer className="sticky">
        {problem && <div className="muted small center">{t(problem)}</div>}
        <button className="btn primary wide" disabled={!!problem} onClick={() => store.startGame()}>{t('start')}</button>
      </footer>
    </div>
  );
}

function BoardTab({ setup, set }: { setup: Setup; set: (p: Partial<Setup>) => void }) {
  const { t } = useT();
  const suggested = setup.players.length >= 7 ? 'large' : 'classic';
  return (
    <div className="choices">
      {(['classic', 'large'] as const).map((id) => (
        <button key={id} className={'choice' + (setup.boardId === id ? ' on' : '')}
          onClick={() => set({ boardId: id, names: [] })}>
          <strong>{t(id)}</strong>
          {suggested === id && <span className="tag">{t('suggested')}</span>}
          <span className="muted">{t(id + 'Info')}</span>
        </button>
      ))}
    </div>
  );
}

function NamesTab({ setup, set }: { setup: Setup; set: (p: Partial<Setup>) => void }) {
  const { t, lang } = useT();
  const b = BOARDS[setup.boardId];
  const [picked, setPicked] = useState<number | null>(null);
  const map = setup.nameMap?.length === b.squares.length ? setup.nameMap : b.squares.map((_, i) => i);
  const names = b.squares.map((_, k) => setup.names[k] ?? '');
  const shown = (i: number) => defaultName(setup.boardId, setup.city, map, i, lang);
  const upd = (i: number, v: string) => { const n = [...names]; n[i] = v; set({ names: n }); };
  /** custom price: while typing keep the number; when leaving the field round to 10 € (10–5000), empty = normal price */
  const setPrice = (i: number, v: string, final: boolean) => {
    const prices = { ...(setup.prices ?? {}) };
    const n = Math.floor(Number(v));
    if (!v || !Number.isFinite(n) || n <= 0) delete prices[i];
    else prices[i] = final ? Math.min(5000, Math.max(10, Math.round(n / 10) * 10)) : n;
    if (final && prices[i] === b.squares[i].price) delete prices[i];
    set({ prices });
  };
  /** first tap picks a square, second tap swaps the two names (same kind of square only) */
  const tapMove = (i: number) => {
    if (picked === null || picked === i || b.squares[picked].kind !== b.squares[i].kind) { setPicked(picked === i ? null : i); return; }
    const nm = [...map];
    [nm[picked], nm[i]] = [nm[i], nm[picked]];
    const n = [...names];
    [n[picked], n[i]] = [n[i], n[picked]];
    set({ nameMap: nm, names: n });
    setPicked(null);
  };
  const row = (i: number, chip: ReactNode, movable = true) => {
    const sq = b.squares[i];
    const canTarget = picked !== null && picked !== i && b.squares[picked].kind === sq.kind;
    return (
      <div key={i} className={'name-row' + (picked === i ? ' picked' : '') + (canTarget ? ' target' : '')}>
        {chip}
        {movable && (
          <button className="btn small ghost move" aria-label={t('moveName')} onClick={() => tapMove(i)}>⇅</button>
        )}
        <input className="name-in" value={names[i]} placeholder={shown(i)} maxLength={32} onChange={(e) => upd(i, e.target.value)} />
        <input className={'price-in' + (setup.prices?.[i] ? ' changed' : '')} type="number" inputMode="numeric" step={10} min={10} max={5000}
          aria-label={t('price')} value={setup.prices?.[i] ?? ''} placeholder={String(sq.price)}
          onChange={(e) => setPrice(i, e.target.value, false)} onBlur={(e) => setPrice(i, e.target.value, true)} />
      </div>
    );
  };
  const stations = b.squares.map((sq, i) => (sq.kind === 'station' ? i : -1)).filter((i) => i >= 0);
  const utils = b.squares.map((sq, i) => (sq.kind === 'utility' ? i : -1)).filter((i) => i >= 0);
  return (
    <div>
      <div className="field">
        <span>{t('city')}</span>
        <div className="seg">
          {CITY_IDS.map((c) => (
            <button key={c} className={(setup.city ?? 'athens') === c ? 'on' : ''}
              onClick={() => { setPicked(null); set({ city: c, nameMap: undefined, names: [] }); }}>
              {CITIES[c].name[lang]}
            </button>
          ))}
        </div>
      </div>
      <p className="muted small">{picked === null ? t('moveHelp') : t('movePicked', { n: shown(picked) })}</p>
      {b.groups.map((grp, g) => (
        <div key={g} className="name-group" style={{ borderLeftColor: grp.color }}>
          {grp.members.map((i) => row(i, <span className="chip" style={{ background: grp.color }} />))}
        </div>
      ))}
      <div className="name-group" style={{ borderLeftColor: 'var(--ink-soft)' }}>
        {stations.map((i) => row(i, <span className="chip">🚆</span>))}
      </div>
      <div className="name-group" style={{ borderLeftColor: 'var(--ink-soft)' }}>
        {utils.map((i) => row(i, <span className="chip">💡</span>, false))}
      </div>
      <p className="muted small">{t('namesHelp')} {t('pricesHelp')}</p>
      <div className="row reset-row">
        <button className="btn ghost" onClick={() => { setPicked(null); set({ names: [], nameMap: undefined }); }}>↺ {t('resetNames')}</button>
        <button className="btn ghost" disabled={!setup.prices || !Object.keys(setup.prices).length}
          onClick={() => set({ prices: undefined })}>↺ {t('resetPrices')}</button>
      </div>
    </div>
  );
}

function effectFrom(kind: CustomEffectKind, v: { amount: number; sq: number; go: boolean; steps: number; house: number; hotel: number }): Effect {
  switch (kind) {
    case 'gain': return { t: 'money', amount: Math.abs(v.amount) };
    case 'pay': return { t: 'money', amount: -Math.abs(v.amount) };
    case 'collectEach': return { t: 'each', amount: Math.abs(v.amount) };
    case 'payEach': return { t: 'each', amount: -Math.abs(v.amount) };
    case 'goto': return { t: 'goto', sq: v.sq, go: v.go };
    case 'move': return { t: 'move', steps: v.steps };
    case 'jail': return { t: 'jail' };
    case 'jailCard': return { t: 'jailCard' };
    case 'repairs': return { t: 'repairs', house: Math.abs(v.house), hotel: Math.abs(v.hotel) };
  }
}

function describe(fx: Effect, t: (k: string, p?: Record<string, string | number>) => string, m: (n: number) => string, sqLabel: (i: number) => string) {
  switch (fx.t) {
    case 'money': return fx.amount >= 0 ? `${t('fx_gain')}: ${m(fx.amount)}` : `${t('fx_pay')}: ${m(-fx.amount)}`;
    case 'each': return fx.amount >= 0 ? `${t('fx_collectEach')}: ${m(fx.amount)}` : `${t('fx_payEach')}: ${m(-fx.amount)}`;
    case 'goto': return `${t('fx_goto')}: ${sqLabel(fx.sq)}`;
    case 'move': return `${t('fx_move')}: ${fx.steps}`;
    case 'jail': return t('fx_jail');
    case 'jailCard': return t('fx_jailCard');
    case 'repairs': return `${t('fx_repairs')}: ${m(fx.house)} / ${m(fx.hotel)}`;
    default: return '';
  }
}

function CardsTab({ setup, set }: { setup: Setup; set: (p: Partial<Setup>) => void }) {
  const { t, m, lang } = useT();
  const b = BOARDS[setup.boardId];
  const [draft, setDraft] = useState<null | { deck: Deck; text: string; kind: CustomEffectKind; amount: number; sq: number; go: boolean; steps: number; house: number; hotel: number }>(null);
  const sqLabel = (i: number) => setup.names[i] || b.squares[i]?.name[lang] || '?';
  const addCard = () => {
    if (!draft || !draft.text.trim()) return;
    const c: CustomCard = { deck: draft.deck, text: draft.text.trim(), fx: effectFrom(draft.kind, draft) };
    set({ customCards: [...setup.customCards, c] });
    setDraft(null);
  };
  const needs = (k: CustomEffectKind) => ({
    amount: ['gain', 'pay', 'collectEach', 'payEach'].includes(k),
    sq: k === 'goto', steps: k === 'move', repairs: k === 'repairs',
  });
  return (
    <div>
      <p className="muted">{t('defaultCards', { a: 16, b: 16 })}</p>
      <h3>{t('customCards')}</h3>
      {setup.customCards.length === 0 && <p className="muted">{t('noCustomCards')}</p>}
      <ul className="cardlist">
        {setup.customCards.map((c, i) => (
          <li key={i} className={'minicard ' + c.deck}>
            <div className="small muted">{t(c.deck)}</div>
            <div>{c.text}</div>
            <div className="small muted">{describe(c.fx, t, m, sqLabel)}</div>
            <button className="btn ghost small" onClick={() => set({ customCards: setup.customCards.filter((_, k) => k !== i) })}>{t('remove')}</button>
          </li>
        ))}
      </ul>
      {!draft && (
        <button className="btn ghost wide" onClick={() => setDraft({ deck: 'chance', text: '', kind: 'gain', amount: 50, sq: 0, go: true, steps: 3, house: 25, hotel: 100 })}>
          + {t('addCard')}
        </button>
      )}
      {draft && (
        <div className="panel">
          <div className="seg">
            {(['chance', 'chest'] as Deck[]).map((d) => (
              <button key={d} className={draft.deck === d ? 'on' : ''} onClick={() => setDraft({ ...draft, deck: d })}>{t(d)}</button>
            ))}
          </div>
          <label className="field"><span>{t('cardText')}</span>
            <textarea rows={2} maxLength={140} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          </label>
          <label className="field"><span>{t('cardEffect')}</span>
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CustomEffectKind })}>
              {CUSTOM_EFFECTS.map((k) => <option key={k} value={k}>{t('fx_' + k)}</option>)}
            </select>
          </label>
          {needs(draft.kind).amount && (
            <label className="field"><span>{t('amount')}</span>
              <input type="number" inputMode="numeric" min={0} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
            </label>
          )}
          {needs(draft.kind).sq && (
            <>
              <label className="field"><span>{t('square')}</span>
                <select value={draft.sq} onChange={(e) => setDraft({ ...draft, sq: Number(e.target.value) })}>
                  {b.squares.map((_, i) => <option key={i} value={i}>{i}. {sqLabel(i)}</option>)}
                </select>
              </label>
              <label className="check"><input type="checkbox" checked={draft.go} onChange={(e) => setDraft({ ...draft, go: e.target.checked })} /> {t('collectGo')}</label>
            </>
          )}
          {needs(draft.kind).steps && (
            <label className="field"><span>{t('steps')}</span>
              <input type="number" inputMode="numeric" value={draft.steps} onChange={(e) => setDraft({ ...draft, steps: Number(e.target.value) })} />
            </label>
          )}
          {needs(draft.kind).repairs && (
            <div className="row">
              <label className="field"><span>{t('perHouse')}</span>
                <input type="number" inputMode="numeric" min={0} value={draft.house} onChange={(e) => setDraft({ ...draft, house: Number(e.target.value) })} />
              </label>
              <label className="field"><span>{t('perHotel')}</span>
                <input type="number" inputMode="numeric" min={0} value={draft.hotel} onChange={(e) => setDraft({ ...draft, hotel: Number(e.target.value) })} />
              </label>
            </div>
          )}
          <div className="row">
            <button className="btn ghost" onClick={() => setDraft(null)}>{t('cancel')}</button>
            <button className="btn primary" disabled={!draft.text.trim()} onClick={addCard}>{t('add')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RulesTab({ setup, set, online }: { setup: Setup; set: (p: Partial<Setup>) => void; online: boolean }) {
  const { t, m } = useT();
  const r = setup.rules;
  const rules = (patch: Partial<Setup['rules']>) => set({ rules: { ...r, ...patch } });
  return (
    <div className="rules">
      <h3>{t('auctionMode')}</h3>
      {(['open', 'sealed'] as const).map((a) => (
        <label key={a} className="check">
          <input type="radio" name="auction" checked={r.auction === a} onChange={() => rules({ auction: a })} />
          {t(a === 'open' ? 'auctionOpen' : 'auctionSealed')}
        </label>
      ))}
      <h3>{t('houseRules')}</h3>
      {(['freeParking', 'doubleGo', 'noRentInJail', 'buyAfterLap', 'allowPass'] as const).map((k) => (
        <label key={k} className="check">
          <input type="checkbox" checked={!!r[k]} onChange={(e) => rules({ [k]: e.target.checked })} />
          {t('r_' + k)}
        </label>
      ))}
      <UpsetRules setup={setup} set={set} />
      <h3>{t('startCash')}</h3>
      <div className="row start-cash">
        <input type="number" inputMode="numeric" min={100} max={20000} step={50}
          value={r.startCash ?? ''} placeholder={String(BOARDS[setup.boardId].startCash)}
          onChange={(e) => rules({ startCash: e.target.value === '' ? undefined : Number(e.target.value) })}
          onBlur={() => { if (r.startCash !== undefined) rules({ startCash: startCashOf(r, BOARDS[setup.boardId].startCash) }); }} />
        <span className="muted small">€ · {t('startCashHint', { n: m(BOARDS[setup.boardId].startCash) })}</span>
      </div>
      <h3>{t('timeLimit')}</h3>
      <select value={r.timeLimitMin} onChange={(e) => rules({ timeLimitMin: Number(e.target.value) })}>
        {[0, 30, 45, 60, 90, 120, 180].map((n) => <option key={n} value={n}>{n ? t('minutes', { n }) : t('off')}</option>)}
      </select>
      {online && (
        <>
          <h3>{t('autoMove')}</h3>
          <select value={r.autoMoveSec} onChange={(e) => rules({ autoMoveSec: Number(e.target.value) })}>
            {[30, 60, 120, 300].map((n) => <option key={n} value={n}>{t('seconds', { n })}</option>)}
          </select>
        </>
      )}
    </div>
  );
}

// ---------------- upset rules ----------------

const EVERY = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20];
const PCTS = [5, 10, 15, 20, 25, 30, 40, 50];
type RuleKind = 'gain' | 'pay' | 'pct' | 'repairs' | 'jail' | 'loseHouse';
const RULE_KINDS: RuleKind[] = ['gain', 'pay', 'pct', 'repairs', 'jail', 'loseHouse'];
const WHOS: RuleWho[] = ['self', 'all', 'leader', 'last'];
interface RuleDraft { text: string; when: 'rounds' | 'go' | 'land'; n: number; sq: number; who: RuleWho; kind: RuleKind; amount: number; pct: number; house: number; hotel: number }

function ruleFrom(d: RuleDraft): CustomRule {
  const when = d.when === 'rounds' ? { t: 'rounds' as const, n: d.n } : d.when === 'land' ? { t: 'land' as const, sq: d.sq } : { t: 'go' as const };
  const what = d.kind === 'gain' ? { t: 'money' as const, amount: Math.abs(d.amount) }
    : d.kind === 'pay' ? { t: 'money' as const, amount: -Math.abs(d.amount) }
    : d.kind === 'pct' ? { t: 'pct' as const, pct: d.pct }
    : d.kind === 'repairs' ? { t: 'repairs' as const, house: d.house, hotel: d.hotel }
    : { t: d.kind };
  return { text: d.text, when, who: d.who, what };
}

function EverySelect({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const opts = EVERY.includes(value) ? EVERY : [...EVERY, value].sort((a, b) => a - b);
  return (
    <label className="field"><span>{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {opts.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
  );
}

function UpsetRules({ setup, set }: { setup: Setup; set: (p: Partial<Setup>) => void }) {
  const { t, lang } = useT();
  const r = setup.rules;
  const rules = (patch: Partial<Setup['rules']>) => set({ rules: { ...r, ...patch } });
  const b = BOARDS[setup.boardId];
  const sqLabel = (i: number) => setup.names[i] || defaultName(setup.boardId, setup.city, setup.nameMap, i, lang);
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const custom = r.custom ?? [];
  const wt = r.wealthTax;
  const cr = r.crisis;
  const preview = draft ? cleanCustomRule(ruleFrom(draft), b) : null;
  const addRule = () => {
    if (!preview) return;
    rules({ custom: [...custom, preview] });
    setDraft(null);
  };
  return (
    <div className="upsets">
      <h3>🔀 {t('upsets')}</h3>
      <p className="muted small">{t('upsetsHint')}</p>

      <label className="check">
        <input type="checkbox" checked={!!wt} onChange={(e) => rules({ wealthTax: e.target.checked ? { ...DEFAULT_WEALTH_TAX } : undefined })} />
        💰 {t('u_wealthTax')}
      </label>
      {wt && (
        <div className="panel upset-opts">
          <div className="seg">
            {(['leader', 'above'] as const).map((w) => (
              <button key={w} className={wt.who === w ? 'on' : ''} onClick={() => rules({ wealthTax: { ...wt, who: w } })}>
                {t(w === 'leader' ? 'wtWhoLeader' : 'wtWhoAbove')}
              </button>
            ))}
          </div>
          <div className="row">
            <label className="field"><span>{t('percent')}</span>
              <select value={wt.pct} onChange={(e) => rules({ wealthTax: { ...wt, pct: Number(e.target.value) } })}>
                {(PCTS.includes(wt.pct) ? PCTS : [...PCTS, wt.pct].sort((a, b2) => a - b2)).map((n) => <option key={n} value={n}>{n}%</option>)}
              </select>
            </label>
            <EverySelect label={t('everyRounds')} value={wt.every} onChange={(n) => rules({ wealthTax: { ...wt, every: n } })} />
          </div>
          <p className="small muted">{wealthTaxText(lang, r)}</p>
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={!!r.underdog} onChange={(e) => rules({ underdog: e.target.checked || undefined })} />
        🆙 {t('u_underdog')}
      </label>

      <label className="check">
        <input type="checkbox" checked={!!cr} onChange={(e) => rules({ crisis: e.target.checked ? { ...DEFAULT_CRISIS } : undefined })} />
        📉 {t('u_crisis')}
      </label>
      {cr && (
        <div className="panel upset-opts">
          <div className="row">
            <EverySelect label={t('everyRounds')} value={cr.every} onChange={(n) => rules({ crisis: { ...cr, every: n } })} />
            <label className="field"><span>{t('perHouse')}</span>
              <input type="number" inputMode="numeric" min={0} step={5} value={cr.house}
                onChange={(e) => rules({ crisis: { ...cr, house: Number(e.target.value) } })} onBlur={() => rules({ crisis: cleanCrisis(cr) })} />
            </label>
            <label className="field"><span>{t('perHotel')}</span>
              <input type="number" inputMode="numeric" min={0} step={5} value={cr.hotel}
                onChange={(e) => rules({ crisis: { ...cr, hotel: Number(e.target.value) } })} onBlur={() => rules({ crisis: cleanCrisis(cr) })} />
            </label>
          </div>
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={!!r.quake} onChange={(e) => rules({ quake: e.target.checked ? { ...DEFAULT_QUAKE } : undefined })} />
        🌋 {t('u_quake')}
      </label>
      {r.quake && (
        <div className="panel upset-opts">
          <EverySelect label={t('everyRounds')} value={r.quake.every} onChange={(n) => rules({ quake: { every: n } })} />
          <p className="small muted">{t('u_quakeDesc', { e: r.quake.every })}</p>
        </div>
      )}

      <h3>📜 {t('customRules')}</h3>
      {custom.length === 0 && <p className="muted small">{t('noCustomRules')}</p>}
      <ul className="cardlist">
        {custom.map((c, i) => (
          <li key={i} className="minicard rulecard">
            {c.text && <div><strong>{c.text}</strong></div>}
            <div className="small">{customRuleText(lang, c, sqLabel)}</div>
            <button className="btn ghost small" onClick={() => rules({ custom: custom.filter((_, k) => k !== i) })}>{t('remove')}</button>
          </li>
        ))}
      </ul>
      {!draft && custom.length < MAX_CUSTOM_RULES && (
        <button className="btn ghost wide" onClick={() => setDraft({ text: '', when: 'rounds', n: 5, sq: 0, who: 'leader', kind: 'pay', amount: 100, pct: 10, house: 25, hotel: 100 })}>
          + {t('addRule')}
        </button>
      )}
      {draft && (
        <div className="panel rule-draft">
          <label className="field"><span>{t('ruleName')}</span>
            <input value={draft.text} maxLength={RULE_TEXT_MAX} placeholder={t('ruleNamePh')} onChange={(e) => setDraft({ ...draft, text: e.target.value })} />
          </label>
          <label className="field"><span>1. {t('ruleWhen')}</span>
            <select value={draft.when} onChange={(e) => setDraft({ ...draft, when: e.target.value as RuleDraft['when'] })}>
              {(['rounds', 'go', 'land'] as const).map((w) => <option key={w} value={w}>{t('when_' + w)}</option>)}
            </select>
          </label>
          {draft.when === 'rounds' && <EverySelect label={t('everyRounds')} value={draft.n} onChange={(n) => setDraft({ ...draft, n })} />}
          {draft.when === 'land' && (
            <label className="field"><span>{t('square')}</span>
              <select value={draft.sq} onChange={(e) => setDraft({ ...draft, sq: Number(e.target.value) })}>
                {b.squares.map((_, i) => <option key={i} value={i}>{i}. {sqLabel(i)}</option>)}
              </select>
            </label>
          )}
          <label className="field"><span>2. {t('ruleWho')}</span>
            <select value={draft.who} onChange={(e) => setDraft({ ...draft, who: e.target.value as RuleWho })}>
              {WHOS.map((w) => <option key={w} value={w}>{t('who_' + w)}</option>)}
            </select>
          </label>
          <label className="field"><span>3. {t('ruleWhat')}</span>
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as RuleKind })}>
              {RULE_KINDS.map((k) => <option key={k} value={k}>{t('do_' + k)}</option>)}
            </select>
          </label>
          {(draft.kind === 'gain' || draft.kind === 'pay') && (
            <label className="field"><span>{t('amount')}</span>
              <input type="number" inputMode="numeric" min={10} step={10} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} />
            </label>
          )}
          {draft.kind === 'pct' && (
            <label className="field"><span>{t('percent')}</span>
              <select value={draft.pct} onChange={(e) => setDraft({ ...draft, pct: Number(e.target.value) })}>
                {PCTS.map((n) => <option key={n} value={n}>{n}%</option>)}
              </select>
            </label>
          )}
          {draft.kind === 'repairs' && (
            <div className="row">
              <label className="field"><span>{t('perHouse')}</span>
                <input type="number" inputMode="numeric" min={0} step={5} value={draft.house} onChange={(e) => setDraft({ ...draft, house: Number(e.target.value) })} />
              </label>
              <label className="field"><span>{t('perHotel')}</span>
                <input type="number" inputMode="numeric" min={0} step={5} value={draft.hotel} onChange={(e) => setDraft({ ...draft, hotel: Number(e.target.value) })} />
              </label>
            </div>
          )}
          {preview && <p className="rule-preview">📜 {customRuleText(lang, preview, sqLabel)}</p>}
          <div className="row">
            <button className="btn ghost" onClick={() => setDraft(null)}>{t('cancel')}</button>
            <button className="btn primary" disabled={!preview} onClick={addRule}>{t('add')}</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- join / lobby (client) ----------------

export function JoinScreen() {
  const { t } = useT();
  const s = useStore();
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get('join') ?? '');
  useEffect(() => {
    if (code && new URLSearchParams(location.search).get('join')) {
      history.replaceState(null, '', location.pathname);
      store.join(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={() => store.goHome()}>← {t('back')}</button>
        <strong>{t('joinOnline')}</strong>
      </header>
      <main className="pane">
        <label className="field"><span>{t('enterCode')}</span>
          <input className="codein" value={code} maxLength={5} autoCapitalize="characters" autoComplete="off"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
        </label>
        <button className="btn primary wide" disabled={code.length < 5 || s.net === 'connecting'} onClick={() => store.join(code)}>
          {s.net === 'connecting' ? t('connecting') : t('connect')}
        </button>
        {s.net === 'connecting' && s.joinUntil > 0 && <JoinProgress started={s.joinStarted} notFound={s.joinNotFound} />}
      </main>
    </div>
  );
}

export function LobbyScreen() {
  const { t } = useT();
  const s = useStore();
  const mine = s.setup.players.filter((p) => p.device === s.device);
  const others = s.setup.players.filter((p) => p.device !== s.device);
  const [draft, setDraft] = useState<PlayerSetup[]>(mine);
  const [photos, setPhotos] = useState<Record<string, string>>(() => Object.fromEntries(mine.filter((p) => s.photos[p.id]).map((p) => [p.id, s.photos[p.id]])));
  const [sent, setSent] = useState(mine.length > 0);
  const [tab, setTab] = useState<Tab>('players');
  const valid = draft.length > 0 && draft.every((p) => p.name.trim());
  const noop = () => { /* guests can look, not change */ };
  return (
    <div className="screen setup">
      <header className="bar">
        <button className="btn ghost" onClick={() => store.goHome()}>← {t('back')}</button>
        <strong>{t('roomCode')}: {s.room}</strong>
      </header>
      <VersionWarning />
      <nav className="tabs">
        {(['players', 'board', 'names', 'cards', 'rules'] as Tab[]).map((k) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {t('setup' + k[0].toUpperCase() + k.slice(1))}
          </button>
        ))}
      </nav>
      <main className="pane">
        {tab === 'players' ? (
          <>
            <h3>{t('yourPlayers')}</h3>
            <PlayersEditor players={draft} photos={photos} others={others} onChange={(p, ph) => { setDraft(p); setPhotos(ph); setSent(false); }} />
            <button className="btn primary wide" disabled={!valid || sent} onClick={() => { store.sendMyPlayers(draft, photos); setSent(true); }}>
              {t('save')}
            </button>
            <h3>{t('players')}</h3>
            <ul className="plist">
              {others.map((p) => (
                <li key={p.id}><Avatar color={p.color} emoji={p.emoji} photo={s.photos[p.id]} size={28} /> {p.name}</li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <p className="readonly-note">🔒 {t('hostOnlyChanges')}</p>
            {/* the host's settings, shown but locked */}
            <fieldset className="readonly" disabled>
              {tab === 'board' && <BoardTab setup={s.setup} set={noop} />}
              {tab === 'names' && <NamesTab setup={s.setup} set={noop} />}
              {tab === 'cards' && <CardsTab setup={s.setup} set={noop} />}
              {tab === 'rules' && <RulesTab setup={s.setup} set={noop} online />}
            </fieldset>
          </>
        )}
        {(tab === 'players' || tab === 'rules') && <DeviceSettings />}
        <p className="muted center">{t('waitingHost')}</p>
      </main>
    </div>
  );
}

/** the game had already started: fill in a player and ask the host to come in */
export function LateJoinScreen() {
  const { t } = useT();
  const s = useStore();
  const [draft, setDraft] = useState<PlayerSetup[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [asked, setAsked] = useState(false);
  const me = draft[0];
  return (
    <div className="screen setup">
      <header className="bar">
        <button className="btn ghost" onClick={() => store.goHome()}>← {t('back')}</button>
        <strong>{t('roomCode')}: {s.room}</strong>
      </header>
      <main className="pane">
        <div className="readonly-note">⏱️ {t('lateHelp')}</div>
        {asked ? (
          <div className="join-progress" role="status">
            <div className="spinner" aria-hidden />
            <div><strong>{t('lateWaiting')}</strong><p className="small muted">{t('lateWaitingHelp')}</p></div>
          </div>
        ) : (
          <>
            <PlayersEditor players={draft.slice(0, 1)} photos={photos} others={s.lateOthers}
              onChange={(p, ph) => { setDraft(p.slice(0, 1)); setPhotos(ph); }} />
            <button className="btn primary wide" disabled={!me || !me.name.trim()}
              onClick={() => { store.askLate(me, photos[me.id]); setAsked(true); }}>🙋 {t('lateAsk')}</button>
          </>
        )}
        <h3>{t('players')}</h3>
        <ul className="plist">
          {s.lateOthers.map((p) => <li key={p.id}><Avatar color={p.color} emoji={p.emoji} size={28} /> {p.name}</li>)}
        </ul>
      </main>
    </div>
  );
}

// ---------------- per-device effects ----------------

export function DeviceSettings() {
  const { t } = useT();
  const { fx } = useStore();
  const webgl = useMemo(() => hasWebGL(), []);
  return (
    <div className="rules">
      <h3>{t('deviceSettings')}</h3>
      <div className="field">
        <span>{t('gfx')}</span>
        <div className="seg">
          <button className={fx.gfx === '3d' ? 'on' : ''} disabled={!webgl} onClick={() => store.setFx({ gfx: '3d' })}>{t('gfx3d')}</button>
          <button className={fx.gfx === '2d' || !webgl ? 'on' : ''} onClick={() => store.setFx({ gfx: '2d' })}>{t('gfx2d')}</button>
        </div>
      </div>
      
      <LightPicker />
      <ContrastPicker />
      <QualityPicker />
      <label className="check"><input type="checkbox" checked={fx.cinema} onChange={(e) => store.setFx({ cinema: e.target.checked })} />{t('fxCinema')}</label>
      <label className="check"><input type="checkbox" checked={fx.sound} onChange={(e) => store.setFx({ sound: e.target.checked })} />{t('fxSound')}</label>
      <label className="check"><input type="checkbox" checked={fx.vibrate} onChange={(e) => store.setFx({ vibrate: e.target.checked })} />{t('fxVibrate')}</label>
      <label className="check">
        <input type="checkbox" checked={fx.shake} onChange={async (e) => {
          const on = e.target.checked;
          if (on && !(await requestMotion())) { store.toast('motionDenied'); store.setFx({ shake: false }); return; }
          store.setFx({ shake: on });
        }} />
        {t('fxShake')}
      </label>
    </div>
  );
}

