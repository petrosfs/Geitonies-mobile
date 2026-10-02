import Peer, { type DataConnection } from 'peerjs';
import { apply, autoAction, newGame, RuleError, waiting } from './game/engine';
import { BOARDS } from './game/boards';
import type { Action, Game, Lang, PlayerSetup, Setup } from './game/types';

export type Mode = 'local' | 'host' | 'client';
export type Screen = 'home' | 'setup' | 'join' | 'lobby' | 'game';
export type Net = 'idle' | 'connecting' | 'ok' | 'lost' | 'error';

/** settings of this device only */
export type BoardLight = 'normal' | 'dim' | 'night';
export interface Fx { gfx: '3d' | '2d'; sound: boolean; vibrate: boolean; shake: boolean; cinema: boolean; light: BoardLight }

export interface ChatMsg { id: string; from: string; text: string; t: number }
export const CHAT_MAX = 200;

export interface State {
  screen: Screen;
  lang: Lang;
  fx: Fx;
  mode: Mode;
  device: string;
  room: string;
  gen: number;
  setup: Setup;
  game: Game | null;
  photos: Record<string, string>;
  /** device id -> online (host view, sent to everyone) */
  presence: Record<string, boolean>;
  hostDevice: string;
  net: Net;
  lostSince: number;
  toast: string | null;
  kicked: boolean;
  hasSave: boolean;
  /** in-app confirmation dialog (browser confirm() is blocked in some embeds) */
  /** chat between phones (online games) */
  chat: ChatMsg[];
  chatSeen: number;
  ask: null | { key: string; params?: Record<string, string | number>; yes: string; danger?: boolean; onYes: () => void };
}

type Msg =
  | { type: 'hello'; device: string }
  | { type: 'join'; players: PlayerSetup[] }
  | { type: 'act'; by: string; action: Action }
  | { type: 'lobby'; setup: Setup; photos: Record<string, string>; hostDevice: string }
  | { type: 'state'; game: Game; presence: Record<string, boolean>; hostDevice: string }
  | { type: 'photos'; photos: Record<string, string> }
  | { type: 'err'; key: string }
  | { type: 'kicked' }
  | { type: 'ping'; v?: number; gid?: string }
  | { type: 'sync' }
  | { type: 'pong' }
  | { type: 'chat'; from: string; text: string }
  | { type: 'chatmsg'; msg: ChatMsg }
  | { type: 'chatlog'; msgs: ChatMsg[] };

// 5 minutes (a smaller value can be set in localStorage 'gtn-takeover-ms' for testing)
export const TAKEOVER_MS = (() => {
  try { return Number(localStorage.getItem('gtn-takeover-ms')) || 5 * 60 * 1000; } catch { return 5 * 60 * 1000; }
})();
const PREFIX = 'gtn7-';
const SAVE_KEY = 'gtn-save';
const PREF_KEY = 'gtn-prefs';
const peerId = (room: string, gen: number) => `${PREFIX}${room}-${gen}`;

function uid(n = 10) {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  const r = crypto.getRandomValues(new Uint32Array(n));
  for (let i = 0; i < n; i++) s += a[r[i] % a.length];
  return s;
}
export const newRoomCode = () => uid(5).toUpperCase();

export function defaultRules(): Setup['rules'] {
  return {
    auction: 'open', freeParking: false, doubleGo: false, noRentInJail: false,
    buyAfterLap: false, timeLimitMin: 0, autoMoveSec: 60,
  };
}
export function emptySetup(): Setup {
  return { players: [], boardId: 'classic', names: [], customCards: [], rules: defaultRules() };
}

const DEFAULT_FX: Fx = { gfx: '3d', sound: true, vibrate: true, shake: true, cinema: true, light: 'normal' };

function loadPrefs(): { lang: Lang; device: string; fx: Fx } {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    if (p.device) {
      const fx = { ...DEFAULT_FX, ...(p.fx ?? {}) };
      if (!['normal', 'dim', 'night'].includes(fx.light)) fx.light = 'normal';
      return { lang: p.lang === 'en' ? 'en' : 'el', device: p.device, fx };
    }
  } catch { /* ignore */ }
  const prefs = { lang: (navigator.language?.startsWith('el') ? 'el' : 'en') as Lang, device: uid(12), fx: DEFAULT_FX };
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  return prefs;
}

