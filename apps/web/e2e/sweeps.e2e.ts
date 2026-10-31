// Sweeps: a search area split into strips, one per team, each handed out as a task; the area is
// cleared once every strip is done.

import { expect, openMore, tapMap, tapMapUntil, test, twoMembers } from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

test('a sweep is planned, its strips handed out, followed and finished', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  // Ana, who coordinates, draws a search area.
  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Zona' }).click();
  await tapMap(ana, -80, -60);
  await tapMap(ana, 80, -60);
  await tapMap(ana, 80, 100);
  await tapMap(ana, -80, 100);
  await ana.getByRole('button', { name: 'Terminar' }).click();
  await ana.getByRole('radio', { name: 'Zona de búsqueda asignada' }).check();
  await ana.getByLabel('Etiqueta (opcional)').fill('Ladera');
  await ana.getByRole('button', { name: 'Guardar' }).click();

  // She plans its sweep: open ground, two teams, the second for Berta.
  const area = ana.getByRole('region', { name: 'Ladera' });
  await tapMapUntil(ana, { dx: 0, dy: 20 }, () => expect(area).toBeVisible());
  await area.getByRole('button', { name: 'Planificar batida' }).click();
  const planner = ana.getByRole('region', { name: 'Planificar batida' });
  await planner.getByRole('radio', { name: 'Abierto · 25 m' }).click();
  await expect(planner.getByLabel('Separación (m)')).toHaveValue('25');
  await expect(planner.getByRole('group', { name: 'Equipos' })).toContainText('2');
  await expect(planner).toContainText(/\d+ calles · unos [\d,.]+ (m|km) a pie por equipo/);
  await planner.getByLabel('Franja 2').selectOption({ label: 'Berta' });
  await planner.getByRole('button', { name: 'Crear batida' }).click();
  // A strip and its task each, written one after another: a slow machine takes a while.
  await expect(planner).toBeHidden({ timeout: 15_000 });

  // Berta is handed her strip, and follows it from her tasks.
  const name = 'Batida «Ladera» · franja 2 de 2';
  await expect(berta.getByText(`Ana te ha pasado una tarea: «${name}»`)).toBeVisible();
  await berta.getByRole('button', { name: 'Tareas: 1 para ti' }).click();
  const bertaTask = berta
    .getByRole('region', { name: 'Tareas' })
    .getByRole('listitem')
    .filter({ hasText: name });
  await bertaTask.getByRole('button', { name: 'Ver en el mapa' }).click();
  const strip = berta.getByRole('region', { name });
  await expect(strip).toContainText(/Franja de batida\s·\s[\d,.]+ (m|km) de calles, a 25 m/);
  await expect(strip).toContainText('Franja 2 · Berta');
  // From the strip, its area tells how the whole sweep goes.
  await strip.getByRole('button', { name: 'Ver la zona' }).click();
  const bertaArea = berta.getByRole('region', { name: 'Ladera' });
  await expect(bertaArea).toContainText('Franja 1 · cualquiera');
  await bertaArea.getByRole('button', { name: /^Franja 2 · Berta/ }).click();
  await strip.getByRole('button', { name: 'Seguir franja' }).click();
  const card = berta.getByRole('region', { name: `Siguiendo ${name}` });
  await expect(card).toContainText(/\d+ % barrido/);
  await card.getByRole('button', { name: 'Parar' }).click();

  // Ana takes the first strip herself: starting it is following it. Both finish theirs.
  await ana.getByRole('button', { name: 'Tareas' }).click();
  const anaTask = ana
    .getByRole('region', { name: 'Tareas' })
    .getByRole('listitem')
    .filter({ hasText: 'Batida «Ladera» · franja 1 de 2' });
  await anaTask.getByRole('button', { name: 'Seguir franja' }).click();
  const anaCard = ana.getByRole('region', { name: 'Siguiendo Batida «Ladera» · franja 1 de 2' });
  await anaCard.getByRole('button', { name: 'Parar' }).click();
  await ana.getByRole('button', { name: 'Tareas' }).click();
  await anaTask.getByRole('button', { name: 'Hecha' }).click();
  await berta.getByRole('button', { name: /^Tareas/ }).click();
  await bertaTask.getByRole('button', { name: 'Seguir franja' }).click();
  await card.getByRole('button', { name: 'Parar' }).click();
  await berta.getByRole('button', { name: /^Tareas/ }).click();
  await bertaTask.getByRole('button', { name: 'Hecha' }).click();

  // The area is cleared, for everyone.
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await openMore(ana, 'Diario de la operación');
  await expect(
    ana
      .getByRole('region', { name: 'Diario de la operación' })
      .getByText('Cambia Zona de búsqueda despejada «Ladera».'),
  ).toBeVisible();
});
