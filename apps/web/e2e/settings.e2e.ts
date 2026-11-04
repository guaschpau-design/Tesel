// Choices of the settings panel, opened from the "More" menu, that the app keeps: full screen, on
// by default and entered at the first tap of each visit, the language and dark mode.

import type { Page } from '@playwright/test';

import { device, expect, openMore, test } from './helpers.ts';

const isFullscreen = (page: Page) => page.evaluate(() => document.fullscreenElement !== null);

test('the app goes full screen at the first tap, until switched off', async ({ browser }) => {
  // The first tap, on the welcome screen, already took it there.
  const page = await device(browser, 'Ana');
  await expect.poll(() => isFullscreen(page)).toBe(true);

  // A reload leaves full screen; the first tap of the visit goes back to it.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Más', exact: true })).toBeVisible();
  expect(await isFullscreen(page)).toBe(false);
  await openMore(page, 'Ajustes');
  await expect.poll(() => isFullscreen(page)).toBe(true);

  // Switched off in the settings, it stays off on the next visit.
  const settings = page.getByRole('region', { name: 'Ajustes' });
  const choice = settings.getByRole('switch', { name: 'Pantalla completa' });
  await expect(choice).toHaveAttribute('aria-checked', 'true');
  await choice.click();
  await expect.poll(() => isFullscreen(page)).toBe(false);
  await expect(choice).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await openMore(page, 'Ajustes');
  await expect(choice).toHaveAttribute('aria-checked', 'false');
  expect(await isFullscreen(page)).toBe(false);
});

test('the language is chosen in the settings and remembered', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  // The map itself is named in the app's language, though MapLibre's own word is English.
  await expect(page.getByRole('region', { name: 'Mapa', exact: true })).toBeVisible();
  await openMore(page, 'Ajustes');
  await page
    .getByRole('region', { name: 'Ajustes' })
    .getByRole('button', { name: /Idioma/ })
    .click();
  await expect(page.getByRole('region', { name: 'Settings' })).toContainText('English');
  await expect(page.getByRole('region', { name: 'Map', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'More' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Map', exact: true })).toBeVisible();
});

test('dark mode is chosen in the settings, and the street map turns tactical', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  const theme = () => page.evaluate(() => document.documentElement.dataset['theme']);
  // The phone of these tests is light, and so is the app until dark is chosen.
  expect(await theme()).toBe('light');
  await openMore(page, 'Ajustes');
  const settings = page.getByRole('region', { name: 'Ajustes' });
  const dark = settings.getByRole('switch', { name: 'Modo oscuro' });
  await expect(dark).toHaveAttribute('aria-checked', 'false');
  // Tapped on its name: the middle of the row is its (i).
  await dark.getByText('Modo oscuro').click();
  await expect(dark).toHaveAttribute('aria-checked', 'true');
  await expect.poll(theme).toBe('dark');
  await settings.getByRole('button', { name: 'Cerrar' }).click();

  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const base = page.getByRole('radiogroup', { name: 'Mapa base' });
  await expect(base.getByRole('radio', { name: 'Táctico' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Remembered on the next visit.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Más', exact: true })).toBeVisible();
  await expect.poll(theme).toBe('dark');
});
