// Teams: whoever coordinates splits the group into teams, and a task for a team is each member's.

import { expect, test, twoMembers } from './helpers.ts';

test('a team is made, handed a task, and its members see it as theirs', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);

  // Ana makes the team "Norte", with Berta in it.
  await ana.getByRole('button', { name: /^Grupo:/ }).click();
  await ana.getByText('Equipos y seguridad', { exact: true }).click();
  await ana.getByRole('button', { name: 'Nuevo equipo' }).click();
  const form = ana.getByRole('dialog', { name: 'Nuevo equipo' });
  await form.getByLabel('Nombre del equipo').fill('Norte');
  await form.getByLabel('Berta').check();
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form).toBeHidden();
  const groups = ana.getByRole('region', { name: 'Grupos' });
  await expect(groups.getByRole('heading', { name: /Norte/ })).toContainText('1');
  await groups.getByRole('button', { name: 'Cerrar' }).click();

  // A task for the team.
  await ana.getByRole('button', { name: 'Tareas' }).click();
  const tasks = ana.getByRole('region', { name: 'Tareas' });
  await tasks.getByRole('button', { name: 'Nueva tarea' }).click();
  await tasks.getByLabel('Qué hay que hacer').fill('Revisar el barranco');
  await tasks.getByLabel('Para').selectOption({ label: 'Norte' });
  await tasks.getByRole('button', { name: 'Guardar' }).click();
  await expect(tasks.getByText('Para Norte')).toBeVisible();

  // Berta is told, and finds it among hers and in her card.
  await expect(
    berta.getByText('Ana ha pasado una tarea a tu equipo, Norte: «Revisar el barranco»'),
  ).toBeVisible();
  await expect(berta.getByRole('button', { name: 'Tareas: 1 para ti' })).toBeVisible();
  await berta.getByRole('button', { name: /^Yo/ }).click();
  const me = berta.getByRole('region', { name: 'Yo' });
  await expect(me).toContainText('Equipo Norte');
  await expect(me).toContainText('Revisar el barranco');
});
