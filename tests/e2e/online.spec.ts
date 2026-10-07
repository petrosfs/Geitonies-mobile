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

test('@online the host loses the internet for a while; a friend who refreshes gets back in', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await (await browser.newContext()).newPage();
  const prefs = (d: string) => JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  for (const [p, d] of [[host, 'h2'], [guest, 'g2']] as const) {
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); }, prefs(d));
    await p.reload();
  }
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Πέτρος');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('Φίλος');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  await hostCtx.setOffline(true);
  await host.evaluate(() => (window as unknown as { __store: { peer: { socket: { _socket?: WebSocket } } } }).__store.peer.socket._socket?.close());
  await host.waitForTimeout(15_000);
  await hostCtx.setOffline(false);

  await guest.reload();
  await guest.getByText('Συνέχεια παρτίδας').click();
  await expect.poll(() => guest.evaluate(() => (window as unknown as { __store: { get: () => { net: string } } }).__store.get().net), { timeout: 60_000 }).toBe('ok');
});

test('@online a phone that missed updates catches up by itself (no frozen screens)', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const prefs = (d: string) => JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  for (const [p, d] of [[host, 'h3'], [guest, 'g3']] as const) {
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); }, prefs(d));
    await p.reload();
  }
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Πέτρος');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('Φίλος');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  type W = { __store: { dropStates: number; get: () => { game: { v: number } } } };
  const v = (p: typeof host) => p.evaluate(() => (window as unknown as W).__store.get().game.v);
  // every update from the host is lost for a while...
  await host.evaluate(() => { (window as unknown as W).__store.dropStates = 1000; });
  await host.evaluate(() => (window as unknown as { __store: { act: (by: string, a: object) => void; get: () => { game: { players: { id: string }[] } } } })
    .__store.act('host', { t: 'tick' }));
  const roller = (await host.locator('.btn.roll').count()) ? host : guest;
  await roller.locator('.btn.roll').click();
  await host.waitForTimeout(1500);
  const hv = await v(host);
  if (roller === host) expect(await v(guest)).toBeLessThan(hv);   // the friend really is behind
  // ...then the network is fine again: the friend catches up on its own
  await host.evaluate(() => { (window as unknown as W).__store.dropStates = 0; });
  await expect.poll(() => v(guest), { timeout: 15_000 }).toBe(hv);
});

test('@online a phone stuck on an old screen catches up with the host', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const prefs = (d: string) => JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  for (const [p, d] of [[host, 'h3'], [guest, 'g3']] as const) {
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); }, prefs(d));
    await p.reload();
  }
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Πέτρος');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('Φίλος');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  type W = { __store: { get: () => { game: { v: number; q: unknown[] } }; set: (p: object) => void } };
  // the friend's screen is stuck on an old, "newer-numbered" copy showing an auction
  await guest.evaluate(() => {
    const st = (window as unknown as W).__store;
    const g = structuredClone(st.get().game) as { v: number; q: unknown[]; players: { id: string }[] };
    g.v += 100;
    g.q = [{ k: 'auction', sq: 39, high: 0, bidder: null, passed: [], sealed: {}, eligible: g.players.map((p) => p.id) }];
    st.set({ game: g });
  });
  await expect(guest.locator('.bidrow')).toBeVisible();
  // pressing a button there: the host says no, and the friend's screen catches up
  await guest.locator('.bidrow .btn', { hasText: '+10' }).first().click();
  await expect(guest.locator('.bidrow')).toHaveCount(0, { timeout: 15_000 });
  const v = async (p: typeof host) => p.evaluate(() => (window as unknown as W).__store.get().game.v);
  await expect.poll(async () => (await v(guest)) === (await v(host)), { timeout: 15_000 }).toBe(true);
});

test('@online a wrong code says clearly that no such game exists', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('gtn-prefs', JSON.stringify({ device: 'w1', lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } })); });
  await page.goto('/?join=ZZZZ9');
  // shown straight away, while it keeps trying in case the host is only away for a moment
  await expect(page.locator('.join-notfound')).toContainText('Δεν βρέθηκε παρτίδα', { timeout: 45_000 });
  await expect(page.locator('.join-progress')).toBeVisible();
});

