// Day 2: a coordinator creates a group and a second device joins it with the invitation.

import type { Page } from '@playwright/test';

import { chooseAlias, createGroup, device, expect, shareAs, test, VALENCIA } from './helpers.ts';
import { SERVER_URL } from './ports.ts';

async function invitationLink(page: Page, role: 'miembro' | 'coordinador'): Promise<string> {
  await page.getByRole('button', { name: 'Invitar' }).click();
  // A member by default; a coordinator is the seldom choice below.
  if (role === 'coordinador') {
    await page.getByRole('switch', { name: /^Que entre como coordinador/ }).click();
  }
  await expect(page.getByRole('img', { name: 'Código QR de la invitación' })).toBeVisible();
  const link = await page.getByLabel('Enlace de invitación').inputValue();
  await page.getByRole('button', { name: 'Listo' }).click();
  return link;
}

test('a second device joins a group through its invitation link', async ({ browser }) => {
  const coordinator = await (await browser.newContext()).newPage();
  await coordinator.goto('/');
  await chooseAlias(coordinator, 'Ana');
  await createGroup(coordinator, 'Rescate Valencia');
  await expect(coordinator.getByRole('button', { name: 'Grupo: Rescate Valencia' })).toBeVisible();
  const memberLink = await invitationLink(coordinator, 'miembro');
  expect(new URL(memberLink).pathname).toBe('/join');

  const member = await (
    await browser.newContext({ permissions: ['geolocation'], geolocation: VALENCIA })
  ).newPage();
  await member.goto(memberLink);
  await expect(
    member.getByText('Te han invitado a «Rescate Valencia» como miembro.'),
  ).toBeVisible();
  // The secret must not stay in the address bar or the history.
  expect(member.url()).not.toContain('join');
  // Naming oneself joins, in one step, and shares the position there, as the welcome says.
  const welcome = member.getByRole('dialog', { name: 'Te damos la bienvenida a Tesel' });
  await expect(welcome).toContainText('En el grupo compartirás tu posición');
  await welcome.getByLabel('Tu nombre en el grupo').fill('Berta');
  await welcome.getByRole('button', { name: 'Entrar en «Rescate Valencia»' }).click();
  await expect(member.getByText('Te has unido a «Rescate Valencia».')).toBeVisible();
  await expect(member.getByRole('region', { name: 'No compartes tu posición' })).toHaveCount(0);
  await member.getByRole('button', { name: /^Yo/ }).click();
  await expect(member.getByRole('switch', { name: 'Compartir mi posición' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await member.getByRole('button', { name: 'Cerrar' }).click();

  // Membership survives a restart, and members do not invite.
  await member.reload();
  await member.getByRole('button', { name: 'Grupo: Rescate Valencia' }).click();
  await expect(member.getByText('miembro', { exact: true })).toBeVisible();
  await expect(member.getByRole('button', { name: 'Invitar' })).toHaveCount(0);

  // A coordinator invitation, pasted, promotes the member.
  const coordinatorLink = await invitationLink(coordinator, 'coordinador');
  // With a group in use, the ways to another fold under it.
  await member.getByText('Tus otros grupos').click();
  await member.getByRole('button', { name: 'Unirme a un grupo' }).click();
  await member.getByLabel('Enlace de invitación').fill(coordinatorLink);
  await member.getByRole('button', { name: 'Unirme', exact: true }).click();
  await member
    .getByRole('dialog', { name: 'Unirse a un grupo' })
    .getByRole('button', { name: 'Unirme' })
    .click();
  await expect(member.getByText('Ahora coordinas «Rescate Valencia».')).toBeVisible();
});

test('a damaged invitation is reported, not silently ignored', async ({ page }) => {
  await page.goto('/join#AAAA');
  await chooseAlias(page, 'Carla');
  await expect(
    page.getByText('Esta invitación está dañada o incompleta.', { exact: false }),
  ).toBeVisible();
});

test('an invitation to another group of the same name is flagged, and sharing is asked for', async ({
  browser,
}) => {
  const ana = await device(browser, 'Ana');
  await createGroup(ana, 'Rescate Valencia');
  await ana.getByRole('region', { name: 'Grupos' }).getByRole('button', { name: 'Cerrar' }).click();
  await shareAs(ana, 'Compartir');

  // Someone else makes a group of a name that looks the same, and sends Ana its invitation.
  const eva = await device(browser, 'Eva');
  await createGroup(eva, 'RESCATE  valencia');
  const lure = await invitationLink(eva, 'coordinador');
  // A messenger added a query to the link, and a slash: it still opens.
  await ana.goto(lure.replace('/join#', '/join/?fbclid=IwAR0#'));

  const dialog = ana.getByRole('dialog', { name: 'Unirse a un grupo' });
  await expect(dialog).toContainText(`Su servidor: ${new URL(SERVER_URL).host}.`);
  await expect(dialog.getByRole('alert')).toContainText(
    'Este es un grupo DISTINTO con el mismo nombre',
  );
  const share = dialog.getByRole('checkbox', { name: 'Compartir mi posición en este grupo' });
  await expect(share).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Unirme' }).click();
  await expect(ana.getByText(/Tu posición queda en pausa/)).toBeVisible();

  // The two groups are told apart wherever they are named, and nothing is shared in the new one.
  await expect(ana.getByRole('button', { name: 'Grupo: RESCATE valencia ②' })).toBeVisible();
  await ana.getByRole('button', { name: /^Yo/ }).click();
  await expect(
    ana.getByRole('region', { name: 'Yo' }).getByRole('switch', { name: 'Compartir mi posición' }),
  ).toHaveAttribute('aria-checked', 'false');
});
