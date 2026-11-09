// The ground in 3D (ADR-0102): one button raises it and leans the map back, and lays both flat
// again; pocket mode lays them flat by itself.

import { device, expect, test } from './helpers.ts';

test('the ground is raised in 3D and laid flat again, by hand or in pocket mode', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const raise = page.getByRole('button', { name: 'Relieve en 3D' });
  await expect(raise).toHaveAttribute('aria-pressed', 'false');
  await raise.click();
  await expect(raise).toHaveAttribute('aria-pressed', 'true');
  await raise.click();
  await expect(raise).toHaveAttribute('aria-pressed', 'false');

  await raise.click();
  await page.clock.install();
  const rest = page.getByRole('dialog', { name: 'Modo bolsillo' });
  await expect(async () => {
    await page.clock.fastForward('01:10');
    await expect(rest).toBeVisible({ timeout: 1000 });
  }).toPass();
  await expect(raise).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});
