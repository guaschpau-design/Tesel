// Pocket mode (ADR-0097, ADR-0127): asked for from the map's controls, or by itself after a minute
// untouched, the screen goes almost black and the app keeps working; a touch does nothing, sliding
// the handle out brings the app back; the switch in Settings, which says what it does on asking,
// turns off the automatic one.

import type { Page } from '@playwright/test';

import { device, expect, openMore, test } from './helpers.ts';

/** Slides pocket mode's handle to the end of its track. */
async function slideOut(page: Page): Promise<void> {
  const pocket = page.getByRole('dialog', { name: 'Modo bolsillo' });
  const handle = pocket.getByRole('button', { name: 'Desliza para salir' });
  const box = await handle.boundingBox();
  if (box === null) throw new Error('No handle');
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  for (let step = 1; step <= 10; step++)
    await page.mouse.move(box.x + box.width / 2 + step * 40, y);
  await page.mouse.up();
}

test('pocket mode comes after a minute untouched, ignores touches and leaves with a slide', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await page.clock.install();
  // Settings left open over the map, which a tap on the map would close.
  await openMore(page, 'Ajustes');
  const settings = page.getByRole('region', { name: 'Ajustes' });
  const pocket = page.getByRole('dialog', { name: 'Modo bolsillo' });
  await expect(async () => {
    await page.clock.fastForward('01:10');
    await expect(pocket).toBeVisible({ timeout: 1000 });
  }).toPass();
  // Touches, on it or on its handle, do nothing: a hand in a pocket.
  await page.touchscreen.tap(200, 300);
  await pocket.getByRole('button', { name: 'Desliza para salir' }).tap();
  await page.clock.runFor(1000);
  await expect(pocket).toBeVisible();
  await slideOut(page);
  await page.clock.runFor(1000);
  await expect(pocket).toBeHidden();
  await expect(settings).toBeVisible();

  // Turned off, it does not come by itself any more.
  const automatic = page.getByRole('switch', { name: 'Modo bolsillo automático' });
  // What it does is hidden until its (i) is tapped, which leaves the switch as it was.
  const what = page.getByText('Al minuto sin tocar la pantalla');
  await expect(what).toBeHidden();
  await page.getByRole('button', { name: 'Qué es «Modo bolsillo automático»' }).click();
  await expect(what).toBeVisible();
  await expect(automatic).toHaveAttribute('aria-checked', 'true');
  // Tapped on its name: the middle of the row is its (i).
  await automatic.getByText('Modo bolsillo automático').click();
  await expect(automatic).toHaveAttribute('aria-checked', 'false');
  await page.clock.fastForward('05:00');
  await page.clock.runFor(6000);
  await expect(pocket).toBeHidden();
});

test('pocket mode comes at once from the map, and leaves from the keyboard too', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: 'Modo bolsillo' }).click();
  const pocket = page.getByRole('dialog', { name: 'Modo bolsillo' });
  await expect(pocket).toBeVisible();
  await pocket.getByRole('button', { name: 'Desliza para salir' }).press('Enter');
  await expect(pocket).toBeHidden();
});
