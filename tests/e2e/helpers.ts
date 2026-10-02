import { expect, type Page } from '@playwright/test';

/** fail the test on any page error */
export function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('dialog', (d) => { errors.push('native dialog: ' + d.message()); void d.dismiss(); });
  return errors;
}

export async function freshStart(page: Page, prefs?: object) {
  await page.goto('/');
  await page.evaluate((p) => {
    localStorage.clear();
    if (p) localStorage.setItem('gtn-prefs', JSON.stringify({ device: 'e2e-device', lang: 'el', ...p }));
  }, prefs ?? null);
  await page.reload();
}

export async function newLocalGame(page: Page, names: string[]) {
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  for (const n of names) {
    await page.getByText('Προσθήκη παίκτη').click();
    await page.locator('.pedit input').first().fill(n);
  }
  await page.getByText('Έναρξη παιχνιδιού').click();
  await expect(page.locator('.gamebar')).toBeVisible();
}

/** click, but don't hang if the button disappears (e.g. an animation starts) */
const tap = (l: ReturnType<Page['locator']>) => l.click({ timeout: 4000 }).then(() => true, () => false);

/** do whatever the game asks for, once; returns what was done */
export async function step(page: Page): Promise<string> {
  const has = async (sel: ReturnType<Page['locator']>) => (await sel.count()) > 0;
  if (await has(page.getByText('Τα ζάρια κυλάνε'))) { await page.waitForTimeout(200); return 'wait'; }
  if (await has(page.locator('.handoff .btn'))) return (await tap(page.locator('.handoff .btn'))) ? 'handoff' : 'retry';
  if (await has(page.locator('.bigcard'))) return (await tap(page.locator('.modal .btn.primary'))) ? 'card' : 'retry';
  if (await has(page.getByText('Κράτα το όνομα'))) return (await tap(page.getByText('Κράτα το όνομα'))) ? 'name' : 'retry';
  const buy = page.locator('.panel-act .btn.primary', { hasText: 'Αγορά' });
  if (await has(buy)) {
    const ok = (await buy.isEnabled().catch(() => false)) ? await tap(buy) : await tap(page.getByText('Όχι, σε δημοπρασία'));
    return ok ? 'buy' : 'retry';
  }
  const pass = page.locator('.bidrow .btn', { hasText: 'Πάσο' });
  if (await has(pass)) return (await tap(pass.first())) ? 'pass' : 'retry';
  const pay = page.locator('.panel-act .btn.primary', { hasText: 'Πλήρωσε' });
  if (await has(pay)) {
    if (await pay.isEnabled().catch(() => false)) return (await tap(pay)) ? 'pay' : 'retry';
    if (await tap(page.getByRole('button', { name: 'Χρεοκοπία' }))) await tap(page.locator('.modal .btn.danger').last());
    return 'pay';
  }
  if (await has(page.locator('.btn.roll'))) return (await tap(page.locator('.btn.roll'))) ? 'roll' : 'retry';
  const end = page.getByRole('button', { name: 'Τέλος σειράς' });
  if (await has(end)) return (await tap(end)) ? 'end' : 'retry';
  await page.waitForTimeout(150);
  return 'idle';
}

/** play until `rolls` dice rolls have happened (time-limited: slow software 3D in CI) */
export async function playRolls(page: Page, rolls: number, maxMs = 6 * 60_000) {
  let done = 0;
  const deadline = Date.now() + maxMs;
  while (done < rolls && Date.now() < deadline) {
    if ((await step(page)) === 'roll') done++;
  }
  expect(done).toBe(rolls);
}
