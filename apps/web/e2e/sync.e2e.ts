// Day 3: two devices in a group see each other's messages and positions through the server.

import { device, expect, shareAs, test, twoMembers } from './helpers.ts';
import { SERVER_URL } from './ports.ts';

test('new groups propose the build’s own server', async ({ browser }) => {
  // The first launch leaves the groups panel open on the ways into a group.
  const ana = await device(browser, 'Ana');
  await ana
    .getByRole('region', { name: 'Grupos' })
    .getByRole('button', { name: 'Crear grupo' })
    .click();
  await expect(ana.getByLabel('Servidor')).toHaveValue(`${SERVER_URL}/`);
});

test('members of a group chat and see who shares their position', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);

  // Chat both ways, with aliases learnt from each member's announcement.
  await ana.getByRole('button', { name: 'Chat' }).click();
  await ana.getByLabel('Mensaje').fill('¿Me recibís?');
  await ana.getByRole('button', { name: 'Enviar', exact: true }).click();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
  await expect(berta.getByRole('listitem').filter({ hasText: '¿Me recibís?' })).toContainText(
    'Ana',
  );
  await berta.getByLabel('Mensaje').fill('Alto y claro');
  await berta.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(ana.getByText('Alto y claro')).toBeVisible();

  // Berta shares her position; Ana's member list shows it, then shows when she hides it.
  await berta.getByRole('button', { name: 'Cerrar' }).click();
  await shareAs(berta, 'Compartir');
  await expect(berta.getByRole('button', { name: 'Yo: Compartiendo posición' })).toBeVisible();
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await ana.getByRole('button', { name: /^Grupo:/ }).click();
  // The member list says it with a sign, named for screen readers.
  const bertaRow = ana.getByRole('listitem').filter({ hasText: /^B\s*Berta/ });
  await expect(bertaRow.getByRole('img', { name: 'comparte posición', exact: true })).toBeVisible();
  await shareAs(berta, 'Ocultar');
  await expect(
    bertaRow.getByRole('img', { name: 'no comparte posición', exact: true }),
  ).toBeVisible();

  // A device that reloads gets the history from its own log and the server.
  await berta.reload();
  await berta.getByRole('button', { name: 'Chat' }).click();
  await expect(berta.getByText('¿Me recibís?')).toBeVisible();
});

test('sharing resumes by itself after the app restarts', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);
  await shareAs(berta, 'Compartir');
  await expect(berta.getByRole('button', { name: 'Yo: Compartiendo posición' })).toBeVisible();
  await berta.reload();
  await expect(berta.getByRole('button', { name: 'Yo: Compartiendo posición' })).toBeVisible();
  await ana.getByRole('button', { name: /^Grupo:/ }).click();
  await expect(
    ana
      .getByRole('listitem')
      .filter({ hasText: /^B\s*Berta/ })
      .getByRole('img', { name: 'comparte posición', exact: true }),
  ).toBeVisible();
});

test('the chat leaves a reader where they are, and steps aside for an SOS', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser);
  await ana.getByRole('button', { name: 'Chat' }).click();
  const say = async (text: string) => {
    await ana.getByLabel('Mensaje').fill(text);
    await ana.getByRole('button', { name: 'Enviar', exact: true }).click();
  };
  for (let line = 1; line <= 20; line++) await say(`Línea ${String(line)}`);

  await berta.getByRole('button', { name: 'Chat' }).click();
  const chat = berta.getByRole('region', { name: 'Chat' });
  const lines = chat.getByRole('listitem');
  await expect(lines.filter({ hasText: 'Línea 20' })).toBeInViewport();
  const list = chat.locator('ol.messages');
  const scrollTop = () => list.evaluate((element) => element.scrollTop);

  // Berta reads the first lines: what arrives meanwhile does not take her to the end.
  await list.evaluate((element) => {
    element.scrollTop = 0;
  });
  await say('Línea 21');
  await expect(lines.filter({ hasText: 'Línea 21' })).toHaveCount(1);
  expect(await scrollTop()).toBe(0);

  // At the end, she stays there as lines arrive; another tab and back opens at the end.
  await list.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await say('Línea 22');
  await expect(lines.filter({ hasText: 'Línea 22' })).toBeInViewport();
  await chat.getByRole('tab', { name: 'Partes' }).click();
  await chat.getByRole('tab', { name: 'Grupo' }).click();
  await expect(lines.filter({ hasText: 'Línea 22' })).toBeInViewport();

  // An SOS closes the chat, which would cover it.
  await ana.getByRole('button', { name: 'Cerrar' }).click();
  await ana.getByRole('button', { name: 'SOS', exact: true }).click();
  await ana
    .getByRole('dialog', { name: 'Enviar un SOS' })
    .getByRole('button', { name: 'Enviar SOS' })
    .click();
  await expect(berta.getByRole('region', { name: 'SOS' })).toBeVisible();
  await expect(chat).toBeHidden();
});
