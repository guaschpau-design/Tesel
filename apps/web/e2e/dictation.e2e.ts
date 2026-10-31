// Dictating a chat message: the browser's speech recognition is stood in for by one that hears a
// sentence; the text lands in the box, and is sent like a typed one.

import { createGroup, device, expect, test } from './helpers.ts';

/** A recognizer that hears one sentence a moment after it starts, then stops when told. */
function fakeRecognition(): void {
  class FakeRecognition {
    lang = '';
    continuous = false;
    interimResults = false;
    onresult: ((event: { results: unknown }) => void) | null = null;
    onerror: ((event: { error: string }) => void) | null = null;
    onend: (() => void) | null = null;
    start(): void {
      setTimeout(() => {
        this.onresult?.({ results: [[{ transcript: `Necesitamos agua (${this.lang})` }]] });
      }, 100);
    }
    stop(): void {
      this.onend?.();
    }
    abort(): void {
      this.onend?.();
    }
  }
  Object.assign(window, { SpeechRecognition: FakeRecognition });
}

test('a dictated message is written in the box and sent', async ({ browser }) => {
  const page = await device(browser, 'Ana');
  await page.addInitScript(fakeRecognition);
  await page.reload();
  await createGroup(page, 'Rescate');
  await page.getByRole('button', { name: 'Cerrar' }).click();
  await page.getByRole('button', { name: 'Chat' }).click();

  const chat = page.getByRole('region', { name: 'Chat' });
  await chat.getByRole('button', { name: 'Dictar', exact: true }).click();
  await expect(chat.getByLabel('Mensaje')).toHaveValue('Necesitamos agua (es-ES)');
  await chat.getByRole('button', { name: 'Dejar de dictar' }).click();
  await chat.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(chat.getByText('Necesitamos agua (es-ES)')).toBeVisible();
  await expect(chat.getByLabel('Mensaje')).toHaveValue('');
});
