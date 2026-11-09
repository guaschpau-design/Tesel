import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { mapLink, outsideText } from './tell-outside.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };
const t = translator('es');
const time = new Date(2026, 10, 8, 14, 32).getTime();
const call = { name: 'Ana', what: 'Médica', text: 'Tobillo', time };

describe('telling an SOS outside the group', () => {
  it('says whose call, when, where in degrees and UTM, and links a map', () => {
    const lines = outsideText(call, { at: VALENCIA, accuracy: 8 }, t, 'es').split('\n');
    expect(lines[0]).toMatch(/^SOS de Ana \(Médica\) «Tobillo» · .*14:32$/);
    expect(lines[1]).toBe('39.46990, -0.37630 (±8 m)');
    expect(lines[2]).toBe('UTM 30S 725695E 4372210N');
    expect(lines[3]).toBe('https://maps.google.com/?q=39.46990,-0.37630');
  });

  it('says so when the place is not known yet, or how sure it is', () => {
    expect(outsideText(call, null, t, 'es').split('\n')[1]).toBe('Posición aún no disponible');
    const unsure = outsideText(call, { at: VALENCIA, accuracy: null }, t, 'es');
    expect(unsure.split('\n')[1]).toBe('39.46990, -0.37630');
  });

  it('links a map any phone opens', () => {
    expect(mapLink(VALENCIA)).toBe('https://maps.google.com/?q=39.46990,-0.37630');
  });
});
