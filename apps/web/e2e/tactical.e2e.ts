// The tactical map comes read as a military map is (ADR-0141, ADR-0145): the MGRS grid, MGRS
// coordinates, bearings in mils from magnetic north, and in its margin the zone, the square and
// the declination.

import { device, expect, mapIdle, test } from './helpers.ts';
import { serveTopographicData } from './terrain-ramp.ts';

test('the tactical map reads as a military map: MGRS, mils from magnetic north, its margin', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  // The tactical map always draws the relief and IGN's map: stood in for, as for the topographic.
  await serveTopographicData(page);
  await page
    .getByRole('region', { name: 'Grupos' })
    .getByRole('button', { name: 'Cerrar' })
    .click();
  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const layers = page.getByRole('region', { name: 'Capas del mapa' });
  await layers.getByRole('radio', { name: 'Táctico', exact: true }).click();
  await layers.getByRole('button', { name: 'Cerrar' }).click();

  // Centred on this device in Valencia: zone 30S, square YJ, where a compass points a little east
  // of north.
  await page.getByRole('button', { name: 'Mostrar mi ubicación' }).click();
  await expect(page.getByRole('button', { name: 'Dejar de mostrar mi ubicación' })).toBeVisible();
  await mapIdle(page);
  const margin = page.locator('.maplibregl-ctrl-top-right');
  await expect(margin).toContainText('30S YJ');
  await expect(margin).toContainText(/Decl\. \d,\d° E/);

  // A point above this device: its bearing in mils, magnetic, and its coordinates in MGRS.
  const canvas = page.locator('.maplibregl-canvas');
  const box = await canvas.boundingBox();
  if (box === null) throw new Error('no map');
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 - 150 } });
  const panel = page.getByRole('region', { name: 'Punto del mapa' });
  await expect(panel.getByText(/^\d+ m · (63\d\d|00\d\d)‰M N desde ti$/)).toBeVisible();
  await expect(panel).toContainText(/30S YJ \d{5} \d{5}/);
});
