import { expect, test } from '@playwright/test';
import { freshStart, newLocalGame, playRolls, step, watchErrors } from './helpers';

test('local game on the 3D board: many turns without errors', async ({ page }) => {
  test.setTimeout(540_000); // software 3D in CI is slow
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '3d', sound: false, vibrate: false, shake: false, cinema: true } });
  await newLocalGame(page, ['Μαρία', 'Νίκος', 'Ελένη']);
  await expect(page.locator('.board3d canvas')).toBeVisible();
  await playRolls(page, 6, 7 * 60_000);
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!));
  expect(save.game.rolls).toBeGreaterThanOrEqual(6);
  expect(errors).toEqual([]);
});

test('local game on the 2D board', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await newLocalGame(page, ['Α', 'Β']);
  await expect(page.locator('.board .cell').first()).toBeVisible();
  await playRolls(page, 10);
  expect(errors).toEqual([]);
});

test('menu: exit keeps the game, resume, delete', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await newLocalGame(page, ['Α', 'Β']);
  // the menu is reachable even while the "pass the phone" screen is up
  await page.locator('.gamebar .btn').first().click();
  await page.getByRole('button', { name: 'Έξοδος στην αρχική' }).click();
  await page.getByText('Συνέχεια παρτίδας').click();
  await expect(page.locator('.gamebar')).toBeVisible();
  await page.locator('.handoff .btn').click();
  await page.locator('.gamebar .btn').first().click();
  await page.getByRole('button', { name: 'Διαγραφή παρτίδας' }).click();
  await page.locator('.modal .btn.danger').last().click();
  await expect(page.getByText('Νέα παρτίδα σε αυτό το κινητό')).toBeVisible();
  await expect(page.getByText('Συνέχεια παρτίδας')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('going to jail: cage in 3D and the banner', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '3d', sound: false, vibrate: false, shake: false, cinema: true } });
  await newLocalGame(page, ['Μαρία', 'Νίκος']);
  // the current player has just drawn the "go to jail" card
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gtn-save')!);
    const g = s.game;
    const card = g.cards.find((c: { fx: { t: string } }) => c.fx.t === 'jail').id;
    g.players[g.cur].pos = 7;
    g.q = [{ k: 'card', card, who: g.players[g.cur].id }];
    localStorage.setItem('gtn-save', JSON.stringify(s));
  });
  await page.reload();
  await page.getByText('Συνέχεια παρτίδας').click();
  await page.locator('.handoff .btn').click();
  await page.locator('.modal .btn.primary').click();
  await expect(page.locator('.jailbanner')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.jailbanner')).toHaveCount(0, { timeout: 10_000 });
  const jailed = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game.players.some((p: { jail: boolean }) => p.jail));
  expect(jailed).toBe(true);
  expect(errors).toEqual([]);
});

test('English interface and no chat button in a one-phone game', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page);
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByText('New game on this phone')).toBeVisible();
  await page.getByRole('button', { name: 'Ελληνικά' }).click();
  await newLocalGame(page, ['Α', 'Β']);
  await expect(page.locator('.dock')).not.toContainText('Τσατ');
  expect(errors).toEqual([]);
});

