// Panels and menus from the keyboard: the focus goes into what opens, Escape closes it and the focus
// goes back to what opened it. And in a phone held sideways, menus and panels rise over the cards
// at the top of the map.

import type { Locator } from '@playwright/test';

import { createGroup, device, expect, test } from './helpers.ts';

test('panels and menus take the focus, close with Escape and give it back', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  const more = page.getByRole('button', { name: 'Más', exact: true });

  // The menu follows its button, as screen readers read the page.
  await more.click();
  const menu = page.getByRole('menu', { name: 'Más', exact: true });
  const follows = await menu.evaluate((element) => {
    const button = document.querySelector('button[aria-expanded="true"]');
    const position = button?.compareDocumentPosition(element) ?? 0;
    return (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  });
  expect(follows).toBe(true);
  await expect(page.getByRole('menuitem', { name: 'Medir distancias' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(more).toBeFocused();

  // An item that opens a panel: the panel has the focus, and Escape gives it back to the menu's
  // button.
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Ir a una coordenada' })).toBeFocused();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('region', { name: 'Ir a una coordenada' });
  await expect(panel).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(more).toBeFocused();

  // A panel opened from the dock, closed with its button.
  const me = page.getByRole('button', { name: /^Yo/ });
  await me.click();
  const mePanel = page.getByRole('region', { name: 'Yo' });
  await expect(mePanel).toBeFocused();
  await mePanel.getByRole('button', { name: 'Cerrar' }).click();
  await expect(mePanel).toBeHidden();
  await expect(me).toBeFocused();
});

/** Whether `over` is what shows at the middle of where it and `under` overlap. */
async function coversAtOverlap(over: Locator, under: Locator): Promise<boolean> {
  const a = await over.boundingBox();
  const b = await under.boundingBox();
  if (!a || !b) throw new Error('not on screen');
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (left >= right || top >= bottom) throw new Error('they do not overlap');
  return over.evaluate(
    (element, [x = 0, y = 0]) => {
      const shown = document.elementFromPoint(x, y);
      return shown !== null && element.contains(shown);
    },
    [(left + right) / 2, (top + bottom) / 2],
  );
}

test('in a phone held sideways, menus and panels rise over the cards', async ({ browser }) => {
  const page = await device(browser, 'Ana', '/', { viewport: { width: 740, height: 360 } });
  await createGroup(page, 'Rescate');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  const card = page.getByRole('region', { name: 'No compartes tu posición' });
  await expect(card).toBeVisible();

  await page.getByRole('button', { name: 'Más', exact: true }).click();
  const menu = page.getByRole('menu', { name: 'Más', exact: true });
  expect(await coversAtOverlap(menu, card)).toBe(true);
  // Below the top bar, whole.
  const bar = await page.locator('header').boundingBox();
  const box = await menu.boundingBox();
  expect(box && bar && box.y >= bar.y + bar.height).toBe(true);
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Yo/ }).click();
  expect(await coversAtOverlap(page.getByRole('region', { name: 'Yo' }), card)).toBe(true);
});
