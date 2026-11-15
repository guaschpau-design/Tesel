import { describe, expect, it } from 'vitest';

import { fileName } from './file-name.ts';

describe('the files saved for a group', () => {
  it('names files after the group and the date', () => {
    const now = Date.UTC(2026, 9, 26, 15, 0);
    expect(fileName('Equipo Turia · Riada', now, 'pdf')).toBe(
      'tesel-equipo-turia-riada-2026-10-26.pdf',
    );
    expect(fileName('¡¡!!', now, 'tesel')).toBe('tesel-2026-10-26.tesel');
  });
});