test('@online joining while the host is away for a while (e.g. sending the code): it keeps trying and gets in', async ({ browser }) => {
  const hostCtx = await browser.newContext();
  const host = await hostCtx.newPage();
  const guest = await (await browser.newContext()).newPage();
  const prefs = (d: string) => JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  for (const [p, d] of [[host, 'h4'], [guest, 'g4']] as const) {
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); }, prefs(d));
    await p.reload();
  }
  await host.getByText('Νέα online παρτίδα').click();
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  // the host goes away (no network) while the friend tries to join
  await hostCtx.setOffline(true);
  await host.evaluate(() => (window as unknown as { __store: { peer: { socket: { _socket?: WebSocket } } } }).__store.peer.socket._socket?.close());
  await guest.getByText('Σύνδεση σε παρτίδα').click();
  await guest.locator('.codein').fill(code);
  await guest.getByRole('button', { name: 'Σύνδεση', exact: true }).click();
  await expect(guest.locator('.join-progress')).toBeVisible();
  await guest.waitForTimeout(40_000);
  await hostCtx.setOffline(false);
  // the friend gets in once the host is back
  await expect(guest.getByText('Προσθήκη παίκτη')).toBeVisible({ timeout: 70_000 });
});

test('@online a long game (state bigger than 16 KB) still reaches the other phones', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage();
  const guest = await (await browser.newContext()).newPage();
  const prefs = (d: string) => JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  for (const [p, d] of [[host, 'h5'], [guest, 'g5']] as const) {
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); }, prefs(d));
    await p.reload();
  }
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Πέτρος');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('Φίλος');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  type W = { __store: { get: () => { game: Record<string, unknown> & { v: number } }; set: (p: object) => void } };
  // make the host's game as big as after a long game (long history of net worth per round)
  const bytes = await host.evaluate(() => {
    const st = (window as unknown as W).__store;
    const g = structuredClone(st.get().game) as { stats: { worth: unknown[] }; players: { id: string }[] };
    const w = Object.fromEntries(g.players.map((p) => [p.id, 1500]));
    g.stats.worth = Array.from({ length: 400 }, (_, i) => ({ round: i + 1, w }));
    st.set({ game: g });
    return new TextEncoder().encode(JSON.stringify(g)).length;
  });
  expect(bytes).toBeGreaterThan(20_000);
  // a move: the guest must get the new state
  const roller = (await host.locator('.btn.roll').count()) ? host : guest;
  await roller.locator('.btn.roll').click();
  const v = (p: typeof host) => p.evaluate(() => (window as unknown as W).__store.get().game.v);
  await expect.poll(async () => (await v(guest)) === (await v(host)) && (await v(host)) > 0, { timeout: 20_000 }).toBe(true);
  const guestWorth = await guest.evaluate(() => ((window as unknown as W).__store.get().game.stats as { worth: unknown[] }).worth.length);
  expect(guestWorth).toBeGreaterThan(300);
});

