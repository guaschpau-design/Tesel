// Day 5: the radio, in the connections panel. Pairing needs a real radio, so this only checks what can be checked
// without one; the radio path itself is covered by unit tests with radios in memory.

import { device, expect, test } from './helpers.ts';

test('the connections panel offers to pair a radio, or explains why it cannot', async ({
  browser,
}) => {
  const page = await device(browser, 'Ana');
  await page.getByRole('button', { name: /^Conexiones:/ }).click();
  const panel = page.getByRole('region', { name: 'Malla' });
  const hasBluetooth = await page.evaluate(() => 'bluetooth' in navigator);
  if (hasBluetooth) {
    await expect(panel.getByRole('button', { name: 'Conectar nodo' })).toBeVisible();
  } else {
    await expect(panel).toContainText('Este navegador no puede usar nodos');
  }
});
