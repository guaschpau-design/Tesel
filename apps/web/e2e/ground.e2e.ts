// The ground in 3D (ADR-0102): one button raises it and leans the map back, and lays both flat
// again; pocket mode lays them flat by itself. Raised close up, with the public services drawn,
// the map keeps drawing.

import { device, expect, test } from './helpers.ts';
import { serveTopographicData } from './terrain-ramp.ts';

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

test('raised close up on the tactical map, the map keeps drawing', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await serveTopographicData(page);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page
    .getByRole('region', { name: 'Grupos' })
    .getByRole('button', { name: 'Cerrar' })
    .click();
  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const layers = page.getByRole('region', { name: 'Capas del mapa' });
  await layers.getByRole('radio', { name: 'Táctico', exact: true }).click();
  await layers.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Mostrar mi ubicación' }).click();
  await expect(page).toHaveURL(/#map=[\d.]+\/39\.4699\/-0\.3763$/);
  // The services drawn close up first.
  await page.waitForTimeout(5000);

  // The new style comes with the ground; the public services are put back on it once it is drawn,
  // not while it is being drawn, which failed every frame after.
  await page.getByRole('button', { name: 'Relieve en 3D' }).click();
  await page.waitForTimeout(10_000);
  expect(errors).toEqual([]);
});
