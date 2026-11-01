// Official weather warnings (protocol §8.2): the server's answer is stood in for by an orange
// warning over Valencia, which shows where this device is and at any point picked in it, and goes
// away with its layer.

import type { Page } from '@playwright/test';

import { device, expect, test } from './helpers.ts';

const now = Math.floor(Date.now() / 1000);

/** A region around Valencia under an orange warning for rain. */
const WARNINGS = {
  type: 'FeatureCollection',
  tesel: 'weather-warnings',
  version: 1,
  updated: now,
  source: 'MeteoAlarm (EUMETNET)',
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-0.6, 39.3],
            [-0.2, 39.3],
            [-0.2, 39.6],
            [-0.6, 39.6],
            [-0.6, 39.3],
          ],
        ],
      },
      properties: {
        code: 'ES521',
        name: 'Litoral norte de Valencia',
        level: 3,
        warnings: [
          {
            level: 3,
            onset: now - 3600,
            expires: now + 6 * 3600,
            text: { es: { event: 'Lluvias', description: '80 mm en 12 horas' } },
          },
        ],
      },
    },
  ],
};

/** A device in Valencia whose server publishes the warnings above. */
async function deviceUnderWarning(browser: Parameters<typeof device>[0]): Promise<Page> {
  const page = await device(browser, 'Ana');
  await page.route('**/v1/weather-warnings', (route) => route.fulfill({ json: WARNINGS }));
  await page.reload();
  return page;
}

test('a warning shows where this device is and at a point picked in it', async ({ browser }) => {
  const page = await deviceUnderWarning(browser);
  await page.getByRole('button', { name: 'Mostrar mi ubicación' }).click();
  const card = page.getByRole('region', { name: 'Aviso meteorológico donde estás' });
  await expect(card).toContainText('Aviso naranja · Lluvias');
  // Credited to who issued it and who gathered it, each linked.
  await expect(card).toContainText('Fuente: AEMET, a través de MeteoAlarm (EUMETNET)');
  await expect(card.getByRole('link', { name: 'AEMET' })).toHaveAttribute(
    'href',
    'https://www.aemet.es',
  );
  await expect(card.getByRole('link', { name: 'MeteoAlarm (EUMETNET)' })).toHaveAttribute(
    'href',
    'https://meteoalarm.org',
  );
  await card.getByRole('button', { name: 'Cerrar' }).click();
  await expect(card).toBeHidden();

  await page.locator('.maplibregl-canvas').click();
  const panel = page.getByRole('region', { name: 'Punto del mapa' });
  await expect(panel).toContainText('Aviso naranja · Lluvias');
  await panel.getByText('Detalles').click();
  await expect(panel).toContainText('80 mm en 12 horas');
});

test('warnings go away with their layer', async ({ browser }) => {
  const page = await deviceUnderWarning(browser);
  await page.getByRole('button', { name: 'Mostrar mi ubicación' }).click();
  const card = page.getByRole('region', { name: 'Aviso meteorológico donde estás' });
  await expect(card).toBeVisible();

  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const layers = page.getByRole('region', { name: 'Capas del mapa' });
  await layers.getByRole('switch', { name: 'Avisos meteo' }).click();
  await layers.getByRole('button', { name: 'Cerrar' }).click();
  await expect(card).toBeHidden();
});