test('end of game: statistics, then a rematch with the same players', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await newLocalGame(page, ['Μαρία', 'Νίκος', 'Ελένη']);
  await playRolls(page, 4);
  // the current player owes far more than they have
  const before = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gtn-save')!);
    const g = s.game;
    const me = g.players[g.cur];
    const other = g.players.find((p: { id: string }) => p.id !== me.id);
    g.q = [{ k: 'debt', who: me.id, owed: [{ to: other.id, amount: 999999 }] }];
    localStorage.setItem('gtn-save', JSON.stringify(s));
    return g.gid;
  });
  await page.reload();
  await page.getByText('Συνέχεια παρτίδας').click();
  await expect(page.locator('.gamebar')).toBeVisible(); // the game screen is open (its code may arrive a moment later)
  // two players are left after this bankruptcy, so force a second one
  for (let k = 0; k < 2; k++) {
    if (await page.locator('.handoff .btn').count()) await page.locator('.handoff .btn').click();
    await page.getByRole('button', { name: 'Χρεοκοπία' }).click();
    await page.locator('.modal .btn.danger').last().click();
    if (k === 0) {
      await page.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('gtn-save')!);
        const g = s.game;
        const me = g.players[g.cur];
        const other = g.players.find((p: { id: string; out: boolean }) => p.id !== me.id && !p.out);
        g.q = [{ k: 'debt', who: me.id, owed: [{ to: other.id, amount: 999999 }] }];
        localStorage.setItem('gtn-save', JSON.stringify(s));
      });
      await page.reload();
      await page.getByText('Συνέχεια παρτίδας').click();
      await expect(page.locator('.gamebar')).toBeVisible();
    }
  }
  await expect(page.getByText('Τέλος παιχνιδιού')).toBeVisible();
  await expect(page.getByText('Πώς πήγε η παρτίδα')).toBeVisible();
  await expect(page.locator('.chart svg polyline')).toHaveCount(3);
  await page.getByRole('button', { name: /Ρεβάνς/ }).click();
  await expect(page.locator('.gamebar')).toBeVisible();
  const after = await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('gtn-save')!).game;
    return { gid: g.gid, n: g.players.length, out: g.players.filter((p: { out: boolean }) => p.out).length };
  });
  expect(after.gid).not.toBe(before);
  expect(after).toMatchObject({ n: 3, out: 0 });
  expect(errors).toEqual([]);
});

test('rules: from the home screen, and inside a game with that game\'s settings', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByRole('button', { name: /Κανόνες/ }).click();
  await expect(page.locator('.rule')).toHaveCount(13);
  await page.locator('.rule summary', { hasText: 'Φυλακή' }).click();
  await expect(page.locator('.rule[open]')).toContainText('50 €');
  await page.getByRole('button', { name: 'Κλείσιμο' }).click();
  await newLocalGame(page, ['Α', 'Β']);
  await page.locator('.gamebar .btn').first().click();
  await page.getByRole('button', { name: /Κανόνες/ }).click();
  await expect(page.locator('.rules-game')).toContainText('Σε αυτή την παρτίδα');
  await expect(page.locator('.rules-game')).toContainText('Ανοιχτή');
  expect(errors).toEqual([]);
});

test('names: choose Thessaloniki and move a neighbourhood to another colour', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  for (const n of ['Α', 'Β']) {
    await page.getByText('Προσθήκη παίκτη').click();
    await page.locator('.pedit input').first().fill(n);
  }
  await page.getByRole('button', { name: /Ονόματα/ }).click();
  await page.getByRole('button', { name: 'Θεσσαλονίκη' }).click();
  await expect(page.locator('.name-row .name-in').first()).toHaveAttribute('placeholder', 'Μενεμένη');
  // move the first (cheapest) neighbourhood to the most expensive square
  await page.locator('.name-group').first().locator('.move').first().click();
  await page.locator('.name-group').nth(7).locator('.move').last().click();
  await expect(page.locator('.name-group').nth(7).locator('.name-in').last()).toHaveAttribute('placeholder', 'Μενεμένη');
  await page.getByText('Έναρξη παιχνιδιού').click();
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game);
  expect(g.city).toBe('thessaloniki');
  expect(g.nameMap[39]).toBe(1);
  expect(errors).toEqual([]);
});

test("prices: change a property's price in the setup and buy it at that price", async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  for (const n of ['Α', 'Β']) {
    await page.getByText('Προσθήκη παίκτη').click();
    await page.locator('.pedit input').first().fill(n);
  }
  await page.getByRole('button', { name: /Ονόματα/ }).click();
  const first = page.locator('.name-group').first().locator('.price-in').first();
  await expect(first).toHaveAttribute('placeholder', '60');
  await first.fill('87');
  await first.blur();
  await expect(first).toHaveValue('90');   // rounded to 10 €
  await page.getByText('Έναρξη παιχνιδιού').click();
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game);
  expect(g.prices).toEqual({ 1: 90 });
  expect(errors).toEqual([]);
});

