import { device, expect, mapIdle, openMore, test } from './helpers.ts';

test('a point picked on the map tells how far it is and is navigated to', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  // A tap on the map closes what is open: first the groups panel the first launch leaves open.
  await page
    .getByRole('region', { name: 'Grupos' })
    .getByRole('button', { name: 'Cerrar' })
    .click();
  await page.getByRole('button', { name: 'Mostrar mi ubicación' }).click();
  // Wait for the map to centre on this device, whose view the URL keeps, and settle there; then
  // pick a point above it.
  await expect(page.getByRole('button', { name: 'Dejar de mostrar mi ubicación' })).toBeVisible();
  await expect(page).toHaveURL(/#map=[\d.]+\/39\.4699\/-0\.3763$/);
  await mapIdle(page);
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no map');
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 - 150 } });

  const panel = page.getByRole('region', { name: 'Punto del mapa' });
  await expect(panel.getByText(/^\d+ m · (00\d|35\d)° N desde ti$/)).toBeVisible();
  await panel.getByRole('button', { name: 'Guíame' }).click();

  const card = page.getByRole('region', { name: 'Hacia Punto del mapa' });
  await expect(card).toContainText(/\d+ m · (00\d|35\d)° N/);
  await card.getByRole('button', { name: 'Parar' }).click();
  await expect(card).toBeHidden();
});

test('distances are measured point by point, with the area they enclose', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await openMore(page, 'Medir distancias');
  const card = page.getByRole('region', { name: 'Medir distancias' });
  await expect(card).toContainText('Toca el mapa para medir');

  const canvas = page.locator('.maplibregl-canvas');
  for (const position of [
    { x: 100, y: 300 },
    { x: 250, y: 300 },
    { x: 250, y: 450 },
  ]) {
    await canvas.click({ position });
  }
  await expect(card).toContainText(/^\s*[\d,.]+ (m|km) · área encerrada [\d,.]+ (m²|ha|km²)/);
  await card.getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('área encerrada')).toBeHidden();
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByRole('button', { name: 'Más', exact: true })).toBeVisible();
});