test('@online joining a game in progress: the host lets one in as a player and one as a spectator', async ({ browser }) => {
  const mk = async (d: string) => {
    const p = await (await browser.newContext()).newPage();
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); },
      JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } }));
    await p.reload();
    return p;
  };
  const host = await mk('h6'), guest = await mk('g6'), late = await mk('l6'), watcher = await mk('w6');
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Πέτρος');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('Φίλος');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  // a third person arrives after the start and asks to play
  await late.goto(`/?join=${code}`);
  await expect(late.getByText('Η παρτίδα έχει ήδη ξεκινήσει')).toBeVisible({ timeout: 30_000 });
  await late.getByText('Προσθήκη παίκτη').click();
  await late.locator('.pedit input').first().fill('Νέα');
  await late.getByRole('button', { name: /Ζήτα να μπεις/ }).click();
  await expect(host.getByText('Νέα θέλει να μπει')).toBeVisible({ timeout: 15_000 });
  // until the host answers, the newcomer gets nothing from the game, even when the host sends an update
  await host.evaluate(() => {
    const st = (window as unknown as { __store: { get: () => { game: { v: number } }; set: (p: object) => void; broadcastState: () => void } }).__store;
    const g = structuredClone(st.get().game);
    g.v += 1;
    st.set({ game: g });
    st.broadcastState();
  });
  await late.waitForTimeout(3000);
  await expect(late.locator('.gamebar')).toHaveCount(0);
  await host.getByRole('button', { name: /Ως παίκτης/ }).click();
  await expect(late.locator('.gamebar')).toBeVisible({ timeout: 15_000 });
  await expect(host.locator('.cashchip')).toHaveCount(3);
  await expect(guest.locator('.cashchip')).toHaveCount(3);

  // a fourth one only watches, and can still chat
  await watcher.goto(`/?join=${code}`);
  await expect(watcher.getByText('Η παρτίδα έχει ήδη ξεκινήσει')).toBeVisible({ timeout: 30_000 });
  await watcher.getByText('Προσθήκη παίκτη').click();
  await watcher.locator('.pedit input').first().fill('Θεατής');
  await watcher.getByRole('button', { name: /Ζήτα να μπεις/ }).click();
  await host.getByRole('button', { name: /Ως θεατής/ }).click({ timeout: 15_000 });
  await expect(watcher.locator('.gamebar')).toBeVisible({ timeout: 15_000 });
  await expect(watcher.locator('.cashchip')).toHaveCount(3);
  await watcher.getByRole('button', { name: /Τσατ/ }).click();
  await watcher.locator('.modal form input').fill('Καλή επιτυχία!');
  await watcher.getByRole('button', { name: 'Αποστολή' }).click();
  await expect(host.locator('.toast')).toContainText('Καλή επιτυχία!');
});

test('@online long game + open auction with many bids, then end of turn: both phones stay identical', async ({ browser }) => {
  const mk = async (d: string) => {
    const p = await (await browser.newContext()).newPage();
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); },
      JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } }));
    await p.reload();
    return p;
  };
  const host = await mk('h7'), guest = await mk('g7');
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Petros');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('ΨΕΦΗ');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  type St = { get: () => { game: Record<string, unknown> & { v: number; log: { k: string }[] } }; set: (p: object) => void; broadcastState: () => void };
  // a long game: big state, and an open auction for a station that everyone can bid on
  await host.evaluate(() => {
    const st = (window as unknown as { __store: St }).__store;
    const g = structuredClone(st.get().game) as unknown as { stats: { worth: unknown[] }; players: { id: string }[]; q: unknown[]; rolled: boolean; v: number };
    const w = Object.fromEntries(g.players.map((p) => [p.id, 1500]));
    g.stats.worth = Array.from({ length: 400 }, (_, i) => ({ round: i + 1, w }));
    g.q = [{ k: 'auction', sq: 15, high: 0, bidder: null, passed: [], sealed: {}, eligible: g.players.map((p) => p.id) }];
    g.rolled = true;
    g.v += 1;
    st.set({ game: g });
    st.broadcastState();
  });
  const snap = (p: typeof host) => p.evaluate(() => {
    const g = (window as unknown as { __store: St }).__store.get().game as unknown as { v: number; log: { k: string; a?: { n?: number } }[]; q: { k: string; high?: number }[] };
    return { v: g.v, bids: g.log.filter((e) => e.k === 'bid').map((e) => e.a?.n), head: g.q[0]?.k ?? '-', high: g.q[0]?.high ?? null };
  });
  await expect.poll(async () => JSON.stringify(await snap(guest)), { timeout: 15_000 }).toBe(JSON.stringify(await snap(host)));
  // ten bids, taking turns
  for (let i = 0; i < 10; i++) {
    const who = i % 2 === 0 ? guest : host;
    await who.locator('.bidrow .btn', { hasText: '+10' }).first().click();
    await expect.poll(async () => JSON.stringify(await snap(guest)), { timeout: 15_000 }).toBe(JSON.stringify(await snap(host)));
  }
  expect((await snap(host)).bids.length).toBe(10);
  // the guest leads after the last bid? no: host made bid 10. The guest passes, the auction ends, then end of turn
  await guest.locator('.bidrow .btn', { hasText: 'Πάσο' }).first().click();
  await expect.poll(async () => (await snap(host)).head, { timeout: 15_000 }).not.toBe('auction');
  const keep = host.getByText('Κράτα το όνομα');
  if (await keep.count()) await keep.click();
  const roller = (await host.getByRole('button', { name: 'Τέλος σειράς' }).count()) ? host : guest;
  await roller.getByRole('button', { name: 'Τέλος σειράς' }).click();
  await expect.poll(async () => JSON.stringify(await snap(guest)), { timeout: 15_000 }).toBe(JSON.stringify(await snap(host)));
  await expect(guest.locator('.btn.roll, .bidrow, .panel-act')).not.toHaveCount(0);
});