test('names and prices: separate reset buttons', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  await page.getByRole('button', { name: /Ονόματα/ }).click();
  const resetPrices = page.getByRole('button', { name: /Επαναφορά τιμών/ });
  await expect(resetPrices).toBeDisabled();
  const price = page.locator('.name-group').first().locator('.price-in').first();
  const name = page.locator('.name-row .name-in').first();
  await price.fill('90'); await price.blur();
  await name.fill('Δοκιμή'); await name.blur();
  // resetting the names keeps the prices
  await page.getByRole('button', { name: /Επαναφορά ονομάτων/ }).click();
  await expect(name).toHaveValue('');
  await expect(price).toHaveValue('90');
  // and resetting the prices keeps the names
  await name.fill('Δοκιμή'); await name.blur();
  await resetPrices.click();
  await expect(price).toHaveValue('');
  await expect(name).toHaveValue('Δοκιμή');
  await expect(resetPrices).toBeDisabled();
  expect(errors).toEqual([]);
});

test('board contrast: the slider in the game menu, saved and applied', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await newLocalGame(page, ['Α', 'Β']);
  await page.locator('button', { hasText: '✕' }).first().click();
  const slider = page.getByRole('slider', { name: 'Αντίθεση ταμπλό' });
  await slider.fill('130');
  await expect(page.locator('.screen.game')).toHaveClass(/contrasted/);
  await expect(page.locator('.board')).toHaveCSS('filter', /contrast\(1\.3\)/);
  const fx = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-prefs')!).fx);
  expect(fx.contrast).toBe(130);
  await page.locator('.contrast-row button').click();
  await expect(page.locator('.screen.game')).not.toHaveClass(/contrasted/);
  expect(errors).toEqual([]);
});

test('upsets: wealth tax with its options and a custom rule, in the setup and in the game', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  for (const n of ['Α', 'Β']) {
    await page.getByText('Προσθήκη παίκτη').click();
    await page.locator('.pedit input').first().fill(n);
  }
  await page.locator('nav.tabs button', { hasText: 'Κανόνες' }).click();
  await page.getByLabel('Φόρος πλούτου').check();
  await page.getByRole('button', { name: 'Όσοι είναι πάνω από τον μέσο όρο' }).click();
  await page.getByLabel('Ποσοστό %').selectOption('20');
  await page.locator('.upset-opts').getByLabel('Κάθε πόσους γύρους').selectOption('3');
  await page.getByLabel(/Επίδομα ουραγού/).check();
  await page.getByRole('button', { name: /Νέος κανόνας/ }).click();
  await page.getByLabel('Όνομα (προαιρετικό)').fill('Δημοτικά τέλη');
  await page.getByLabel(/1\. Πότε/).selectOption('go');
  await page.getByLabel(/2\. Ποιος/).selectOption('all');
  await page.getByLabel(/3\. Τι/).selectOption('pay');
  await page.getByLabel('Ποσό (€)').fill('50');
  await expect(page.locator('.rule-preview')).toContainText('Όταν περνά από την Αφετηρία: όλοι πληρώνουν');
  await page.getByRole('button', { name: 'Προσθήκη', exact: true }).click();
  await expect(page.locator('.rulecard')).toContainText('Δημοτικά τέλη');
  await page.getByText('Έναρξη παιχνιδιού').click();
  const g = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game);
  expect(g.rules.wealthTax).toEqual({ every: 3, pct: 20, who: 'above' });
  expect(g.rules.underdog).toBe(true);
  expect(g.rules.custom).toEqual([{ text: 'Δημοτικά τέλη', when: { t: 'go' }, who: 'all', what: { t: 'money', amount: -50 } }]);
  // the game's rules list them
  await page.locator('button', { hasText: '✕' }).first().click();
  await page.getByRole('button', { name: /Κανόνες/ }).first().click();
  await expect(page.locator('.rules-game')).toContainText('Φόρος πλούτου: κάθε 3 γύρους');
  await expect(page.locator('.rules-game')).toContainText('Δημοτικά τέλη');
  expect(errors).toEqual([]);
});

