// The safety check-in: turned on by whoever coordinates, it asks a member who has been still for
// a while whether they are well, and calls for help if no one answers.

import { expect, test, twoMembers } from './helpers.ts';

test('a member still for too long is asked, and an SOS goes out unanswered', async ({
  browser,
}) => {
  const { ana, berta } = await twoMembers(browser);
  // Berta's clock is the test's, from here on, to let half an hour go by at once.
  await berta.clock.install();

  await ana.getByRole('button', { name: /^Grupo:/ }).click();
  await ana.getByText('Equipos y seguridad', { exact: true }).click();
  const check = ana.getByRole('switch', { name: 'Aviso «¿Sigues bien?»' });
  await check.click();
  await expect(check).toHaveAttribute('aria-checked', 'true');

  // Half an hour without a tap, once the setting has reached her: Berta is asked, and answers.
  const card = berta.getByRole('region', { name: '¿Sigues bien?' });
  await expect(async () => {
    await berta.clock.fastForward('31:00');
    await expect(card).toBeVisible({ timeout: 1000 });
  }).toPass();
  await card.getByRole('button', { name: 'Estoy bien' }).click();
  await expect(card).toBeHidden();

  // Asked again, she does not answer: help is called for.
  await berta.clock.fastForward('31:00');
  await expect(card).toContainText('Llevas un rato sin moverte');
  await berta.clock.fastForward('02:05');
  await expect(card).toContainText('se ha enviado un SOS');
});
