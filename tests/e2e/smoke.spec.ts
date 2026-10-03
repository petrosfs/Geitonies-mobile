import { expect, test } from '@playwright/test';
import { freshStart, newLocalGame, playRolls, watchErrors } from './helpers';

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