test('@online a card drawn by one player: everyone sees it top left and in the history; only the drawer gets the big card', async ({ browser }) => {
  const mk = async (d: string) => {
    const p = await (await browser.newContext()).newPage();
    await p.goto('/');
    await p.evaluate((v) => { localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-prefs', v); },
      JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } }));
    await p.reload();
    return p;
  };
  const host = await mk('h8'), guest = await mk('g8');
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Petros');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await guest.goto(`/?join=${code}`);
  await guest.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await guest.locator('.pedit input').first().fill('Filos');
  await guest.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(guest.locator('.gamebar')).toBeVisible();

  type St = { get: () => { game: { cur: number; players: { id: string; device: string }[]; cards: { id: number; fx: { t: string } }[]; q: unknown[]; v: number; rolled: boolean } }; set: (p: object) => void; broadcastState: () => void };
  // whoever's turn it is draws the "go to jail" card
  const drawer = await host.evaluate(() => {
    const st = (window as unknown as { __store: St }).__store;
    const g = structuredClone(st.get().game);
    const card = g.cards.find((c) => c.fx.t === 'jail')!;
    const me = g.players[g.cur];
    g.q = [{ k: 'card', card: card.id, who: me.id }];
    g.rolled = true;
    g.v += 1;
    st.set({ game: g });
    st.broadcastState();
    return me.device;
  });
  const [mine, other] = drawer === 'h8' ? [host, guest] : [guest, host];
  // the other phone: small card top left, no big card
  await expect(other.locator('.turncard')).toContainText('φυλακή', { timeout: 15_000 });
  await expect(other.locator('.bigcard')).toHaveCount(0);
  // the drawer: the big card
  await expect(mine.locator('.bigcard')).toBeVisible();
  await mine.locator('.modal .btn.primary').click();
  // afterwards both still see it, and the history says what it was
  await expect(other.locator('.turncard')).toContainText('φυλακή', { timeout: 15_000 });
  await other.getByRole('button', { name: /Ιστορικό/ }).click();
  await expect(other.locator('.modal')).toContainText(/τράβηξε (Ευκαιρία|Κοινοτικό Ταμείο): «.*φυλακή/);
});