test('graphics quality: the setting changes the 3D board, and auto shows the level in use', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '3d', sound: false, vibrate: false, shake: false, cinema: false, quality: 'auto' } });
  await page.evaluate(() => localStorage.setItem('gtn-debug', '1'));
  await page.reload();
  await newLocalGame(page, ['Α', 'Β']);
  await page.locator('button', { hasText: '✕' }).first().click();
  await expect(page.getByText('Ποιότητα γραφικών')).toBeVisible();
  await expect(page.getByText(/τώρα: (Υψηλή|Μέτρια|Χαμηλή)/)).toBeVisible();
  const look = () => page.evaluate(() => {
    const sc = (window as unknown as { __scene: { renderer: { getPixelRatio(): number }; sunLight: { castShadow: boolean }; boardCanvas: HTMLCanvasElement } }).__scene;
    return { dpr: sc.renderer.getPixelRatio(), shadows: sc.sunLight.castShadow, tex: sc.boardCanvas.width };
  });
  const q = page.locator('.field', { hasText: 'Ποιότητα γραφικών' });
  await q.getByRole('button', { name: 'Χαμηλή', exact: true }).click();
  await expect.poll(look).toEqual({ dpr: 1, shadows: false, tex: 2048 });
  expect((await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-prefs')!).fx)).quality).toBe('low');
  await q.getByRole('button', { name: 'Υψηλή', exact: true }).click();
  await expect.poll(async () => (await look()).shadows).toBe(true);
  expect(errors).toEqual([]);
});

test('a piece of the app fails to load: one reload by itself, then a message (no blank page)', async ({ browser }) => {
  const ctx = await browser.newContext({ serviceWorkers: 'block', locale: 'el-GR' });
  const page = await ctx.newPage();
  await page.route(/\/assets\/Setup-[^/]*\.js$/, (r) => r.abort());
  let loads = 0;
  page.on('load', () => { loads++; });
  await page.goto('/');
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  await expect(page.getByText(/Ένα κομμάτι της εφαρμογής δεν φόρτωσε/)).toBeVisible({ timeout: 20000 });
  expect(loads).toBeLessThanOrEqual(2); // at most one automatic reload, never a loop
  // the connection is back: the button brings the app back
  await page.unroute(/\/assets\/Setup-[^/]*\.js$/);
  await page.getByRole('button', { name: 'Επαναφόρτωση' }).click();
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  await expect(page.getByText('Προσθήκη παίκτη')).toBeVisible();
  await ctx.close();
});

test('3D: a banner cut short by the next roll never comes back after that move', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '3d', sound: false, vibrate: false, shake: false, cinema: false, quality: 'low' } });
  await page.evaluate(() => localStorage.setItem('gtn-debug', '1'));
  await page.reload();
  await newLocalGame(page, ['Α', 'Β']);
  if (await page.locator('.handoff .btn').count()) await page.locator('.handoff .btn').click();
  // the player in turn stands before Start; the first street belongs to the other one; dice: 1+1 (doubles), then 2+3
  await page.evaluate(() => {
    type G = { players: { id: string; pos: number }[]; cur: number; props: Record<number, { owner: string | null }>; rng: number; v: number };
    const st = (window as unknown as { __store: { get: () => { game: G }; set: (p: object) => void } }).__store;
    const g = structuredClone(st.get().game);
    const me = g.players[g.cur], other = g.players[1 - g.cur];
    me.pos = 39; g.props[1].owner = other.id; g.rng = 3998; g.v++;
    st.set({ game: g });
  });
  await page.waitForTimeout(1500);
  await page.locator('.btn.roll').click();
  await expect(page.locator('.rentbanner.ev-rent')).toBeVisible({ timeout: 40_000 });
  await page.locator('.btn.roll').click(); // doubles: roll again while the rent card is still up
  // the second move ends on a free street (buy offer); the old rent card must not show up again
  await expect(page.getByRole('button', { name: /Αγορά/ })).toBeVisible({ timeout: 60_000 });
  const seen: string[] = [];
  for (let i = 0; i < 30; i++) {
    seen.push(...(await page.locator('.rentbanner').evaluateAll((els) => els.map((e) => e.className))));
    await page.waitForTimeout(100);
  }
  expect(seen).toEqual([]);
  expect(errors).toEqual([]);
});

