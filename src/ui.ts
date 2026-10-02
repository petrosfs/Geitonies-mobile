import { useSyncExternalStore } from 'react';
import { store } from './store';
import { money as fmtMoney, tr } from './i18n';
import { board, sqName } from './game/engine';
import { PIECES } from './three/pieces';
import type { Card, Game, LogEntry } from './game/types';

export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useT() {
  const { lang } = useStore();
  const t = (k: string, p?: Record<string, string | number>) => tr(lang, k, p);
  const m = (n: number) => fmtMoney(lang, n);
  return { t, m, lang };
}

export const COLORS = ['#e5484d', '#f76b15', '#e2a300', '#30a46c', '#12a594', '#0090ff', '#3e63dd', '#8e4ec6', '#d6409f', '#7a5c48', '#23272b'];
/** piece choices (ids; most are emoji, some are names like 'iron') */
export const EMOJIS = PIECES;

/** resize a camera/gallery photo to a small square jpeg */
export function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const S = 96;
      const c = document.createElement('canvas');
      c.width = S; c.height = S;
      const ctx = c.getContext('2d')!;
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, S, S);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export function playerName(g: Game, id: string) {
  return g.players.find((p) => p.id === id)?.name ?? id;
}

const MONEY_KEYS = new Set(['paid', 'debt', 'rent', 'tax', 'pot', 'bought', 'bid', 'won', 'got', 'salary']);

export function logText(g: Game, e: LogEntry, lang: 'el' | 'en'): string {
  const a: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(e.a ?? {})) {
    if (k === 'p' || k === 'o') a[k] = playerName(g, String(v));
    else if (k === 'to') a[k] = v === 'bank' ? tr(lang, 'bank') : v === 'pot' ? tr(lang, 'pot', { n: '' }).replace(/[: ]+$/, '') : playerName(g, String(v));
    else if (k === 'sq') a[k] = sqName(g, Number(v), lang);
    else if (k === 'n' && MONEY_KEYS.has(e.k)) a[k] = fmtMoney(lang, Number(v));
    else a[k] = v;
  }
  return tr(lang, 'l_' + e.k, a);
}

export function cardText(g: Game, c: Card, lang: 'el' | 'en'): string {
  const raw = typeof c.text === 'string' ? c.text : c.text[lang];
  if (c.fx.t === 'goto') return raw.split('{sq}').join(sqName(g, c.fx.sq, lang));
  return raw;
}

export function groupColor(g: Game, sq: number): string | undefined {
  const s = board(g).squares[sq];
  return s.group !== undefined ? board(g).groups[s.group].color : undefined;
}
