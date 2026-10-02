import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { store } from './store';
import { hasWebGL, requestMotion } from './fx';
import { BOARDS, isOwnable } from './game/boards';
import { CUSTOM_EFFECTS, type CustomEffectKind } from './game/cards';
import type { CustomCard, Deck, Effect, PlayerSetup, Setup } from './game/types';
import { COLORS, EMOJIS, readPhoto, useStore, useT } from './ui';
import { Avatar, PieceIcon } from './components';
import { pieceText } from './three/pieces';
import { LightPicker } from './Game';

const newId = () => Math.random().toString(36).slice(2, 10);

// ---------------- players ----------------

export function PlayersEditor({ players, photos, onChange, canRemoveOthers, showDevice, others = [] }: {
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
                <div className="field row">
                  <label className="btn ghost">
                    📷 {t('takePhoto')}
                    <input type="file" accept="image/*" capture="user" hidden onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) onChange(players, { ...photos, [p.id]: await readPhoto(f) });
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

export function SharePanel({ room }: { room: string }) {
  const { t } = useT();
  const { net } = useStore();
  const [qr, setQr] = useState('');
  const url = `${location.origin}${location.pathname}?join=${room}`;
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 220 }).then(setQr).catch(() => setQr('')); }, [url]);
  return (
    <div className="share">
      <div>
        <div className="muted small">{t('roomCode')}</div>
        <div className="code">{room}</div>
        <div className="muted small">{net === 'ok' ? t('shareHint') : t('connecting')}</div>
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
  const upd = (i: number, v: string) => {
    const names = b.squares.map((_, k) => setup.names[k] ?? '');
    names[i] = v;
    set({ names });
  };
  return (
    <div>
      <p className="muted">{t('namesHelp')}</p>
      <div className="names">
        {b.squares.map((sq, i) => isOwnable(sq) && (
          <label key={i} className="name-row">
            <span className="chip" style={{ background: sq.group !== undefined ? b.groups[sq.group].color : 'var(--ink-soft)' }}>
              {sq.kind === 'station' ? '🚆' : sq.kind === 'utility' ? '💡' : ''}
            </span>
            <input value={setup.names[i] ?? ''} placeholder={sq.name[lang]} maxLength={32} onChange={(e) => upd(i, e.target.value)} />
          </label>
        ))}
      </div>
      <button className="btn ghost" onClick={() => set({ names: [] })}>{t('resetNames')}</button>
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
  const { t } = useT();
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
      {(['freeParking', 'doubleGo', 'noRentInJail', 'buyAfterLap'] as const).map((k) => (
        <label key={k} className="check">
          <input type="checkbox" checked={r[k]} onChange={(e) => rules({ [k]: e.target.checked })} />
          {t('r_' + k)}
        </label>
      ))}
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
  const valid = draft.length > 0 && draft.every((p) => p.name.trim());
  return (
    <div className="screen">
      <header className="bar">
        <button className="btn ghost" onClick={() => store.goHome()}>← {t('back')}</button>
        <strong>{t('roomCode')}: {s.room}</strong>
      </header>
      <main className="pane">
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
        <DeviceSettings />
        <p className="muted center">{t('waitingHost')}</p>
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

