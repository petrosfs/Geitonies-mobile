import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DICTS, tr } from './i18n';

/* Every message the game can show must exist in Greek and English. */

const src = (f: string) => readFileSync(join(__dirname, f), 'utf8');
const all = (re: RegExp, text: string) => [...text.matchAll(re)].map((m) => m[1]);

describe('translations', () => {
  it('Greek and English have exactly the same keys', () => {
    const el = Object.keys(DICTS.el).sort();
    const en = Object.keys(DICTS.en).sort();
    expect(en.filter((k) => !el.includes(k))).toEqual([]);
    expect(el.filter((k) => !en.includes(k))).toEqual([]);
  });

  it('every history (log) entry written by the rules has a text', () => {
    const keys = new Set(all(/log\(g, '([a-zA-Z]+)'/g, src('game/engine.ts')));
    expect(keys.size).toBeGreaterThan(30);
    for (const k of keys) expect(DICTS.el['l_' + k], 'l_' + k).toBeTruthy();
  });

  it('every rule error has a text', () => {
    const keys = new Set(all(/fail\('([a-zA-Z]+)'\)/g, src('game/engine.ts')));
    expect(keys.size).toBeGreaterThan(20);
    for (const k of keys) expect(DICTS.el['e_' + k], 'e_' + k).toBeTruthy();
  });

  it('every text key used in the screens exists', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.tsx') || f === 'store.ts');
    const missing: string[] = [];
    for (const f of files) {
      const text = src(f);
      for (const k of all(/\bt\('([a-zA-Z_]+)'\s*[,)]/g, text)) if (!(k in DICTS.el)) missing.push(`${f}: ${k}`);
      for (const k of all(/toast\('([a-zA-Z_]+)'\)/g, text).filter((k) => !k.endsWith('_'))) if (!(k in DICTS.el)) missing.push(`${f}: toast ${k}`);
      for (const k of all(/key: '([a-zA-Z_]+)'/g, text).filter((k) => !k.endsWith('_'))) if (!(k in DICTS.el)) missing.push(`${f}: ${k}`);
    }
    expect(missing).toEqual([]);
  });

  it('placeholders are filled in', () => {
    expect(tr('el', 'turnOf', { p: 'Νίκος' })).toBe('Σειρά: Νίκος');
    expect(tr('en', 'buy', { n: '60 €' })).toBe('Buy for 60 €');
    for (const lang of ['el', 'en'] as const) {
      for (const [k, v] of Object.entries(DICTS[lang])) {
        const other = DICTS[lang === 'el' ? 'en' : 'el'][k];
        const ph = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join();
        expect(ph(v), `${lang}.${k}`).toBe(ph(other));
      }
    }
  });
});
