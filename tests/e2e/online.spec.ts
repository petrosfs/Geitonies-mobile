import { expect, test } from '@playwright/test';
import { watchErrors } from './helpers';

test('@online two phones: join, chat, play in sync', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const errors = [...watchErrors(host), ...watchErrors(guest)];
  const prefs = (d: string) => JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  for (const [p, d] of [[host, 'h'], [guest, 'g']] as const) {
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-prefs', v); }, prefs(d));
    await p.reload();
  }
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Οικοδεσπότης');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();

  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('Επισκέπτης');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  // chat both ways
  await guest.getByRole('button', { name: /Τσατ/ }).click();
  await guest.locator('.modal form input').fill('Γεια σας!');
  await guest.getByRole('button', { name: 'Αποστολή' }).click();
  await expect(host.locator('.toast')).toContainText('Επισκέπτης: Γεια σας!');
  await host.getByRole('button', { name: /Τσατ/ }).click();
  await expect(host.locator('.chatmsg')).toContainText('Γεια σας!');
  await host.getByRole('button', { name: 'Καλή τύχη!' }).click();
  await expect(guest.locator('.chatmsg').last()).toContainText('Καλή τύχη!');
  await guest.getByRole('button', { name: 'Κλείσιμο' }).click();
  await host.getByRole('button', { name: 'Κλείσιμο' }).click();

  // whoever's turn it is rolls; both phones end up with the same state
  const roller = (await host.locator('.btn.roll').count()) ? host : guest;
  await roller.locator('.btn.roll').click();
  await expect.poll(async () => {
    const v = async (p: typeof host) => p.evaluate(() => JSON.parse(localStorage.getItem('gtn-save')!).game.v);
    return (await v(host)) === (await v(guest)) && (await v(host)) > 0;
  }, { timeout: 20_000 }).toBe(true);
  expect(errors).toEqual([]);
});
