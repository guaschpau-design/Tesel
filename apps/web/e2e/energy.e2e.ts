// Saving energy (ADR-0097): untouched for a minute, the screen goes black and the app keeps
// working; a touch brings it back; the switch in Settings, which says what it does on asking,
// turns it off.

import { device, expect, openMore, test } from './helpers.ts';

test('the screen rests after a minute untouched, and comes back at a touch', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await page.clock.install();
  // Settings left open over the map, which a tap on the map would close.
  await openMore(page, 'Ajustes');
  const settings = page.getByRole('region', { name: 'Ajustes' });
  const rest = page.getByRole('button', { name: 'Toca para volver' });
  await expect(async () => {
    await page.clock.fastForward('01:10');
    await expect(rest).toBeVisible({ timeout: 1000 });
  }).toPass();
  // A finger on the map: the screen goes as it lifts, and the map under it does not take the tap.
  const map = page.locator('.maplibregl-canvas');
  const box = await map.boundingBox();
  if (box === null) throw new Error('No map');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + 120);
  await expect(rest).toBeHidden();
  await page.clock.runFor(1000);
  await expect(settings).toBeVisible();

  // Turned off, it does not rest any more.
  const saving = page.getByRole('switch', { name: 'Ahorro de energía' });
  // What it does is hidden until its (i) is tapped, which leaves the switch as it was.
  const what = page.getByText('Tras 1 minuto sin tocarla');
  await expect(what).toBeHidden();
  await page.getByRole('button', { name: 'Qué es «Ahorro de energía»' }).click();
  await expect(what).toBeVisible();
  await expect(saving).toHaveAttribute('aria-checked', 'true');
  // Tapped on its name: the middle of the row is its (i).
  await saving.getByText('Ahorro de energía').click();
  await expect(saving).toHaveAttribute('aria-checked', 'false');
  await page.clock.fastForward('05:00');
  await page.clock.runFor(6000);
  await expect(rest).toBeHidden();
});
