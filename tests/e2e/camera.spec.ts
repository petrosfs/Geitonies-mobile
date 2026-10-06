import { expect, test } from '@playwright/test';
import { freshStart, watchErrors } from './helpers';

// a fake camera (moving test picture) with permission already granted
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['camera'],
});

test('player photo: take it with the camera inside the app', async ({ page }) => {
  const errors = watchErrors(page);
  await freshStart(page, { fx: { gfx: '2d', sound: false, vibrate: false, shake: false, cinema: false } });
  await page.getByText('Νέα παρτίδα σε αυτό το κινητό').click();
  await page.getByText('Προσθήκη παίκτη').click();
  await page.getByRole('button', { name: /Κάμερα/ }).click();
  await expect(page.locator('.camera video')).toBeVisible();
  await expect(page.getByRole('button', { name: /Τράβηξε/ })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: /Τράβηξε/ }).click();
  await expect(page.locator('.camera')).toHaveCount(0);
  await expect(page.locator('.pcard .avatar img').first()).toHaveAttribute('src', /^data:image\/jpeg/);
  await expect(page.getByRole('button', { name: 'Χωρίς φωτογραφία' })).toBeVisible();
  expect(errors).toEqual([]);
});