interface Save {
  mode: Mode; room: string; gen: number; setup: Setup; game: Game | null;
  photos: Record<string, string>; hostDevice: string; chat?: ChatMsg[];
}
function readSave(): Save | null {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? (JSON.parse(s) as Save) : null; } catch { return null; }
}

// ------------------------------------------------------------------

class Store {
  private s: State;
  private listeners = new Set<() => void>();
  private peer: Peer | null = null;
  /** host: device -> its open connections (a computer may have the game open in more than one tab) */
  private conns = new Map<string, Set<DataConnection>>();
  /** tests only: drop this many state broadcasts (to check that phones catch up by themselves) */
  dropStates = 0;
  private allConns(): DataConnection[] { return [...this.conns.values()].flatMap((set) => [...set]); }
  private sendDevice(device: string, m: Msg) { this.conns.get(device)?.forEach((c) => { if (c.open) c.send(m); }); }
  private lastSeen = new Map<string, number>();       // host: device -> ms
  private offSince = new Map<string, number>();       // host: device -> ms
  private hostConn: DataConnection | null = null;     // client
  private lastHostMsg = 0;
  private timers: number[] = [];
  private retryTimer = 0;
  private beat = 0;

  constructor() {
    document.addEventListener('visibilitychange', () => this.onResume());
    const prefs = loadPrefs();
    this.s = {
      screen: 'home', lang: prefs.lang, fx: prefs.fx, mode: 'local', device: prefs.device,
      room: '', gen: 0, setup: emptySetup(), game: null, photos: {}, presence: {},
      hostDevice: '', net: 'idle', lostSince: 0, toast: null, kicked: false,
      hasSave: !!readSave()?.game,
      ask: null,
      chat: [],
      chatSeen: 0,
    };
  }

  get = () => this.s;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
  private set(patch: Partial<State>) {
    this.s = { ...this.s, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** show a message: a translation key, or raw text starting with '#' */
  toast(key: string | null) {
    this.set({ toast: key });
    if (key) window.setTimeout(() => { if (this.s.toast === key) this.set({ toast: null }); }, key.startsWith('#') ? 4500 : 3200);
  }

  private savePrefs() {
    const { lang, device, fx } = this.s;
    try { localStorage.setItem(PREF_KEY, JSON.stringify({ lang, device, fx })); } catch { /* ignore */ }
  }
  confirm(ask: NonNullable<State['ask']>) { this.set({ ask }); }
  closeAsk() { this.set({ ask: null }); }

  /** forget the saved game and go home */
  deleteGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    this.goHome();
  }

  setLang(lang: Lang) { this.set({ lang }); this.savePrefs(); }
  setFx(patch: Partial<Fx>) { this.set({ fx: { ...this.s.fx, ...patch } }); this.savePrefs(); }

  private persist() {
    const { mode, room, gen, setup, game, photos, hostDevice, chat } = this.s;
    try {
      if (game?.over) localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify({ mode, room, gen, setup, game, photos, hostDevice, chat: chat.slice(-100) }));
    } catch { /* storage full: ignore */ }
  }

  // ---------------- navigation ----------------

  goHome() {
    this.teardown();
    this.set({ screen: 'home', game: null, net: 'idle', mode: 'local', kicked: false, hasSave: !!readSave()?.game });
  }

  newLocal() {
    this.teardown();
    this.set({ chat: [], chatSeen: 0, screen: 'setup', mode: 'local', setup: emptySetup(), photos: {}, game: null, hostDevice: this.s.device, presence: {} });
  }

  newHost() {
    this.teardown();
    const room = newRoomCode();
    this.set({ chat: [], chatSeen: 0, screen: 'setup', mode: 'host', room, gen: 0, setup: emptySetup(), photos: {}, game: null, hostDevice: this.s.device, presence: { [this.s.device]: true } });
    this.openHost(room, 0);
  }

  openJoin() {
    this.teardown();
    this.set({ chat: [], chatSeen: 0, screen: 'join', mode: 'client', net: 'idle', game: null, setup: emptySetup(), photos: {} });
  }

