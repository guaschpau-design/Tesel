// The core promise of v0.1: prepare while online, keep working when the network is gone.

import type { Page } from '@playwright/test';

import { chooseAlias, expect, mapIdle, openMore, tapMap, test, twoMembers } from './helpers.ts';

test('a downloaded area keeps working after going offline and reloading', async ({
  page,
  context,
}) => {
  await page.goto('/#map=13/39.47/-0.36');
  await chooseAlias(page, 'Ana');
  await expect(page.getByRole('button', { name: /^Conexiones: WiFi/ })).toBeVisible();

  // The service worker must be active before we go offline.
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active),
    )
    .toBe(true);

  await openMore(page, 'Mapas sin conexión');
  // The size and the button come first; the name waits under the options.
  await expect(page.getByText(/^Unos \d/)).toBeVisible();
  await page.getByText('Opciones', { exact: true }).click();
  await page.getByLabel('Nombre').fill('Valencia centro');
  await page.getByRole('button', { name: 'Descargar', exact: true }).click();
  await expect(page.getByText('Valencia centro')).toBeVisible();
  await expect(page.getByText('Incompleta')).toHaveCount(0);
  await page.getByRole('button', { name: 'Cerrar' }).click();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('button', { name: 'Conexiones: Sin conexión' })).toBeVisible();
  // Tiles come from IndexedDB: the map loads its sources and settles, with no network.
  await mapIdle(page);
  // Only the map drawing is compared; UI text depends on the system fonts of each machine.
  await expect(page.locator('.maplibregl-map')).toHaveScreenshot('offline-valencia.png', {
    maxDiffPixelRatio: 0.05,
    mask: [
      page.locator('.maplibregl-ctrl'),
      page.locator('.dock'),
      page.locator('button.sos'),
      page.getByRole('region', { name: 'Para empezar' }),
    ],
  });
});

test('an area whose download stopped is completed with «Reanudar»', async ({ page }) => {
  await page.goto('/#map=13/39.47/-0.36');
  await chooseAlias(page, 'Ana');
  // An area left half-way, as a download stopped by losing the network leaves it.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('tesel-map');
        open.onerror = () => {
          reject(new Error('no map database'));
        };
        open.onsuccess = () => {
          const tx = open.result.transaction('areas', 'readwrite');
          tx.objectStore('areas').put({
            id: 'stopped',
            name: 'Cortada',
            bounds: { west: -0.38, south: 39.465, east: -0.37, north: 39.472 },
            minZoom: 0,
            layers: [{ source: 'basemap', maxZoom: 13 }],
            createdAt: Date.now(),
            storedTiles: 0,
            bytes: 0,
            complete: false,
          });
          tx.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
  );
  await openMore(page, 'Mapas sin conexión');
  const panel = page.getByRole('region', { name: 'Mapas sin conexión' });
  await expect(panel.getByText('Incompleta')).toBeVisible();
  await panel.getByRole('button', { name: 'Reanudar' }).click();
  await expect(panel.getByText('Incompleta')).toHaveCount(0);
  await expect(panel.getByText('La descarga se ha detenido')).toHaveCount(0);
});

test('with no area downloaded, the map keeps an overview and the places seen', async ({
  page,
  context,
}) => {
  await page.goto('/#map=13/39.47/-0.36');
  await chooseAlias(page, 'Ana');
  await expect
    .poll(() =>
      page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active),
    )
    .toBe(true);
  await mapIdle(page);
  // The test map covers a part of Valencia: at least one tile at each zoom from 0 to 6.
  await expect.poll(async () => (await keptTiles(page)).overview).toBeGreaterThanOrEqual(7);
  const online = await keptTiles(page);
  expect(online.seen).toBeGreaterThan(0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Conexiones: Sin conexión' })).toBeVisible();
  await mapIdle(page);
  const offline = await keptTiles(page);
  expect(offline.overview).toBe(online.overview);
  expect(offline.seen).toBeGreaterThanOrEqual(online.seen);
});

/** Tiles the device keeps without any area: the overview's, and those seen online. */
function keptTiles(page: Page): Promise<{ overview: number; seen: number }> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open('tesel-map');
      open.onsuccess = () => {
        resolve(open.result);
      };
    });
    const read = <T>(store: string) =>
      new Promise<T[]>((resolve) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => {
          resolve(request.result as T[]);
        };
      });
    const tiles = await read<{ areas: string[] }>('tiles');
    const seen = await read<unknown>('viewed');
    db.close();
    return {
      overview: tiles.filter(({ areas }) => areas.includes('overview')).length,
      seen: seen.length,
    };
  });
}

test('members are offered the map of the operation area their coordinator marks', async ({
  browser,
}) => {
  const { ana, berta } = await twoMembers(browser, '/#map=15/39.47/-0.37');

  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Zona' }).click();
  await tapMap(ana, -60, -60);
  await tapMap(ana, 60, -60);
  await tapMap(ana, 0, 60);
  await ana.getByRole('button', { name: 'Terminar' }).click();
  await ana.getByRole('radio', { name: 'Zona del operativo' }).check();
  await ana.getByLabel('Etiqueta (opcional)').fill('Sector norte');
  await ana.getByRole('button', { name: 'Guardar' }).click();

  const offer = berta.getByRole('region', { name: 'Zona del operativo «Sector norte»' });
  await offer.getByRole('button', { name: 'Descargar' }).click();
  await expect(offer).toBeHidden();
  await openMore(berta, 'Mapas sin conexión');
  await expect(berta.getByText('Sector norte')).toBeVisible();
});
