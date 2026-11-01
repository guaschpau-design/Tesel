import { createGroup, device, expect, openMore, stored, tapMapUntil, test } from './helpers.ts';

test('a dictated coordinate is found on the map and read in another format', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await openMore(page, 'Ir a una coordenada');
  await page.getByLabel('Coordenadas').fill('39,4699 -0,3763');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Punto del mapa' });
  await expect(panel.locator('output')).toHaveText('39.46990, -0.37630');

  // The format is chosen once, in Settings, and every coordinate follows it.
  await openMore(page, 'Ajustes');
  const settings = page.getByRole('region', { name: 'Ajustes' });
  await settings.getByLabel('Formato de coordenadas').selectOption('MGRS');
  await settings.getByRole('button', { name: 'Cerrar' }).click();
  await openMore(page, 'Ir a una coordenada');
  await page.getByLabel('Coordenadas').fill('39,4699 -0,3763');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  await expect(panel.locator('output')).toHaveText('30S YJ 25695 72210');

  // The format is remembered.
  await expect.poll(() => stored(page, 'settings', 'coordinateFormat')).toBe('mgrs');
  await page.reload();
  await page.locator('.maplibregl-canvas').click();
  await expect(page.getByRole('region', { name: 'Punto del mapa' }).locator('output')).toHaveText(
    /^\d{1,2}[C-X] [A-Z]{2} \d{5} \d{5}$/,
  );
});

test('a coordinate that cannot be read says which formats can', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await openMore(page, 'Ir a una coordenada');
  await page.getByLabel('Coordenadas').fill('al lado del puente');
  await page.getByRole('button', { name: 'Ir', exact: true }).click();
  await expect(
    page.getByText('Tesel no reconoce estas coordenadas.', { exact: false }),
  ).toBeVisible();
});

test('a marker and a task’s place are given by their coordinates, typed as dictated', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana', '/#map=15/39.4699/-0.3763');
  await createGroup(page, 'Norte');
  await page.getByRole('button', { name: 'Cerrar' }).click();

  // A marker at coordinates read over the radio: it is placed, then described as one tapped.
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('menuitem', { name: 'Marcador' }).click();
  const bar = page.getByRole('region', { name: 'Nuevo marcador' });
  await bar.getByRole('button', { name: 'Escribir coordenadas' }).click();
  await bar.getByRole('textbox', { name: 'Coordenadas' }).fill('al lado del puente');
  await bar.getByRole('button', { name: 'Añadir' }).click();
  await expect(bar).toContainText('Tesel no reconoce estas coordenadas.');
  await bar.getByRole('textbox', { name: 'Coordenadas' }).fill('30S 725695 4372210');
  await bar.getByRole('button', { name: 'Añadir' }).click();
  const form = page.getByRole('dialog', { name: 'Nuevo marcador' });
  await form.getByLabel('Etiqueta (opcional)').fill('Fuente');
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form).toBeHidden();
  // The map went to it: it is in the middle, where a tap opens it.
  const marker = page.getByRole('region', { name: 'Fuente' });
  await tapMapUntil(page, {}, () => expect(marker).toBeVisible({ timeout: 2000 }));
  await marker.getByRole('button', { name: 'Cerrar' }).click();

  // A task's place, typed on the card where it is picked.
  await page.getByRole('button', { name: 'Tareas' }).click();
  const tasks = page.getByRole('region', { name: 'Tareas' });
  await tasks.getByRole('button', { name: 'Nueva tarea' }).click();
  await tasks.getByLabel('Qué hay que hacer').fill('Revisar la fuente');
  await tasks.getByRole('button', { name: 'Elegir en el mapa' }).click();
  const picker = page.getByRole('region', { name: 'Elegir en el mapa' });
  await picker.getByRole('button', { name: 'Escribir coordenadas' }).click();
  await picker.getByRole('textbox', { name: 'Coordenadas' }).fill('39,4699 -0,3763');
  await picker.getByRole('button', { name: 'Usar' }).click();
  await expect(tasks.getByLabel('Qué hay que hacer')).toHaveValue('Revisar la fuente');
  await expect(tasks.getByText('Lugar: ninguno')).toBeHidden();
});
