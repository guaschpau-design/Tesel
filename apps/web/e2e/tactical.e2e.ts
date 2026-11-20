// The tactical map comes read as a military map is (ADR-0141, ADR-0145): the MGRS grid, MGRS
// coordinates, bearings in mils from magnetic north, the radar (ADR-0150) and the slopes
// (ADR-0155), and in its margin the zone, the square, the declination and the light of the day
// (ADR-0157). What a point sees (ADR-0152) and whether a radio reaches it (ADR-0159), and the map
// decluttered (ADR-0151).

import { device, expect, test } from './helpers.ts';
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
  // It turns on what it is chosen for, and says so under the maps (ADR-0155).
  for (const name of ['Radar', 'Pendientes']) {
    await expect(layers.getByRole('switch', { name })).toHaveAttribute('aria-checked', 'true');
  }
  await expect(layers).toContainText('cubierta, observación y movilidad');
  await layers.getByRole('button', { name: 'Cerrar' }).click();

  // Centred on this device in Valencia: zone 30S, square YJ, where a compass points a little east
  // of north.
  await page.getByRole('button', { name: 'Mostrar mi ubicación' }).click();
  await expect(page.getByRole('button', { name: 'Dejar de mostrar mi ubicación' })).toBeVisible();
  // Not waited for at rest: the relief, always drawn here, keeps a software-drawn map busy long.
  await expect(page).toHaveURL(/#map=[\d.]+\/39\.4699\/-0\.3763$/);
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

  // What is seen from there, worked out from the elevations, until hidden again.
  await panel.getByRole('button', { name: 'Qué se ve desde aquí' }).click();
  await expect(panel).toContainText('En verde, lo que se ve desde aquí hasta 2 km');
  await panel.getByRole('button', { name: 'Quitar' }).click();
  await expect(panel.getByRole('button', { name: 'Qué se ve desde aquí' })).toBeVisible();

  // Whether a radio reaches it from here, over the ground (ADR-0159).
  await panel.getByRole('button', { name: 'Enlace de radio desde ti' }).click();
  const link = panel.getByRole('region', { name: 'Enlace de radio' });
  await expect(link).toContainText(/visión directa|roza la señal|corta la señal/);
  await link.getByText('Mástil 10 m').click();
  await expect(link.getByRole('radio', { name: 'Mástil 10 m' })).toBeChecked();
  await link.getByRole('button', { name: 'Quitar' }).click();
  await panel.getByRole('button', { name: 'Cerrar' }).click();

  // The light of the day, from the margin (ADR-0157).
  await margin.getByRole('button', { name: /^Luz de hoy: el sol (se pone|sale) a las/ }).click();
  const light = page.getByRole('region', { name: 'Luz de hoy' });
  await expect(light).toContainText('Alba');
  await expect(light).toContainText(/\d+ % · (creciente|menguante)/);
  await light.getByRole('button', { name: 'Cerrar' }).click();

  // Back on the urban map, it shows what it is chosen for, and bearings in degrees (ADR-0160).
  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  await layers.getByRole('radio', { name: 'Urbano', exact: true }).click();
  const on = { Servicios: true, Radar: true, 'Zonas inundables': true, Relieve: false };
  for (const [name, checked] of Object.entries({ ...on, 'Cuadrícula MGRS': false })) {
    await expect(layers.getByRole('switch', { name })).toHaveAttribute(
      'aria-checked',
      String(checked),
    );
  }
  await layers.getByRole('button', { name: 'Cerrar' }).click();
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 - 150 } });
  await expect(panel.getByText(/^\d+ m · \d{3}° [NSEO]{1,2} desde ti$/)).toBeVisible();
});

test('the map is decluttered and shown in full again', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await page
    .getByRole('region', { name: 'Grupos' })
    .getByRole('button', { name: 'Cerrar' })
    .click();
  const declutter = page.getByRole('button', { name: 'Despejar el mapa' });
  await declutter.click();
  await expect(declutter).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const layers = page.getByRole('region', { name: 'Capas del mapa' });
  await expect(layers).toContainText('Mapa despejado: solo el equipo, las amenazas y los SOS.');
  await layers.getByRole('button', { name: 'Mostrar todo' }).click();
  await expect(declutter).toHaveAttribute('aria-pressed', 'false');
  await expect(layers).not.toContainText('Mapa despejado');
});
