// Saving energy (ADR-0097): untouched for a minute, the screen goes black and the app keeps
// working; a touch brings it back; the switch in Settings turns it off.

import { device, expect, openMore, test } from './helpers.ts';

test('the screen rests after a minute untouched, and comes back at a touch', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await page.clock.install();
  const rest = page.getByRole('button', { name: 'Toca para volver' });
  await expect(async () => {
    await page.clock.fastForward('01:10');
    await expect(rest).toBeVisible({ timeout: 1000 });
  }).toPass();
  // A touch anywhere: the screen goes as the finger lands, before any click.
  await page.mouse.click(200, 300);
  await expect(rest).toBeHidden();

  // Turned off, it does not rest any more.
  await openMore(page, 'Ajustes');
  const saving = page.getByRole('switch', { name: /^Ahorro de energía/ });
  await saving.click();
  await expect(saving).toHaveAttribute('aria-checked', 'false');
  await page.clock.fastForward('05:00');
  await page.clock.runFor(6000);
  await expect(rest).toBeHidden();
});
