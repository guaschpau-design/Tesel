import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { runningNotice } from './keep-running.svelte.ts';

describe('keeping the Android app running', () => {
  const t = translator('es');

  it('is for the location or a radio, and says which', () => {
    expect(runningNotice({ located: false, linked: false }, t)).toBeNull();
    expect(runningNotice({ located: true, linked: false }, t)).toEqual({
      title: 'Tesel sigue activo',
      text: 'Usando tu ubicación',
    });
    expect(runningNotice({ located: true, linked: true }, t)?.text).toBe(
      'Usando tu ubicación · Conectado al nodo',
    );
  });
});