test('3D zoom goes toward the point under the mouse; the camera stays over the board; 🎯 brings it back', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '3d', sound: false, vibrate: false, shake: false, cinema: false, quality: 'low' } });
  await page.evaluate(() => localStorage.setItem('gtn-debug', '1'));
  await page.reload();
  await newLocalGame(page, ['Α', 'Β']);
  if (await page.locator('.handoff .btn').count()) await page.locator('.handoff .btn').click();
  await page.waitForTimeout(2500);
  type Sc = { controls: { target: { x: number; y: number; z: number } }; follow: boolean; W: number };
  const cam = () => page.evaluate(() => { const sc = (window as unknown as { __scene: Sc }).__scene; return { ...sc.controls.target, follow: sc.follow, W: sc.W }; });
  const before = await cam();
  const box = (await page.locator('.board3d-canvas canvas').boundingBox())!;
  // zoom in toward a point well right of the middle
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5);
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(60); }
  await page.waitForTimeout(600);
  const after = await cam();
  expect(after.follow).toBe(false);
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  expect(moved).toBeGreaterThan(after.W * 0.05);
  expect(Math.abs(after.x)).toBeLessThanOrEqual(after.W * 0.62 + 1e-6);
  expect(Math.abs(after.z)).toBeLessThanOrEqual(after.W * 0.62 + 1e-6);
  await page.locator('.recenter').click();
  await expect.poll(async () => (await cam()).follow).toBe(true);
  expect(errors).toEqual([]);
});

test('colours: two players can\'t pick the same one; a player changes colour during the game', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  for (const n of ['Α', 'Β']) {
    await page.getByText('Προσθήκη παίκτη').click();
    await page.locator('.pedit input').first().fill(n);
  }
  // the editor is open for Β: Α's colour is taken
  await expect(page.locator('.pedit .swatch.taken')).toHaveCount(1);
  await expect(page.locator('.pedit .swatch.taken')).toBeDisabled();
  await page.getByText('Έναρξη παιχνιδιού').click();
  await expect(page.locator('.gamebar')).toBeVisible();
  if (await page.locator('.handoff .btn').count()) await page.locator('.handoff .btn').click();
  await page.locator('nav.dock button', { hasText: 'Παίκτες' }).click();
  const colorsBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game.players.map((p: { color: string }) => p.color));
  await page.getByRole('button', { name: 'Αλλαγή χρώματος' }).first().click();
  await expect(page.locator('.recolor .swatch.taken')).toHaveCount(1);
  await page.locator('.recolor .swatch:not(.taken):not(.on)').first().click();
  const colorsAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game.players.map((p: { color: string }) => p.color));
  expect(colorsAfter[0]).not.toBe(colorsBefore[0]);
  expect(colorsAfter[1]).toBe(colorsBefore[1]);
  expect(errors).toEqual([]);
});

test('rule presets by game length fill in the rules; changing one shows "your own rules"', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  for (const n of ['Α', 'Β']) {
    await page.getByText('Προσθήκη παίκτη').click();
    await page.locator('.pedit input').first().fill(n);
  }
  await page.locator('nav.tabs button', { hasText: 'Κανόνες' }).click();
  await expect(page.locator('.preset.on')).toContainText('Χωρίς όριο');
  await page.locator('.preset', { hasText: 'Γρήγορη' }).click();
  await expect(page.locator('.preset.on')).toContainText('Γρήγορη');
  await expect(page.getByLabel(/Κρίση αγοράς/)).toBeChecked();
  await page.getByLabel(/Επίδομα ουραγού/).check();
  await expect(page.locator('.preset.on')).toHaveCount(0);
  await expect(page.getByText(/Δικοί σας κανόνες \(αλλάξατε/)).toBeVisible();
  await page.locator('.preset', { hasText: 'Γρήγορη' }).click();
  await page.getByText('Έναρξη παιχνιδιού').click();
  const r = await page.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game.rules);
  expect(r).toMatchObject({ timeLimitMin: 30, startCash: 1000, crisis: { every: 5 } });
  expect(r.underdog).toBeUndefined();
  expect(errors).toEqual([]);
});

test('landing on someone else\'s property: the rent card', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await newLocalGame(page, ['Α', 'Β']);
  // the other player owns everything
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('gtn-save')!);
    const g = s.game;
    const other = g.players[(g.cur + 1) % 2].id;
    for (const k of Object.keys(g.props)) g.props[k].owner = other;
    localStorage.setItem('gtn-save', JSON.stringify(s));
  });
  await page.reload();
  await page.getByText('Συνέχεια παρτίδας').click();
  let seen = false;
  for (let i = 0; i < 60 && !seen; i++) {
    if (await page.locator('.rentbanner').count()) { seen = true; break; }
    await step(page);
  }
  expect(seen).toBe(true);
  await expect(page.locator('.rentbanner .rent-amount')).toContainText('€');
  expect(errors).toEqual([]);
});