  resume() {
    const sv = readSave();
    if (!sv?.game) return;
    this.teardown();
    this.set({
      mode: sv.mode, room: sv.room, gen: sv.gen, setup: sv.setup, game: sv.game,
      photos: sv.photos ?? {}, hostDevice: sv.hostDevice, screen: 'game', presence: {},
      chat: sv.chat ?? [], chatSeen: (sv.chat ?? []).length,
    });
    if (sv.mode === 'local') { this.startTimers(); return; }
    if (sv.mode === 'client') { this.connectClient(sv.room, sv.gen, true); return; }
    // host: maybe someone took over while we were away
    this.probeTakeover(sv.room, sv.gen);
  }

  // ---------------- setup / lobby ----------------

  updateSetup(setup: Setup, photos?: Record<string, string>) {
    this.set({ setup, photos: photos ?? this.s.photos });
    if (this.s.mode === 'host') this.broadcastLobby();
  }

  /** client: send this device's players to the host */
  sendMyPlayers(players: PlayerSetup[], photos: Record<string, string>) {
    const mine = players.map((p) => ({ ...p, device: this.s.device, photo: photos[p.id] }));
    this.send({ type: 'join', players: mine });
  }

  startGame() {
    const { setup, device } = this.s;
    const clean: Setup = { ...setup, players: setup.players.map(({ photo: _p, ...p }) => p) };
    const g = newGame(clean, crypto.getRandomValues(new Uint32Array(1))[0], Date.now());
    this.set({ game: g, screen: 'game', hostDevice: device });
    this.persist();
    this.broadcastState();
    this.startTimers();
  }

  /** same players, same settings, new game (local or host) */
  rematch() {
    if (this.s.mode === 'client' || !this.s.setup.players.length) return;
    // everyone plays again (bankrupt players too), except players the host removed
    const kicked = new Set(this.s.game?.log.filter((e) => e.k === 'kicked').map((e) => String(e.a?.p)));
    const players = this.s.setup.players.filter((p) => !kicked.has(p.id));
    if (players.length < 2) { this.goHome(); return; }
    this.set({ setup: { ...this.s.setup, players } });
    this.startGame();
  }

  // ---------------- actions ----------------

  act(by: string, action: Action) {
    const { mode, game } = this.s;
    if (!game) return;
    if (mode === 'client') {
      if (this.s.net !== 'ok') { this.toast('hostLost'); return; }
      this.send({ type: 'act', by, action });
      return;
    }
    this.applyLocal(by, action);
  }

  private applyLocal(by: string, action: Action, from?: DataConnection): boolean {
    const g = this.s.game;
    if (!g) return false;
    try {
      const next = apply(g, by, action, Date.now());
      if (next === g) return true;
      this.set({ game: next });
      this.persist();
      this.broadcastState();
      return true;
    } catch (e) {
      if (e instanceof RuleError) {
        if (from) {
          from.send({ type: 'err', key: 'e_' + e.message } satisfies Msg);
          // the phone was probably looking at an old screen: send it the real state
          if (this.s.game) from.send(this.stateMsg());
        }
        else if (by !== 'host') this.toast('e_' + e.message);
        return false;
      }
      console.error(e);
      this.toast('e_notNow');
      return false;
    }
  }

  // ---------------- chat ----------------

  /** send a chat line as player `from` (one of this phone's players) */
  sendChat(from: string, text: string) {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
    if (!clean) return;
    if (this.s.mode === 'client') { this.send({ type: 'chat', from, text: clean }); return; }
    this.addChat({ id: uid(8), from, text: clean, t: Date.now() }, true);
  }

  markChatSeen() { this.set({ chatSeen: this.s.chat.length }); }

  private addChat(msg: ChatMsg, mine: boolean) {
    if (this.s.chat.some((c) => c.id === msg.id)) return;
    const chat = [...this.s.chat, msg].slice(-200);
    this.set({ chat, chatSeen: mine ? chat.length : this.s.chatSeen });
    if (this.s.mode === 'host') this.allConns().forEach((c) => { if (c.open) c.send({ type: 'chatmsg', msg } satisfies Msg); });
    if (!mine) {
      const name = this.s.game?.players.find((p) => p.id === msg.from)?.name ?? this.s.setup.players.find((p) => p.id === msg.from)?.name ?? '';
      this.toast('#' + (name ? name + ': ' : '') + msg.text);
    }
    this.persist();
  }

