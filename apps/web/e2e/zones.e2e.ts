// Zone notices and telling someone without Tesel (ADR-0122, ADR-0127): whoever coordinates is told
// when a member who shares their position enters a danger area; an SOS card sends the call's
// location from the phone's share menu, or copies it, and the caller's own calls 112.

import type { Page } from '@playwright/test';

import { expect, openMore, shareAs, tapMap, test, twoMembers } from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

/** Two fixes on the spot, 11 seconds apart: what bears out the side of an area. */
async function standStill(page: Page): Promise<void> {
  await page.context().setGeolocation({ latitude: 39.46991, longitude: -0.3763, accuracy: 5 });
  await page.waitForTimeout(11_000);
  await page.context().setGeolocation({ latitude: 39.4699, longitude: -0.37631, accuracy: 5 });
}

test('whoever coordinates is told of a danger area entered, and the diary keeps it', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { ana, berta } = await twoMembers(browser, VIEW);
  await shareAs(berta, 'Compartir');

  // A square around the centre of the view, which is where Berta is.
  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Zona' }).click();
  await tapMap(ana, -80, -80);
  await tapMap(ana, 80, -80);
  await tapMap(ana, 80, 80);
  await tapMap(ana, -80, 80);
  await ana.getByRole('button', { name: 'Terminar' }).click();
  await ana.getByRole('radio', { name: 'Zona de peligro' }).check();
  await ana.getByLabel('Etiqueta (opcional)').fill('Derrumbe');
  await ana.getByRole('button', { name: 'Guardar' }).click();

  const warning = berta.getByRole('region', { name: 'Has entrado en una zona de peligro' });
  await expect(warning).toContainText('Derrumbe', { timeout: 15_000 });
  await standStill(berta);

  const notice = ana
    .getByRole('status')
    .filter({ hasText: 'Berta entra en la zona de peligro «Derrumbe».' });
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await notice.getByRole('button', { name: 'Ver' }).click();
  await expect(ana.getByRole('region', { name: 'Berta' })).toBeVisible();
  await ana.getByRole('button', { name: 'Cerrar' }).click();

  await openMore(ana, 'Diario de la operación');
  const diary = ana.getByRole('region', { name: 'Diario de la operación' });
  await expect(diary).toContainText('Entra en la zona de peligro «Derrumbe».');
});

test('a member who does not share their position tells the group of no area', async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { ana, berta } = await twoMembers(browser, VIEW);

  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Zona' }).click();
  await tapMap(ana, -80, -80);
  await tapMap(ana, 80, -80);
  await tapMap(ana, 80, 80);
  await tapMap(ana, -80, 80);
  await ana.getByRole('button', { name: 'Terminar' }).click();
  await ana.getByRole('radio', { name: 'Zona de peligro' }).check();
  await ana.getByRole('button', { name: 'Guardar' }).click();

  // Berta is warned on her own device, and the group hears nothing.
  const warning = berta.getByRole('region', { name: 'Has entrado en una zona de peligro' });
  await expect(warning).toBeVisible({ timeout: 15_000 });
  await standStill(berta);
  await berta.waitForTimeout(2000);
  await openMore(ana, 'Diario de la operación');
  const diary = ana.getByRole('region', { name: 'Diario de la operación' });
  await expect(diary).toContainText('Añade');
  await expect(diary).not.toContainText('Entra en la zona de peligro');
});

test('an SOS is told to someone without Tesel, and its caller can call 112', async ({
  browser,
}) => {
  const { ana, berta } = await twoMembers(browser, VIEW);
  await ana.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await berta.getByRole('button', { name: 'SOS', exact: true }).click();
  const dialog = berta.getByRole('dialog', { name: 'Enviar un SOS' });
  await dialog.getByRole('radio', { name: 'Médica' }).check();
  await dialog.getByLabel('Detalles (opcional)').fill('Tobillo roto');
  await dialog.getByRole('button', { name: 'Enviar SOS' }).click();

  // Her own call: 112 at hand, whose call sends her position, and her location to send.
  const own = berta.getByRole('region', { name: 'SOS' });
  await expect(own.getByRole('link', { name: 'Llamar al 112' })).toHaveAttribute('href', 'tel:112');
  await expect(own.getByRole('button', { name: 'Enviar mi ubicación' })).toBeVisible();

  // Someone else's: theirs to send. A computer has no share menu, so it is copied.
  const call = ana.getByRole('region', { name: 'SOS' });
  await expect(call.getByRole('link', { name: 'Llamar al 112' })).toHaveCount(0);
  await call.getByRole('button', { name: 'Enviar su ubicación' }).click();
  await expect(ana.getByText('Ubicación copiada')).toBeVisible();
  const sos = await ana.evaluate(() => navigator.clipboard.readText());
  expect(sos).toMatch(/^SOS de Berta \(Médica\) «Tobillo roto» · /);
  expect(sos).toContain('39.46990, -0.37630');
  expect(sos).toContain('maps.google.com');
});
