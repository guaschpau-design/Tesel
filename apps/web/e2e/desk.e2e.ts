// A computer (ADR-0131): used with a mouse, it has no pocket mode, neither its padlock nor by
// itself after a minute untouched, and the app does not go full screen at the first click, though
// «Pantalla completa» is still in Settings. Phones and tablets keep both (energy, settings).

import { devices } from '@playwright/test';

import { device, expect, openMore, test } from './helpers.ts';

const COMPUTER = { ...devices['Desktop Chrome'], permissions: ['geolocation'] };

test('a computer has no pocket mode and does not go full screen by itself', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/', COMPUTER);
  await page.clock.install();
  await expect(page.getByRole('region', { name: 'Mapa', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modo bolsillo' })).toHaveCount(0);

  // Clicks, and then a few minutes untouched: the app stays as it was.
  await openMore(page, 'Ajustes');
  const settings = page.getByRole('region', { name: 'Ajustes' });
  await expect(settings).toBeVisible();
  await page.clock.fastForward('03:00');
  await page.clock.runFor(6000);
  await expect(page.getByRole('dialog', { name: 'Modo bolsillo' })).toBeHidden();
  expect(await page.evaluate(() => document.fullscreenElement !== null)).toBe(false);

  await expect(settings.getByRole('switch', { name: 'Modo bolsillo automático' })).toHaveCount(0);
  const fullscreen = settings.getByRole('switch', { name: 'Pantalla completa' });
  await expect(fullscreen).toHaveAttribute('aria-checked', 'false');
  await fullscreen.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
});