  kick(playerId: string) {
    if (this.s.mode === 'client') return;
    const g = this.s.game;
    if (g) {
      this.applyLocal('host', { t: 'kick', id: playerId });
      const dev = g.players.find((p) => p.id === playerId)?.device;
      const ng = this.s.game;
      if (dev && ng && ng.players.filter((p) => p.device === dev && !p.out).length === 0) {
        this.sendDevice(dev, { type: 'kicked' });
      }
    } else {
      // lobby: remove the player; if it was the last one of that device, drop the device
      const pl = this.s.setup.players.find((p) => p.id === playerId);
      const setup = { ...this.s.setup, players: this.s.setup.players.filter((p) => p.id !== playerId) };
      this.updateSetup(setup);
      if (pl && pl.device !== this.s.device && !setup.players.some((p) => p.device === pl.device)) {
        const set = [...(this.conns.get(pl.device) ?? [])];
        set.forEach((c) => c.send({ type: 'kicked' } satisfies Msg));
        window.setTimeout(() => set.forEach((c) => c.close()), 500);
      }
    }
  }

  // ---------------- timers (host / local) ----------------

  private startTimers() {
    this.stopTimers();
    this.timers.push(window.setInterval(() => {
      const g = this.s.game;
      if (!g || g.over) return;
      if (g.rules.timeLimitMin > 0) this.applyLocal('host', { t: 'tick' });
    }, 15000));
    if (this.s.mode === 'host') {
      this.timers.push(window.setInterval(() => this.hostHeartbeat(), 1000));
    }
  }
  private stopTimers() { this.timers.forEach((t) => clearInterval(t)); this.timers = []; }

  private hostHeartbeat() {
    const now = Date.now();
    if (this.peer && !this.peer.destroyed && this.peer.disconnected) this.keepSignalling(this.peer);
    const g = this.s.game;
    // presence
    const presence: Record<string, boolean> = { [this.s.device]: true };
    const devices = new Set((g?.players ?? this.s.setup.players).map((p) => p.device));
    let changed = false;
    for (const d of devices) {
      if (d === this.s.device) continue;
      const on = (this.conns.get(d)?.size ?? 0) > 0 && now - (this.lastSeen.get(d) ?? 0) < 15000;
      presence[d] = on;
      if (on) this.offSince.delete(d);
      else if (!this.offSince.has(d)) this.offSince.set(d, now);
      if (this.s.presence[d] !== on) changed = true;
    }
    if (changed) { this.set({ presence }); this.broadcastState(); }
    // ping every 5 s
    // ping every few seconds, with the game version so phones that missed an update can ask for it
    if (++this.beat % 3 === 0) {
      const ping: Msg = { type: 'ping', v: this.s.game?.v, gid: this.s.game?.gid };
      this.allConns().forEach((c) => { if (c.open) c.send(ping); });
    }
    // automatic moves for absent players
    if (!g || g.over) return;
    const limit = g.rules.autoMoveSec * 1000;
    for (const id of waiting(g)) {
      const p = g.players.find((x) => x.id === id);
      if (!p || p.device === this.s.device) continue;
      const since = this.offSince.get(p.device);
      if (since !== undefined && now - since >= limit) {
        const a = autoAction(g, id);
        if (a) { this.applyLocal(id, a); return; }
      }
    }
  }

  // ---------------- networking: host ----------------

