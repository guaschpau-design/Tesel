import { device, expect, stored, test } from './helpers.ts';

test('a hidden map layer stays hidden after the app restarts', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  const openLayers = async () => {
    await page.getByRole('button', { name: 'Capas del mapa' }).click();
  };
  await openLayers();
  const trails = page.getByRole('switch', { name: 'Por dónde han pasado' });
  await expect(trails).toBeChecked();
  await trails.click();
  await expect(trails).not.toBeChecked();
  // The choice is stored a moment after the tap; restart only once it is.
  await expect.poll(() => stored(page, 'settings', 'hiddenLayers')).toEqual(['trails']);

  await page.reload();
  await openLayers();
  await expect(page.getByRole('switch', { name: 'Por dónde han pasado' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Miembros' })).toBeChecked();
});

test('the layers panel links to the licences of the code the app ships', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const link = page.getByRole('link', { name: 'Licencias de terceros' });
  const href = await link.getAttribute('href');
  expect(href).not.toBeNull();
  const notices = await page.request.get(href ?? '');
  expect(notices.ok()).toBe(true);
  const text = await notices.text();
  expect(text).toContain('maplibre-gl');
  expect(text).toContain('Licence: BSD-3-Clause');
});
