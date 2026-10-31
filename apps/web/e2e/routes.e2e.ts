// Routes: drawn or read from a file, handed to a member as a task, followed to their end.

import {
  createGroup,
  device,
  expect,
  mapIdle,
  tapMap,
  tapMapUntil,
  test,
  twoMembers,
} from './helpers.ts';

const START = { latitude: 39.4699, longitude: -0.3763 };
const VIEW = `/#map=15/${String(START.latitude)}/${String(START.longitude)}`;

test('a route drawn on the map is handed as a task and followed', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  // Ana draws a route from where both stand, east and then north.
  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Ruta' }).click();
  await tapMap(ana, 0, 0);
  await tapMap(ana, 100, 0);
  await tapMap(ana, 100, -100);
  await ana.getByRole('button', { name: 'Terminar' }).click();
  const form = ana.getByRole('dialog', { name: 'Nueva ruta' });
  await expect(form.getByRole('radio')).toHaveCount(0);
  await form.getByLabel('Etiqueta (opcional)').fill('Ronda norte');
  await form.getByRole('button', { name: 'Guardar' }).click();

  // She opens it and leaves a task along it for Berta.
  const route = ana.getByRole('region', { name: 'Ronda norte' });
  await tapMapUntil(ana, { dx: 50, dy: 0 }, () => expect(route).toBeVisible());
  await expect(route).toContainText(/Ruta\s·\s\d+\sm/);
  await route.getByRole('button', { name: 'Tarea en esta ruta' }).click();
  const anaTasks = ana.getByRole('region', { name: 'Tareas' });
  await expect(anaTasks.getByText('Lugar: Ruta «Ronda norte»')).toBeVisible();
  await anaTasks.getByLabel('Qué hay que hacer').fill('Recorrer la ronda');
  await anaTasks.getByLabel('Para').selectOption({ label: 'Berta' });
  await anaTasks.getByRole('button', { name: 'Guardar' }).click();

  // Berta goes from the task to the route, and follows it from its start.
  await expect(berta.getByText('Ana te ha pasado una tarea: «Recorrer la ronda»')).toBeVisible();
  await berta.getByRole('button', { name: 'Tareas: 1 para ti' }).click();
  await berta
    .getByRole('region', { name: 'Tareas' })
    .getByRole('listitem')
    .filter({ hasText: 'Recorrer la ronda' })
    .getByRole('button', { name: 'Ver en el mapa' })
    .click();
  await berta
    .getByRole('region', { name: 'Ronda norte' })
    .getByRole('button', { name: 'Seguir ruta' })
    .click();
  const card = berta.getByRole('region', { name: 'Siguiendo Ronda norte' });
  await expect(card).toContainText(/Quedan \d+ m/);
  await expect(card).toContainText(/Punto 2 de 3: \d+ m · 0[89]\d° E/);
  await card.getByRole('button', { name: 'Parar' }).click();
  await expect(card).toBeHidden();
});

test('a route read from a file is thinned, followed to its end and its task done', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', VIEW);
  await createGroup(page, 'Ronda');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // A track recorded every few metres: about 300 m north, then about 300 m east.
  const corner = { latitude: 39.4726, longitude: START.longitude };
  const end = { latitude: corner.latitude, longitude: -0.3728 };
  const points = [
    ...Array.from({ length: 200 }, (_, index) => ({
      latitude: START.latitude + ((corner.latitude - START.latitude) * index) / 200,
      longitude: START.longitude,
    })),
    ...Array.from({ length: 201 }, (_, index) => ({
      latitude: corner.latitude,
      longitude: corner.longitude + ((end.longitude - corner.longitude) * index) / 200,
    })),
  ];
  const gpx = `<?xml version="1.0"?><gpx version="1.1"><trk><name>Ronda importada</name><trkseg>${points
    .map((point) => `<trkpt lat="${String(point.latitude)}" lon="${String(point.longitude)}"/>`)
    .join('')}</trkseg></trk></gpx>`;

  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('menuitem', { name: 'Ruta' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'ronda.gpx',
    mimeType: 'application/gpx+xml',
    buffer: Buffer.from(gpx),
  });
  const bar = page.getByRole('region', { name: 'Nueva ruta' });
  await expect(bar).toContainText('«Ronda importada», 3 puntos');
  await expect(bar).toContainText('De sus 401 puntos');
  await bar.getByRole('button', { name: 'Terminar' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva ruta' });
  await expect(form.getByLabel('Etiqueta (opcional)')).toHaveValue('Ronda importada');
  await form.getByRole('button', { name: 'Guardar' }).click();
  // Closed once the route is stored, which the reload below must not cut short.
  await expect(form).toBeHidden();

  // A task along it for this device, then following it from the task. The map framed the route
  // read; it goes back to where it was.
  await mapIdle(page);
  await page.goto(VIEW);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${VIEW.replaceAll('.', '\\.')}$`));
  const route = page.getByRole('region', { name: 'Ronda importada' });
  await tapMapUntil(page, { dx: 0, dy: -25 }, () => expect(route).toBeVisible());
  await route.getByRole('button', { name: 'Tarea en esta ruta' }).click();
  const tasks = page.getByRole('region', { name: 'Tareas' });
  await tasks.getByLabel('Qué hay que hacer').fill('Revisar la ronda');
  await tasks.getByLabel('Para').selectOption({ label: 'Ana (tú)' });
  await tasks.getByRole('button', { name: 'Guardar' }).click();
  // Starting it is following it, from the task itself.
  await tasks.getByRole('button', { name: 'Seguir ruta' }).click();
  const card = page.getByRole('region', { name: 'Siguiendo Ronda importada' });
  await expect(card).toContainText('Punto 2 de 3');
  await page.getByRole('button', { name: 'Tareas' }).click();
  await expect(tasks.getByRole('listitem')).toContainText('En curso');
  await tasks.getByRole('button', { name: 'Cerrar' }).click();

  // At the end, the task is done with one tap.
  await page.context().setGeolocation({ ...end, accuracy: 5 });
  await expect(card).toContainText('Has llegado al final de la ruta.');
  await card.getByRole('button', { name: 'Tarea hecha' }).click();
  await expect(card).toBeHidden();
  await page.getByRole('button', { name: 'Tareas' }).click();
  await expect(tasks.getByText('Hechas (1)')).toBeVisible();
});

test('an area read from a KML file is shown to look over, then saved', async ({ browser }) => {
  const page = await device(browser, 'Ana', VIEW);
  await createGroup(page, 'Norte');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // A search sector as another app exports it: a polygon, its first corner repeated at its end.
  const kml = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document>
    <Placemark><name>Sector 3</name><Polygon><outerBoundaryIs><LinearRing><coordinates>
      -0.3770,39.4690,0 -0.3750,39.4690,0 -0.3750,39.4705,0 -0.3770,39.4705,0 -0.3770,39.4690,0
    </coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>
  </Document></kml>`;
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('menuitem', { name: 'Zona' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'sector.kml',
    mimeType: 'application/vnd.google-earth.kml+xml',
    buffer: Buffer.from(kml),
  });
  const bar = page.getByRole('region', { name: 'Nueva zona' });
  await expect(bar).toContainText('«Sector 3», 4 puntos');
  await bar.getByRole('button', { name: 'Terminar' }).click();
  const form = page.getByRole('dialog', { name: 'Nueva zona' });
  await expect(form.getByLabel('Etiqueta (opcional)')).toHaveValue('Sector 3');
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form).toBeHidden();
});
