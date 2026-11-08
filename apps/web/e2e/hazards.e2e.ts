// Fires and flood zones over the map: pictures of the view from NASA's GIBS and Spain's SNCZI,
// stood in for by a blank picture, as the cadastre's are.

import type { Page } from '@playwright/test';

import { device, expect, test } from './helpers.ts';

const BLANK_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Answers a service with a blank picture, and keeps what was asked of it. */
async function standIn(page: Page, host: string): Promise<URL[]> {
  const asked: URL[] = [];
  await page.route(`https://${host}/**`, async (route) => {
    asked.push(new URL(route.request().url()));
    await route.fulfill({ contentType: 'image/png', body: BLANK_PNG });
  });
  return asked;
}

async function turnOn(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Capas del mapa' }).click();
  const layers = page.getByRole('region', { name: 'Capas del mapa' });
  const layer = layers.getByRole('switch', { name });
  await layer.click();
  await expect(layer).toHaveAttribute('aria-checked', 'true');
  await layers.getByRole('button', { name: 'Cerrar' }).click();
}

test('fires ask GIBS for each satellite’s detections of yesterday and today', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', '/#map=9/39.4750/-0.3700');
  const asked = await standIn(page, 'gibs.earthdata.nasa.gov');
  await turnOn(page, 'Incendios');
  await expect.poll(() => asked.length).toBe(6);
  expect(new Set(asked.map((url) => url.searchParams.get('TIME'))).size).toBe(2);
  expect(asked.every((url) => url.searchParams.get('SRS') === 'EPSG:3857')).toBe(true);
});

test('flood zones ask the SNCZI for the view', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/#map=12/39.4750/-0.3700');
  const asked = await standIn(page, 'wms.mapama.gob.es');
  await turnOn(page, 'Zonas inundables');
  await expect.poll(() => asked.length).toBe(1);
  expect(asked[0]?.searchParams.get('LAYERS')).toBe('NZ.RiskZone');
});
