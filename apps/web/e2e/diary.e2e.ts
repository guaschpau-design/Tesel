import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';

import { expect, openMore, test, twoMembers } from './helpers.ts';

async function openDiary(page: Page): Promise<void> {
  await openMore(page, 'Diario de la operación');
}

test('the diary tells what happened and downloads as text for the report', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);
  await berta.getByRole('button', { name: 'Chat' }).click();
  await berta.getByLabel('Mensaje').fill('Llegamos al puente');
  await berta.getByRole('button', { name: 'Enviar', exact: true }).click();
  // Ana, with the chat closed, is told, and opens it from the notice.
  await ana
    .getByRole('status')
    .filter({ hasText: 'Berta: «Llegamos al puente»' })
    .getByRole('button', { name: 'Ver' })
    .click();
  await expect(ana.getByRole('region', { name: 'Chat' })).toContainText('Llegamos al puente');
  await ana.getByRole('button', { name: 'Cerrar' }).click();

  await openDiary(ana);
  const diary = ana.getByRole('region', { name: 'Diario de la operación' });
  await expect(diary.getByRole('listitem').first()).toContainText('Berta');
  await expect(diary.getByRole('listitem').first()).toContainText('«Llegamos al puente»');
  await expect(diary).toContainText('Se une al grupo (coordinador).');

  const download = ana.waitForEvent('download');
  await diary.getByRole('button', { name: 'Descargar' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^tesel-rescate-valencia-\d{4}-\d{2}-\d{2}\.txt$/);
  const text = await readFile(await file.path(), 'utf8');
  expect(text).toContain('Grupo: Rescate Valencia');
  expect(text).toMatch(/· Berta · «Llegamos al puente»/);
});

test('whoever coordinates downloads the debrief of the last hours as a PDF', async ({
  browser,
}) => {
  const { ana, berta } = await twoMembers(browser);
  await berta.getByRole('button', { name: 'Chat' }).click();
  await berta.getByLabel('Mensaje').fill('Llegamos al puente');
  await berta.getByRole('button', { name: 'Enviar', exact: true }).click();
  await berta.getByRole('button', { name: 'Cerrar' }).click();

  // A member sees the diary, not the debrief.
  await openDiary(berta);
  const bertaDiary = berta.getByRole('region', { name: 'Diario de la operación' });
  await expect(bertaDiary.getByText('Llegamos al puente')).toBeVisible();
  await expect(bertaDiary.getByText('Informe', { exact: true })).toHaveCount(0);

  await openDiary(ana);
  const diary = ana.getByRole('region', { name: 'Diario de la operación' });
  await expect(diary.getByText('«Llegamos al puente»')).toBeVisible();
  await diary.getByText('Informe', { exact: true }).click();
  // Filled in with the group's last spell of activity.
  await expect(diary.getByLabel('Desde')).not.toHaveValue('');
  await expect(diary.getByLabel('Hasta')).not.toHaveValue('');
  await expect(diary.getByText(/^\d+ entradas del diario en esas horas\.$/)).toBeVisible();

  const download = ana.waitForEvent('download');
  await diary.getByRole('button', { name: 'Descargar el informe' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^tesel-rescate-valencia-\d{4}-\d{2}-\d{2}\.pdf$/);
  const pdf = await readFile(await file.path(), 'latin1');
  expect(pdf.startsWith('%PDF-1.4')).toBe(true);
  expect(pdf).toContain('(Rescate Valencia)');
  expect(pdf).toContain('\\253Llegamos al puente\\273');

  // Hours with nothing in them make no debrief.
  await diary.getByLabel('Hasta').fill('2000-01-01T00:00');
  await expect(diary.getByText('No hay nada en el diario entre esas horas.')).toBeVisible();
  await expect(diary.getByRole('button', { name: 'Descargar el informe' })).toBeDisabled();
});

test('the group log is saved, and loading it adds only what is missing', async ({ browser }) => {
  const { ana } = await twoMembers(browser);
  await openDiary(ana);
  const diary = ana.getByRole('region', { name: 'Diario de la operación' });

  await diary.getByText('Copia de seguridad').click();
  const download = ana.waitForEvent('download');
  await diary.getByRole('button', { name: 'Guardar copia' }).click();
  const saved = await readFile(await (await download).path(), 'utf8');
  expect(saved).toContain('"tesel":"log"');
  expect(saved).not.toContain('Rescate Valencia');

  const loader = diary.locator('input[type="file"]');
  await loader.setInputFiles({
    name: 'copia.tesel',
    mimeType: 'application/json',
    buffer: Buffer.from(saved),
  });
  await expect(diary.getByRole('status')).toHaveText(
    /^Registro cargado: 0 eventos nuevos de \d+\.$/,
  );

  await loader.setInputFiles({
    name: 'notas.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hola'),
  });
  await expect(diary.getByRole('status')).toHaveText('Este archivo no es un registro de Tesel.');
});
