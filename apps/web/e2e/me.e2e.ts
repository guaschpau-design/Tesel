// "Me": what a member tells the team about themselves, and how the others see it.

import {
  createGroup,
  device,
  expect,
  openMore,
  shareAs,
  tapMapUntil,
  test,
  twoMembers,
} from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

test('a member’s profile, status and equipment reach the others', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);
  await shareAs(berta, 'Compartir');

  // Berta says who she is, that she is resting and what she carries.
  await berta.getByRole('button', { name: /^Yo/ }).click();
  const me = berta.getByRole('region', { name: 'Yo' });
  await me.getByRole('radio', { name: 'En descanso' }).click();
  await expect(me.getByRole('radio', { name: 'En descanso' })).toBeChecked();
  // The profile is the tag beside her name; a tap on it opens the list.
  await expect(me.getByText('Elegir perfil')).toBeVisible();
  await me.getByLabel('Perfil').selectOption({ label: 'Protección Civil' });
  await expect(me.getByText('Protección Civil ▾')).toBeVisible();
  // Equipment is picked in a dialog that offers first what her profile usually carries.
  await expect(me.getByText('Nada marcado')).toBeVisible();
  await me.getByRole('button', { name: 'Añadir equipamiento' }).click();
  const picker = berta.getByRole('dialog', { name: 'Equipamiento' });
  await expect(picker.getByText('Habitual en Protección Civil')).toBeVisible();
  await picker.getByRole('button', { name: 'Botiquín' }).click();
  await picker.getByRole('button', { name: 'Agua' }).click();
  await expect(picker.getByRole('button', { name: 'Agua' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await picker.getByRole('button', { name: 'Listo' }).click();
  await expect(picker).toBeHidden();
  // In Me, what she carries, each with a cross to drop it.
  await expect(me.getByRole('button', { name: 'Quitar Agua' })).toBeVisible();
  await me.getByRole('button', { name: 'Cerrar' }).click();

  // Ana taps her on the map and sees it all at a glance.
  const card = ana.getByRole('region', { name: 'Berta' });
  await tapMapUntil(ana, {}, async () => {
    await expect(card).toBeVisible();
    await expect(card).toContainText('En descanso');
  });
  await expect(card).toContainText('Protección Civil');
  await expect(card).toContainText('Botiquín, Agua');
  // Her app has no LoRa radio linked: without coverage she cannot be reached, and the card says so.
  await expect(card.getByText('No conectado')).toBeVisible();
  await expect(card.getByText('Tareas: ninguna pendiente')).toBeVisible();
});

test('much equipment keeps the panel as narrow as a phone', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/', { viewport: { width: 390, height: 780 } });
  await createGroup(page, 'Rescate Valencia');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: /^Yo/ }).click();
  const me = page.getByRole('region', { name: 'Yo' });
  await me.getByRole('button', { name: 'Añadir equipamiento' }).click();
  const picker = page.getByRole('dialog', { name: 'Equipamiento' });
  const chips = picker.locator('button[aria-pressed="false"]');
  for (let left = await chips.count(); left > 0; left -= 1) await chips.first().click();
  await picker.getByRole('button', { name: 'Listo' }).click();
  const sideways = await me.evaluate((panel) => panel.scrollWidth - panel.clientWidth);
  expect(sideways).toBe(0);
  // A cross drops one.
  await me.getByRole('button', { name: 'Quitar Dron' }).click();
  await expect(me.getByRole('button', { name: 'Quitar Dron' })).toHaveCount(0);
  await expect(me.getByRole('button', { name: 'Quitar Cuerda' })).toBeVisible();
});

test('Me says whether a LoRa radio keeps this person in touch, and leads to linking one', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: /^Yo/ }).click();
  const me = page.getByRole('region', { name: 'Yo' });
  // In view at once, with the battery: no fold to open.
  await expect(me.getByText('No conectado')).toBeVisible();
  // Not something to pick by hand: the app knows whether a radio is linked.
  await expect(me.getByRole('button', { name: /LoRa/ })).toHaveCount(0);
  await me.getByRole('button', { name: 'Conectar nodo' }).click();
  await expect(page.getByRole('region', { name: 'Malla' })).toBeVisible();
});

test('a member changes their name in Me, and the group knows them by it', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);
  await ana.getByRole('button', { name: /^Yo/ }).click();
  const me = ana.getByRole('region', { name: 'Yo' });
  await expect(me.getByRole('heading', { name: 'Ana' })).toBeVisible();
  await me.getByRole('button', { name: 'Cambiar tu nombre' }).click();
  await me.getByLabel('Tu nombre en el grupo').fill('Ana G.');
  await me.getByRole('button', { name: 'Guardar' }).click();
  await expect(me.getByRole('heading', { name: 'Ana G.' })).toBeVisible();
  await expect(me.getByLabel('Tu nombre en el grupo')).toBeHidden();

  // Berta's diary says so, and the name stays after Ana opens the app again.
  await openMore(berta, 'Diario de la operación');
  await expect(berta.getByRole('region', { name: 'Diario de la operación' })).toContainText(
    'Ahora es Ana G.',
  );
  await ana.reload();
  await ana.getByRole('button', { name: /^Yo/ }).click();
  await expect(ana.getByRole('heading', { name: 'Ana G.' })).toBeVisible();
});

test('a member not on the map is told so, and shows themselves in one tap', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);
  const prompt = berta.getByRole('region', { name: 'No compartes tu posición' });
  await expect(prompt).toContainText('El grupo no te ve en el mapa.');
  // Ana's list says it in words.
  await ana.getByRole('button', { name: /^Grupo:/ }).click();
  const row = ana
    .getByRole('region', { name: 'Grupos' })
    .getByRole('listitem')
    .filter({ hasText: 'Berta' });
  await expect(row).toContainText('aún no comparte posición');

  await prompt.getByRole('button', { name: 'Compartir', exact: true }).click();
  await expect(prompt).toBeHidden();
  await expect(row).not.toContainText('aún no comparte posición');

  // Her row opens her card: how far she is and the way there come first.
  await row.click();
  const card = ana.getByRole('region', { name: 'Berta' });
  await expect(card.getByRole('button', { name: 'Guíame' })).toBeVisible();
  await expect(card).toContainText('Último contacto');
});

test('a battery the browser hides says why behind an (i)', async ({ browser }) => {
  const page = await device(browser, 'Ana', VIEW);
  // As on an iPhone: the browser has no battery to read.
  await page.context().addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, 'getBattery');
  });
  await page.reload();
  await page.getByRole('button', { name: /^Yo/ }).click();
  const me = page.getByRole('region', { name: 'Yo' });
  await expect(me.getByText('Desconocida')).toBeVisible();
  const why = me.getByText('Este navegador no deja ver la batería; en iPhone no se puede.');
  await expect(why).toBeHidden();
  await me.getByRole('button', { name: 'Por qué no se ve la batería' }).click();
  await expect(why).toBeVisible();
});
