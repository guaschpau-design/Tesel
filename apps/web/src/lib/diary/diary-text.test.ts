import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { diaryText, fileName } from './diary-text.ts';

describe('the diary as a text file', () => {
  it('writes one line per entry, with where it happened in the chosen format', () => {
    const time = Date.UTC(2026, 9, 26, 15, 0) / 1000;
    const text = diaryText(
      [
        { key: 'a', time, author: 'Ana', text: 'Se une al grupo (coordinador).', at: null },
        {
          key: 'b',
          time,
          author: 'Berta',
          text: 'Pide ayuda (SOS): Médica.',
          at: { lat: 39.4699, lon: -0.3763 },
        },
      ],
      {
        group: 'Equipo Turia',
        format: 'mgrs',
        locale: 'es',
        t: translator('es'),
        now: time * 1000,
      },
    );
    const lines = text.split('\n');
    expect(lines[0]).toBe('Tesel · Diario de la operación');
    expect(lines[1]).toBe('Grupo: Equipo Turia');
    expect(lines[4]).toMatch(/ · Ana · Se une al grupo \(coordinador\)\.$/);
    expect(lines[5]).toMatch(/ · Berta · Pide ayuda \(SOS\): Médica\. \(30S YJ 25695 72210\)$/);
  });

  it('keeps an entry on its line whatever was written in it', () => {
    const text = diaryText(
      [
        {
          key: 'a',
          time: 0,
          author: 'Ana',
          text: 'Uno\n00:00 · Jefe · Evacuad\r\u2028fin',
          at: null,
        },
      ],
      { group: 'G\nH', format: 'decimal', locale: 'es', t: translator('es'), now: 0 },
    );
    const lines = text.split('\n');
    expect(lines).toHaveLength(6);
    expect(lines[1]).toBe('Grupo: G H');
    expect(lines[4]).toMatch(/ · Ana · Uno 00:00 · Jefe · Evacuad fin$/);
  });

  it('names files after the group and the date', () => {
    const now = Date.UTC(2026, 9, 26, 15, 0);
    expect(fileName('Equipo Turia · Riada', now, 'txt')).toBe(
      'tesel-equipo-turia-riada-2026-10-26.txt',
    );
    expect(fileName('¡¡!!', now, 'tesel')).toBe('tesel-2026-10-26.tesel');
  });
});
