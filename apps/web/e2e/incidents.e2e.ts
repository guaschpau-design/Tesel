// Day 4: map objects, SOS calls and alerts reach the whole group.

import { expect, tapMap, tapMapUntil, test, twoMembers } from './helpers.ts';

const VIEW = '/#map=15/39.4699/-0.3763';

test('a marker drawn by one member can be opened and deleted by another', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Marcador' }).click();
  await expect(ana.getByText(/Toca el mapa donde va/)).toBeVisible();
  await tapMap(ana);
  await ana.getByRole('radio', { name: 'Fuego' }).check();
  await ana.getByLabel('Etiqueta (opcional)').fill('Foco norte');
  await ana.getByRole('button', { name: 'Guardar' }).click();

  // Berta taps the same spot until the marker has arrived and been drawn.
  const details = berta.getByRole('region', { name: 'Foco norte' });
  await tapMapUntil(berta, {}, () => expect(details).toBeVisible({ timeout: 2000 }));
  await expect(details).toContainText('Último cambio de Ana');

  // Berta corrects its label: changing and deleting wait in the "⋯" menu.
  await details.getByRole('button', { name: 'Más acciones' }).click();
  await berta.getByRole('menuitem', { name: 'Editar' }).click();
  const change = berta.getByRole('dialog', { name: 'Editar Foco norte' });
  await expect(change.getByRole('radio', { name: 'Fuego' })).toBeChecked();
  await change.getByLabel('Etiqueta (opcional)').fill('Foco sur');
  await change.getByRole('button', { name: 'Guardar' }).click();
  const renamed = berta.getByRole('region', { name: 'Foco sur' });
  await expect(renamed).toBeVisible();

  await renamed.getByRole('button', { name: 'Más acciones' }).click();
  await berta.getByRole('menuitem', { name: 'Borrar' }).click();
  await berta
    .getByRole('dialog', { name: /Borrar «Foco sur»/ })
    .getByRole('button', { name: 'Borrar' })
    .click();
  await expect(renamed).toBeHidden();
  // Ana taps the same spot until the deletion has arrived and the marker opens no more.
  await tapMapUntil(ana, {}, () =>
    expect(ana.getByRole('region', { name: 'Foco sur' })).toBeHidden({ timeout: 2000 }),
  );
});

test('an SOS is acknowledged by the group and cancelled by its sender', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  // Berta is in the chat when she calls for help: sending it, the chat makes way for her call.
  await berta.getByRole('button', { name: /^Chat/ }).click();
  await berta.getByRole('button', { name: 'SOS', exact: true }).click();
  const dialog = berta.getByRole('dialog', { name: 'Enviar un SOS' });
  await dialog.getByLabel('Qué pasa').selectOption({ label: 'Médica' });
  await dialog.getByLabel('Detalles (opcional)').fill('Tobillo roto');
  await expect(dialog.getByText(/Se envía tu posición/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Enviar SOS' }).click();
  await expect(berta.getByRole('region', { name: 'Chat' })).toBeHidden();
  await expect(berta.getByRole('region', { name: 'SOS' })).toContainText('Nadie lo ha confirmado');

  const call = ana.getByRole('region', { name: 'SOS' });
  await expect(call).toContainText('SOS · Berta · Médica');
  await expect(call).toContainText('Tobillo roto');
  // How far it is and which way, and the way there in one tap.
  await expect(call).toContainText('desde ti');
  await call.getByRole('button', { name: 'Recibido' }).click();
  await expect(berta.getByRole('region', { name: 'SOS' })).toContainText('Recibido por Ana');
  await call.getByRole('button', { name: 'Guíame' }).click();
  await expect(ana.getByText('Hacia Berta')).toBeVisible();

  await berta.getByRole('button', { name: 'Cancelar SOS' }).click();
  const confirm = berta.getByRole('dialog', { name: '¿Cancelar este SOS para todo el grupo?' });
  await confirm.getByRole('button', { name: 'Cancelar SOS' }).click();
  await expect(call).toBeHidden();
});

test('an SOS sent with no link is kept, says it waits, and reaches the group once a link is back', async ({
  browser,
}) => {
  const { ana, berta } = await twoMembers(browser, VIEW);
  // Berta loses every server; the app is reopened, as after a while in a valley.
  let cut = true;
  await berta.routeWebSocket(/\/v1\/ws$/, (socket) => {
    if (cut) void socket.close();
    else socket.connectToServer();
  });
  await berta.reload();
  await expect(berta.getByTitle('Conectado al servidor del grupo')).toBeHidden();

  await berta.getByRole('button', { name: 'SOS', exact: true }).click();
  const dialog = berta.getByRole('dialog', { name: 'Enviar un SOS' });
  await dialog.getByRole('button', { name: 'Enviar SOS' }).click();
  await expect(berta.getByText(/el SOS está guardado y saldrá/)).toBeVisible();
  const own = berta.getByRole('region', { name: 'SOS' });
  await expect(own).toContainText('Aún no ha salido de este dispositivo');

  cut = false;
  await berta.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(ana.getByRole('region', { name: 'SOS' })).toContainText('SOS · Berta', {
    timeout: 15_000,
  });
  await expect(own).not.toContainText('Aún no ha salido de este dispositivo');
});

test('an area is drawn point by point and described before it is shared', async ({ browser }) => {
  const { ana } = await twoMembers(browser, VIEW);

  await ana.getByRole('button', { name: 'Añadir' }).click();
  await ana.getByRole('menuitem', { name: 'Zona' }).click();
  await expect(ana.getByRole('button', { name: 'Terminar' })).toBeDisabled();
  await tapMap(ana, -80, -80);
  await tapMap(ana, 80, -80);
  await tapMap(ana, 80, 80);
  await tapMap(ana, -80, 80);
  await ana.getByRole('button', { name: 'Deshacer' }).click();
  await ana.getByRole('button', { name: 'Terminar' }).click();
  const form = ana.getByRole('dialog', { name: 'Nueva zona' });
  await form.getByRole('radio', { name: 'Zona de peligro' }).check();
  await form.getByRole('button', { name: 'Guardar' }).click();
  await expect(form).toBeHidden();

  // The triangle left after undoing covers the point to the right of the centre.
  const details = ana.getByRole('region', { name: 'Zona de peligro', exact: true });
  await tapMapUntil(ana, { dx: 40, dy: -20 }, () => expect(details).toBeVisible({ timeout: 2000 }));
});

test('members inside a danger area are warned', async ({ browser }) => {
  const { ana, berta } = await twoMembers(browser, VIEW);

  // A square around the centre of the view, which is where both devices are.
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
  await warning.getByRole('button', { name: 'Entendido' }).click();
  await expect(warning).toBeHidden();
});
