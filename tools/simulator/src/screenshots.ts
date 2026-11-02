// Takes the screenshots of the app that the site shows (apps/site/img): Ana coordinates in a real
// browser, the rest of the team is the Turia scenario played by simulated devices.
//
//   pnpm --filter @tesel/simulator screenshots --app http://localhost:8080/app/ --out shots
//     [--tiles tiles.json]
//
// The app must be built for its own server (VITE_SERVER_URL=/), as in the server image. Its base
// map must be reachable, or given with --tiles: a JSON object of "z/x/y" → base64 tile, which is
// loaded into the app's offline map store first. Writes tablet-chat.png and phone-map.png;
// apps/site/img/README.md says how they become the site's images.

import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { chromium, type Page } from '@playwright/test';
import { parseInvitationUrl } from '@tesel/protocol';

import { play } from './play.ts';
import { turia } from './scenarios/turia.ts';

const { values } = parseArgs({
  options: {
    app: { type: 'string', default: 'http://localhost:8080/app/' },
    out: { type: 'string', default: 'screenshots' },
    tiles: { type: 'string' },
  },
});

/** Where Ana stands, west of the sector. */
const ANA = { latitude: 39.4776, longitude: -0.3772 };
/** Map views, as the app's address hash: zoom/lat/lon. */
const VIEWS = {
  // With the chat open on the right, the scene moves left to stay in view.
  tabletChat: '15.45/39.4781/-0.3711',
  // The SOS card covers the top of a phone's screen; the scene sits below it.
  phoneMap: '14.75/39.4796/-0.3735',
};

mkdirSync(values.out, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1194, height: 834 },
    deviceScaleFactor: 2,
    locale: 'es-ES',
    permissions: ['geolocation'],
    geolocation: { ...ANA, accuracy: 6 },
  });
  const page = await context.newPage();
  await page.goto(values.app);
  const welcome = page.getByRole('dialog', { name: 'Te damos la bienvenida a Tesel' });
  // Once the app greets, it has created its storage, which the tiles go into.
  await welcome.waitFor();
  if (values.tiles !== undefined) {
    await seedTiles(
      page,
      JSON.parse(await readFile(values.tiles, 'utf8')) as Record<string, string>,
    );
    // The tile source remembers what it could not find; start again with the tiles in place.
    await page.reload();
  }

  await welcome.getByLabel('Tu nombre en el grupo').fill('Ana');
  await welcome.getByRole('button', { name: 'Continuar' }).click();
  // After the name, the groups panel opens on the ways into a group (ADR-0087).
  await page
    .getByRole('region', { name: 'Grupos' })
    .getByRole('button', { name: 'Crear grupo' })
    .click();
  await page.getByLabel('Nombre del grupo').fill('Equipo Turia');
  await page.getByRole('button', { name: 'Crear', exact: true }).click();
  await page.getByTitle('Conectado al servidor del grupo').waitFor();
  await page.getByRole('button', { name: 'Invitar' }).click();
  const link = await page.getByLabel('Enlace de invitación').inputValue();
  await page.getByRole('button', { name: 'Listo' }).click();
  await sharePosition(page);

  const invitation = parseInvitationUrl(link);
  if (!invitation.ok || invitation.value.server === null) throw new Error(`bad link ${link}`);
  await play(turia, {
    server: invitation.value.server,
    secret: invitation.value.secret,
    speed: Infinity,
    positionEvery: 60,
  });

  // Ana, who coordinates, tells everyone.
  await openChat(page);
  await page.getByLabel('Mensaje').fill('Reagrupamos en el punto de encuentro en 30 minutos');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();

  await showView(page, VIEWS.tabletChat);
  await openChat(page);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(values.out, 'tablet-chat.png') });
  // The app took the whole screen at Ana's first tap (ui/fullscreen.svelte.ts); a full-screen
  // window cannot be resized.
  await page.evaluate(() => document.exitFullscreen());
  await page.setViewportSize({ width: 390, height: 844 });
  await showView(page, VIEWS.phoneMap);
  await page.screenshot({ path: join(values.out, 'phone-map.png') });
  process.stdout.write(`Screenshots in ${values.out}\n`);
} finally {
  await browser.close();
}

/** Opens a map view with every panel closed, once its tiles have had time to draw. */
async function showView(page: Page, hash: string): Promise<void> {
  await page.goto(`${values.app}#map=${hash}`);
  await page.waitForTimeout(3000);
  for (const close of await page.getByRole('button', { name: 'Cerrar', exact: true }).all()) {
    await close.click();
  }
  await page.waitForTimeout(500);
}

/** Makes sure Ana shares her position, so her dot is on the map, then closes "Me". */
async function sharePosition(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Yo/ }).click();
  const panel = page.getByRole('region', { name: 'Yo' });
  const sharing = panel.getByRole('switch', { name: 'Compartir mi posición' });
  if ((await sharing.getAttribute('aria-checked')) !== 'true') await sharing.click();
  await panel.getByRole('button', { name: 'Cerrar' }).click();
}

/** The chat toggles, and a reload may restore it open: click until it is. */
async function openChat(page: Page): Promise<void> {
  const heading = page.getByRole('heading', { name: 'Chat' });
  for (let attempt = 0; attempt < 3 && (await heading.count()) === 0; attempt++) {
    await page.getByRole('button', { name: /^Chat/ }).click();
    await page.waitForTimeout(800);
  }
}

/** Puts tiles where the app keeps offline areas (IndexedDB "tesel-map"). */
async function seedTiles(page: Page, tiles: Record<string, string>): Promise<void> {
  await page.evaluate(async (entries) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('tesel-map');
      open.onsuccess = () => {
        resolve(open.result);
      };
      open.onerror = () => {
        reject(open.error ?? new Error('cannot open tesel-map'));
      };
    });
    const tx = db.transaction('tiles', 'readwrite');
    for (const [key, base64] of entries) {
      const data = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      // Keyed by source, then z/x/y, as the app keeps them (map/tiles/store.ts).
      tx.objectStore('tiles').put({ data: data.buffer, areas: ['screenshots'] }, `basemap/${key}`);
    }
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
    db.close();
  }, Object.entries(tiles));
}
