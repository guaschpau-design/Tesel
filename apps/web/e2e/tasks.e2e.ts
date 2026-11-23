// Phase 2.4: a task handed from one member to another, started and finished; how far the member
// is with it, and whoever coordinates told once they get there (ADR-0166).

import { expect, shareAs, tapMap, test, twoMembers } from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

test('a task at a point reaches its assignee, who starts and finishes it', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  // Ana picks a point of the map and leaves a task there for Berta.
  await ana.locator('.maplibregl-canvas').click();
  const point = ana.getByRole('region', { name: 'Punto del mapa' });
  await point.getByRole('button', { name: 'Tarea aquí' }).click();
  const anaTasks = ana.getByRole('region', { name: 'Tareas' });
  await anaTasks.getByLabel('Qué hay que hacer').fill('Revisar el almacén');
  await anaTasks.getByLabel('Para').selectOption({ label: 'Berta' });
  await expect(anaTasks.getByText(/^Lugar:/)).toBeVisible();
  await anaTasks.getByRole('button', { name: 'Guardar' }).click();
  await expect(anaTasks.getByText('Para Berta')).toBeVisible();

  // Berta is told, and the dock counts it.
  await expect(berta.getByText('Ana te ha pasado una tarea: «Revisar el almacén»')).toBeVisible();
  await berta.getByRole('button', { name: 'Tareas: 1 para ti' }).click();
  const bertaTasks = berta.getByRole('region', { name: 'Tareas' });
  const task = bertaTasks.getByRole('listitem').filter({ hasText: 'Revisar el almacén' });
  await task.getByRole('button', { name: 'Empezar' }).click();
  await expect(task).toContainText('En curso');
  // Ana, who coordinates, is told without going to look.
  await expect(ana.getByText('Berta ha empezado «Revisar el almacén».')).toBeVisible();
  // Done by mistake, it goes back in one tap; then done for good.
  await task.getByRole('button', { name: 'Hecha' }).click();
  await expect(task).toBeHidden();
  await berta.getByRole('button', { name: 'Deshacer' }).click();
  await expect(task).toContainText('En curso');
  await task.getByRole('button', { name: 'Hecha' }).click();
  await expect(task).toBeHidden();
  await expect(berta.getByRole('button', { name: 'Tareas', exact: true })).toBeVisible();

  // Ana is told it is done, and sees it among the done ones.
  await expect(ana.getByText('Berta ha terminado «Revisar el almacén».')).toBeVisible();
  await expect(anaTasks.getByText('Hechas (1)')).toBeVisible();
});

test('a common task, for anyone, is taken by whoever starts it', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  await ana.getByRole('button', { name: 'Tareas' }).click();
  const anaTasks = ana.getByRole('region', { name: 'Tareas' });
  await anaTasks.getByRole('button', { name: 'Nueva tarea' }).click();
  await anaTasks.getByLabel('Tarea habitual').selectOption({ label: 'Llevar material' });
  await expect(anaTasks.getByLabel('Qué hay que hacer')).toHaveValue('Llevar material');
  // Its place is picked on the map, and the form comes back as it was left.
  await expect(anaTasks.getByText('Lugar: ninguno')).toBeVisible();
  await anaTasks.getByRole('button', { name: 'Elegir en el mapa' }).click();
  await expect(anaTasks).toBeHidden();
  await expect(ana.getByText(/Toca el mapa donde es la tarea/)).toBeVisible();
  await tapMap(ana);
  await expect(anaTasks.getByLabel('Qué hay que hacer')).toHaveValue('Llevar material');
  await expect(anaTasks.getByText('Lugar: ninguno')).toBeHidden();
  await expect(anaTasks.getByRole('button', { name: 'Cambiar' })).toBeVisible();
  await anaTasks.getByRole('button', { name: 'Guardar' }).click();
  await expect(
    anaTasks
      .getByRole('listitem')
      .filter({ hasText: 'Llevar material' })
      .getByRole('button', { name: 'Ver en el mapa' }),
  ).toBeVisible();
  await expect(anaTasks.getByText('Para cualquiera')).toBeVisible();

  await berta.getByRole('button', { name: 'Tareas' }).click();
  const task = berta
    .getByRole('region', { name: 'Tareas' })
    .getByRole('listitem')
    .filter({ hasText: 'Llevar material' });
  await task.getByRole('button', { name: 'Empezar' }).click();
  await expect(anaTasks.getByText('Para Berta')).toBeVisible();
});

test('a card tells how far a member is with a task, and whoever coordinates is told once there', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const { ana, berta } = await twoMembers(browser, VIEW);
  // Berta is some 400 m north of the centre of the view, and shares where she is.
  await berta.context().setGeolocation({ latitude: 39.4735, longitude: -0.3763, accuracy: 5 });
  await shareAs(berta, 'Compartir');

  // Ana leaves a task for her at the centre.
  await ana.locator('.maplibregl-canvas').click();
  await ana
    .getByRole('region', { name: 'Punto del mapa' })
    .getByRole('button', { name: 'Tarea aquí' })
    .click();
  const anaTasks = ana.getByRole('region', { name: 'Tareas' });
  await anaTasks.getByLabel('Qué hay que hacer').fill('Revisar el almacén');
  await anaTasks.getByLabel('Para').selectOption({ label: 'Berta' });
  await anaTasks.getByRole('button', { name: 'Guardar' }).click();
  await expect(anaTasks.getByText('Para Berta')).toBeVisible();

  // Her card says how far she has to go.
  await ana.getByRole('button', { name: /^Grupo:/ }).click();
  await ana
    .getByRole('region', { name: 'Grupos' })
    .getByRole('listitem')
    .filter({ hasText: 'Berta' })
    .click();
  const card = ana.getByRole('region', { name: 'Berta' });
  await expect(card.getByText(/A \d+ m en línea recta · unos \d+ min a pie/)).toBeVisible({
    timeout: 15_000,
  });

  // She gets there: two fixes, 11 seconds apart.
  await berta.context().setGeolocation({ latitude: 39.46991, longitude: -0.3763, accuracy: 5 });
  await berta.waitForTimeout(11_000);
  await berta.context().setGeolocation({ latitude: 39.4699, longitude: -0.37631, accuracy: 5 });
  await expect(
    ana
      .getByRole('status')
      .filter({ hasText: 'Berta ha llegado al lugar de «Revisar el almacén».' }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(card.getByText(/Ha llegado · \d/)).toBeVisible();
});
