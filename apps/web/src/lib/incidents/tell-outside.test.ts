import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { mapLink, outsideText, smsLink, whatsAppLink } from './tell-outside.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };
const t = translator('es');
const time = new Date(2026, 10, 8, 14, 32).getTime();

describe('telling outside the group', () => {
  it('says whose call, when, where in degrees and UTM, and links a map', () => {
    const text = outsideText(
      { kind: 'sos', name: 'Ana', what: 'Médica', text: 'Tobillo' },
      { at: VALENCIA, accuracy: 8, time },
      t,
      'es',
    );
    const lines = text.split('\n');
    expect(lines[0]).toMatch(/^SOS de Ana \(Médica\) «Tobillo» · .*14:32$/);
    expect(lines[1]).toBe('39.46990, -0.37630 (±8 m)');
    expect(lines[2]).toBe('UTM 30S 725695E 4372210N');
    expect(lines[3]).toBe('https://maps.google.com/?q=39.46990,-0.37630');
  });

  it('says whose position it is, without an accuracy it does not know', () => {
    const text = outsideText(
      { kind: 'position', name: 'Berta' },
      { at: VALENCIA, accuracy: null, time },
      t,
      'es',
    );
    expect(text.split('\n')[0]).toMatch(/^Posición de Berta · .*14:32$/);
    expect(text.split('\n')[1]).toBe('39.46990, -0.37630');
  });

  it('opens messages and WhatsApp with the text written', () => {
    expect(mapLink(VALENCIA)).toBe('https://maps.google.com/?q=39.46990,-0.37630');
    expect(smsLink('Hola, aquí\n1')).toBe('sms:?&body=Hola%2C%20aqu%C3%AD%0A1');
    expect(whatsAppLink('Hola & adiós')).toBe('https://wa.me/?text=Hola%20%26%20adi%C3%B3s');
  });
});