  private openHost(room: string, gen: number, onTaken?: () => void) {
    this.set({ net: 'connecting', room, gen, mode: 'host', hostDevice: this.s.device });
    const peer = new Peer(peerId(room, gen));
    this.peer = peer;
    peer.on('open', () => {
      this.set({ net: 'ok' });
      if (this.s.game) { this.persist(); this.startTimers(); }
    });
    peer.on('connection', (conn) => this.onHostConn(conn));
    // lost the signalling server: keep retrying, otherwise nobody new (or refreshed) can connect
    peer.on('disconnected', () => this.keepSignalling(peer));
    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'unavailable-id') {
        peer.destroy();
        if (onTaken) { onTaken(); return; }
        // our old id may still be registered for a moment: retry
        this.retryTimer = window.setTimeout(() => this.openHost(room, gen), 4000);
        return;
      }
      if (err.type === 'peer-unavailable') return;
      if (['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(err.type ?? '')) {
        this.keepSignalling(peer);
        return;
      }
      this.set({ net: 'error' });
      this.toast('netError');
    });
  }

  private signalTimer = 0;
  /** host: reconnect to the signalling server every few seconds until it works */
  private keepSignalling(peer: Peer) {
    if (this.signalTimer) return; // a retry is already scheduled (don't keep pushing it back)
    this.signalTimer = window.setTimeout(() => {
      this.signalTimer = 0;
      if (this.peer !== peer || peer.destroyed) return;
      if (peer.disconnected) {
        try { peer.reconnect(); } catch { /* try again below */ }
        this.keepSignalling(peer);
      }
    }, 2500);
  }

  /** the app came back to the foreground (phones pause web pages in the background) */
  private onResume = () => {
    if (document.visibilityState !== 'visible') return;
    const { mode, game, room, gen, net } = this.s;
    if (mode === 'host') {
      if (!this.peer || this.peer.destroyed) this.openHost(room, gen);
      else if (this.peer.disconnected) this.keepSignalling(this.peer);
    } else if (mode === 'client' && game && net !== 'ok' && net !== 'connecting') {
      this.connectClient(room, gen, true);
    }
  };

  /** client: drop the connection and connect again (menu button) */
  reconnect() {
    const { mode, room, gen } = this.s;
    if (mode === 'client') { this.set({ lostSince: 0 }); this.connectClient(room, gen, true); }
    else if (mode === 'host') {
      if (!this.peer || this.peer.destroyed) this.openHost(room, gen);
      else { if (this.peer.disconnected) this.keepSignalling(this.peer); this.broadcastState(); }
    }
  }

  private onHostConn(conn: DataConnection) {
    let device = '';
    conn.on('data', (raw) => {
      const m = raw as Msg;
      if (device) this.lastSeen.set(device, Date.now());
      switch (m.type) {
        case 'hello': {
          device = m.device;
          if (!this.conns.has(device)) this.conns.set(device, new Set());
          this.conns.get(device)!.add(conn);
          this.lastSeen.set(device, Date.now());
          const g = this.s.game;
          if (g) {
            if (!g.players.some((p) => p.device === device && !p.out)) {
              conn.send({ type: 'err', key: 'started' } satisfies Msg);
              return;
            }
            conn.send({ type: 'photos', photos: this.s.photos } satisfies Msg);
            conn.send({ type: 'chatlog', msgs: this.s.chat.slice(-100) } satisfies Msg);
            this.hostHeartbeat();
            conn.send(this.stateMsg());
          } else {
            conn.send(this.lobbyMsg());
            conn.send({ type: 'chatlog', msgs: this.s.chat.slice(-100) } satisfies Msg);
          }
          return;
        }
        case 'join': {
          if (!device || this.s.game) return;
          const others = this.s.setup.players.filter((p) => p.device !== device);
          const incoming = m.players.slice(0, Math.max(0, 10 - others.length)).map((p) => ({ ...p, device }));
          if (incoming.length < m.players.length) conn.send({ type: 'err', key: 'full' } satisfies Msg);
          const photos = { ...this.s.photos };
          incoming.forEach((p) => { if (p.photo) photos[p.id] = p.photo; else delete photos[p.id]; });
          const players = [...others, ...incoming.map(({ photo: _x, ...p }) => p)];
          this.updateSetup({ ...this.s.setup, players }, photos);
          return;
        }
        case 'sync': {
          if (this.s.game) conn.send(this.stateMsg()); else conn.send(this.lobbyMsg());
          return;
        }
        case 'chat': {
          const players = this.s.game?.players ?? this.s.setup.players;
          const p = players.find((x) => x.id === m.from);
          if (!p || p.device !== device || typeof m.text !== 'string') return;
          const text = m.text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX);
          if (text) this.addChat({ id: uid(8), from: m.from, text, t: Date.now() }, false);
          return;
        }
        case 'ping':
          conn.send({ type: 'pong' } satisfies Msg);
          return;
        case 'act': {
          const g = this.s.game;
          const p = g?.players.find((x) => x.id === m.by);
          if (!g || !p || p.device !== device) { conn.send({ type: 'err', key: 'e_notNow' } satisfies Msg); return; }
          this.applyLocal(m.by, m.action, conn);
          return;
        }
        default: return;
      }
    });
    conn.on('close', () => {
      if (device) {
        const set = this.conns.get(device);
        set?.delete(conn);
        if (set && !set.size) this.conns.delete(device);
      }
      this.hostHeartbeat();
    });
    conn.on('error', () => { /* handled by close */ });
  }

  private lobbyMsg(): Msg {
    return { type: 'lobby', setup: this.s.setup, photos: this.s.photos, hostDevice: this.s.device };
  }
  private stateMsg(): Msg {
    return { type: 'state', game: this.s.game!, presence: this.s.presence, hostDevice: this.s.device };
  }
  private broadcastLobby() {
    const m = this.lobbyMsg();
    this.allConns().forEach((c) => { if (c.open) c.send(m); });
  }
  private broadcastState() {
    if (this.s.mode !== 'host' || !this.s.game) return;
    if (this.dropStates > 0) { this.dropStates--; return; }
    const m = this.stateMsg();
    this.allConns().forEach((c) => { if (c.open) c.send(m); });
  }

  // ---------------- networking: client ----------------

  join(code: string) {
    const room = code.trim().toUpperCase();
    if (!room) return;
    this.set({ room, gen: 0 });
    this.connectClient(room, 0, false);
  }

  /** try host ids gen, gen+1, gen+2 (someone may have taken over) */
  private connectClient(room: string, gen: number, resuming: boolean) {
    this.clearPeer();
    this.set({ net: 'connecting', mode: 'client', room });
    const peer = new Peer();
    this.peer = peer;
    let attempt = 0;
    const tryNext = () => {
      if (this.peer !== peer) return;
      if (attempt > 2) {
        if (resuming || this.s.game) {
          // keep trying in the background while the host is away
          this.markLost();
          this.retryTimer = window.setTimeout(() => this.connectClient(room, this.s.gen, true), 5000);
        } else {
          this.set({ net: 'error' });
          this.toast('connectFail');
        }
        return;
      }
      const target = gen + attempt;
      attempt++;
      const conn = peer.connect(peerId(room, target), { reliable: true, serialization: 'json' });
      const timeout = window.setTimeout(() => { if (!conn.open) { conn.close(); tryNext(); } }, 6000);
      conn.on('open', () => {
        clearTimeout(timeout);
        this.hostConn = conn;
        this.lastHostMsg = Date.now();
        this.set({ net: 'ok', gen: target, lostSince: 0 });
        conn.send({ type: 'hello', device: this.s.device } satisfies Msg);
      });
      conn.on('data', (raw) => this.onClientData(raw as Msg));
      conn.on('close', () => {
        if (this.hostConn === conn) { this.hostConn = null; this.onHostLost(); }
      });
    };
    peer.on('open', () => tryNext());
    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'peer-unavailable') { tryNext(); return; }
      if (this.s.game) { this.onHostLost(); return; }
      this.set({ net: 'error' });
      this.toast('connectFail');
    });
    // watchdog: host pings every 5 s
    this.stopTimers();
    this.timers.push(window.setInterval(() => {
      if (this.hostConn?.open) this.hostConn.send({ type: 'ping' } satisfies Msg);
      if (this.s.net === 'ok' && Date.now() - this.lastHostMsg > 30000) {
        this.hostConn?.close();
        this.hostConn = null;
        this.onHostLost();
      }
    }, 2000));
  }

  private markLost() {
    if (this.s.net !== 'lost') this.set({ net: 'lost', lostSince: this.s.lostSince || Date.now() });
  }

  private onHostLost() {
    if (this.s.kicked) return;
    this.markLost();
    window.clearTimeout(this.retryTimer);
    this.retryTimer = window.setTimeout(() => this.connectClient(this.s.room, this.s.gen, true), 5000);
  }

  private onClientData(m: Msg) {
    this.lastHostMsg = Date.now();
    switch (m.type) {
      case 'lobby':
        this.set({ setup: m.setup, photos: m.photos, hostDevice: m.hostDevice, screen: 'lobby' });
        return;
      case 'photos':
        this.set({ photos: m.photos });
        return;
      case 'chatmsg': {
        const mine = !!(this.s.game?.players ?? this.s.setup.players).find((p) => p.id === m.msg.from && p.device === this.s.device);
        this.addChat(m.msg, mine);
        return;
      }
      case 'chatlog': {
        const known = new Set(this.s.chat.map((c) => c.id));
        const merged = [...this.s.chat, ...m.msgs.filter((c) => !known.has(c.id))].sort((a, b) => a.t - b.t).slice(-200);
        this.set({ chat: merged, chatSeen: Math.max(this.s.chatSeen, this.s.chat.length) });
        return;
      }
      case 'state': {
        // the host is the authority: always take its state (messages on one connection arrive in order,
        // and after a reconnect or a host restart the host's copy is the true one)
        this.set({ game: m.game, presence: m.presence, hostDevice: m.hostDevice, screen: 'game' });
        this.persist();
        return;
      }
      case 'ping':
        // any difference from the host's copy (newer, older or another game): ask for the real state
        if (this.s.game && m.v !== undefined && (m.gid !== this.s.game.gid || m.v !== this.s.game.v)) this.send({ type: 'sync' });
        return;
      case 'err':
        // the host said no: we may be looking at an old state, so ask for the current one
        if (m.key.startsWith('e_')) this.send({ type: 'sync' });
        if (m.key === 'started' || m.key === 'full') {
          this.toast(m.key);
          if (m.key === 'started' && !this.s.game) this.set({ net: 'error' });
          return;
        }
        this.toast(m.key);
        return;
      case 'kicked':
        this.set({ kicked: true, net: 'idle' });
        try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
        this.teardown();
        return;
      default: return;
    }
  }

  /** client: become the host (after the host has been away for TAKEOVER_MS) */
  takeOver() {
    const { room, gen, game } = this.s;
    if (!game) return;
    this.clearPeer();
    this.openHost(room, gen + 1, () => {
      // somebody else was faster: join them
      this.connectClient(room, gen + 1, true);
    });
    this.set({ mode: 'host', gen: gen + 1, lostSince: 0, presence: { [this.s.device]: true } });
    this.persist();
  }

  /** returning host: join a newer host if one exists, otherwise host again */
  private probeTakeover(room: string, gen: number) {
    this.set({ net: 'connecting' });
    const peer = new Peer();
    this.peer = peer;
    let k = 1;
    const tryNext = () => {
      if (this.peer !== peer) return;
      if (k > 3) { peer.destroy(); this.peer = null; this.openHost(room, gen); return; }
      const target = gen + k++;
      const conn = peer.connect(peerId(room, target), { reliable: true, serialization: 'json' });
      const to = window.setTimeout(() => { if (!conn.open) { conn.close(); tryNext(); } }, 4000);
      conn.on('open', () => {
        clearTimeout(to);
        conn.close();
        peer.destroy();
        this.peer = null;
        this.set({ mode: 'client' });
        this.connectClient(room, target, true);
      });
    };
    peer.on('open', () => tryNext());
    peer.on('error', (err: { type?: string }) => {
      if (err.type === 'peer-unavailable') { tryNext(); return; }
      peer.destroy(); this.peer = null; this.openHost(room, gen);
    });
  }

  private send(m: Msg) {
    if (this.hostConn?.open) this.hostConn.send(m);
    else this.toast('hostLost');
  }

  private clearPeer() {
    window.clearTimeout(this.retryTimer);
    this.allConns().forEach((c) => c.close());
    this.conns.clear();
    this.hostConn?.close();
    this.hostConn = null;
    this.peer?.destroy();
    this.peer = null;
  }

  private teardown() {
    this.stopTimers();
    this.clearPeer();
  }

  /** local mode resume needs timers */
  startLocalTimers() { this.startTimers(); }
}

export const store = new Store();
export { BOARDS };

// debugging/tests only: expose the store when localStorage 'gtn-debug' is set
try { if (localStorage.getItem('gtn-debug')) (window as unknown as { __store: Store }).__store = store; } catch { /* ignore */ }