test('@online the host leaves for good: the next player becomes host by itself and the others play on', async ({ browser }) => {
  const mk = async (d: string) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/');
    await p.evaluate((v) => {
      localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-takeover-ms', '6000');
      localStorage.setItem('gtn-prefs', v);
    }, JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } }));
    await p.reload();
    return { p, ctx };
  };
  const { p: host, ctx: hostCtx } = await mk('h9');
  const { p: a } = await mk('a9');
  const { p: b } = await mk('b9');
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Host');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  for (const [p, n] of [[a, 'Alpha'], [b, 'Beta']] as const) {
    await p.goto(`/?join=${code}`);
    await p.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
    await p.locator('.pedit input').first().fill(n);
    await p.getByRole('button', { name: 'Αποθήκευση' }).click();
  }
  await expect(host.locator('.pcard')).toHaveCount(3);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(a.locator('.gamebar')).toBeVisible();
  await expect(b.locator('.gamebar')).toBeVisible();

  type St = { get: () => { mode: string; net: string; game: { v: number; cur: number; players: { device: string }[] } }; set: (p: object) => void; broadcastState: () => void };
  // it's Beta's turn when the host goes away for good
  await host.evaluate(() => {
    const st = (window as unknown as { __store: St }).__store;
    const g = structuredClone(st.get().game);
    g.cur = g.players.findIndex((p) => p.device === 'b9');
    g.v += 1;
    st.set({ game: g });
    st.broadcastState();
  });
  await expect(b.locator('.btn.roll')).toBeVisible({ timeout: 15_000 });
  await hostCtx.close();

  const info = (p: typeof a) => p.evaluate(() => { const s = (window as unknown as { __store: St }).__store.get(); return { mode: s.mode, net: s.net, v: s.game.v }; });
  // Alpha (next in the player order) takes over, Beta follows
  await expect.poll(async () => (await info(a)).mode, { timeout: 60_000 }).toBe('host');
  await expect.poll(async () => (await info(b)).net, { timeout: 60_000 }).toBe('ok');
  // the game goes on: Beta rolls and Alpha sees it
  const before = (await info(a)).v;
  await b.locator('.btn.roll').click();
  await expect.poll(async () => (await info(a)).v, { timeout: 15_000 }).toBeGreaterThan(before);
  await expect.poll(async () => (await info(b)).v === (await info(a)).v, { timeout: 15_000 }).toBe(true);
});

test('@online the old host comes back after someone took over: it joins the new host (never two games)', async ({ browser }) => {
  const mk = async (d: string) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto('/');
    await p.evaluate((v) => {
      localStorage.clear(); localStorage.setItem('gtn-debug', '1'); localStorage.setItem('gtn-takeover-ms', '6000');
      localStorage.setItem('gtn-prefs', v);
    }, JSON.stringify({ device: d, lang: 'el', fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } }));
    await p.reload();
    return { p, ctx };
  };
  const { p: host } = await mk('h10');
  const { p: a } = await mk('a10');
  await host.getByText('Νέα online παρτίδα').click();
  await host.getByText('Προσθήκη παίκτη').click();
  await host.locator('.pedit input').first().fill('Host');
  await expect(host.locator('.share .muted').last()).toContainText('Οι άλλοι', { timeout: 30_000 });
  const code = (await host.locator('.code').innerText()).trim();
  await a.goto(`/?join=${code}`);
  await a.getByText('Προσθήκη παίκτη').click({ timeout: 30_000 });
  await a.locator('.pedit input').first().fill('Alpha');
  await a.getByRole('button', { name: 'Αποθήκευση' }).click();
  await expect(host.locator('.pcard')).toHaveCount(2);
  await host.getByText('Έναρξη παιχνιδιού').click();
  await expect(a.locator('.gamebar')).toBeVisible();

  type St = { get: () => { mode: string; net: string; gen: number; game: { v: number } }; clearPeer: () => void; stopTimers: () => void; peer: { destroy: () => void } | null };
  const info = (p: typeof a) => p.evaluate(() => { const s = (window as unknown as { __store: St }).__store.get(); return { mode: s.mode, net: s.net, gen: s.gen, v: s.game?.v }; });
  // the host's phone goes to sleep (connections drop, nothing runs) long enough for Alpha to take over
  await host.evaluate(() => { const st = (window as unknown as { __store: St }).__store; st.stopTimers(); st.clearPeer(); st.peer?.destroy(); });
  await expect.poll(async () => (await info(a)).mode, { timeout: 60_000 }).toBe('host');
  // it wakes up: the app comes back to the screen
  await host.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  // back online: the old host finds the new one and joins it as a player
  await expect.poll(async () => { const i = await info(host); return `${i.mode}/${i.net}/${i.gen}`; }, { timeout: 60_000 }).toBe(`client/ok/${(await info(a)).gen}`);
});
