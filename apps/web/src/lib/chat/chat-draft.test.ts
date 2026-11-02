import { CHAT_MAX_BYTES } from '@tesel/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatDraft } from './chat-draft.svelte.ts';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('chat draft', () => {
  it('sends the text trimmed and empties the box at once', async () => {
    const draft = new ChatDraft(null);
    draft.text = '  En el collado  ';
    const onsend = vi.fn(() => Promise.resolve());
    const sending = draft.send(onsend);
    expect(draft.text).toBe('');
    await sending;
    expect(onsend).toHaveBeenCalledWith('En el collado');
    expect(draft.text).toBe('');
  });

  it('sends nothing blank or too long', async () => {
    const draft = new ChatDraft(null);
    const onsend = vi.fn(() => Promise.resolve());
    draft.text = '   ';
    await draft.send(onsend);
    draft.text = 'a'.repeat(CHAT_MAX_BYTES + 1);
    await draft.send(onsend);
    expect(onsend).not.toHaveBeenCalled();
  });

  it('gives the text back if it could not be sent', async () => {
    const draft = new ChatDraft(null);
    draft.text = 'En el collado';
    await draft.send(() => Promise.reject(new Error('offline')));
    expect(draft.text).toBe('En el collado');
    expect(draft.submission.failed).toBe(true);
  });

  it('keeps what was written while a failed send was going', async () => {
    const draft = new ChatDraft(null);
    draft.text = 'En el collado';
    const sending = draft.send(() => Promise.reject(new Error('offline')));
    draft.text = 'Bajamos';
    await sending;
    expect(draft.text).toBe('Bajamos');
  });
});
