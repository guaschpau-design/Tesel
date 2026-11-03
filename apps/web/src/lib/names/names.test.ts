import { describe, expect, it } from 'vitest';

import { nameFault, nameKey, numberedNames } from './names.ts';

describe('names that look the same', () => {
  it.each([
    ['a zero-width space', 'Ma\u200Brta'],
    ['a word joiner and a byte order mark', '\uFEFFMar\u2060ta'],
    ['a right-to-left override', 'Marta\u202E'],
    ['a variation selector', 'Marta\uFE0F'],
    ['full-width letters', '\uFF2D\uFF41\uFF52\uFF54\uFF41'],
    ['a Cyrillic capital M and a', '\u041C\u0430rta'],
    ['a Greek capital M and a Cyrillic a', '\u039C\u0430rta'],
  ])('takes a name with %s for the same name', (_, name) => {
    expect(nameKey(name)).toBe('marta');
  });

  it('takes any run of spaces, of any width, for one', () => {
    expect(nameKey(' Marta  Ruiz ')).toBe('marta ruiz');
    expect(nameKey('Marta\u00A0Ruiz')).toBe('marta ruiz');
  });

  it('takes an accent typed apart for the accented letter', () => {
    expect(nameKey('Marti\u0301n')).toBe(nameKey('Mart\u00EDn'));
    expect(nameKey('Mart\u00EDn')).not.toBe(nameKey('Martin'));
  });

  it('lowercases the same way whatever the language of the browser', () => {
    // A Turkish browser would lowercase I as a dotless i with toLocaleLowerCase.
    expect(nameKey('IRENE')).toBe('irene');
  });

  it('folds look-alike letters in their own case: Greek small nu is a v, its capital an N', () => {
    expect(nameKey('I\u03BDan')).toBe('ivan');
    expect(nameKey('\u039Duria')).toBe('nuria');
  });

  it('keeps apart names that only look alike in some fonts', () => {
    expect(nameKey('Ila')).not.toBe(nameKey('Lia'));
    expect(nameKey('Ana')).not.toBe(nameKey('Anna'));
  });
});

describe('numbered names', () => {
  it('numbers each name after the first of the same, and shows none of the hidden characters', () => {
    const names = numberedNames([
      { key: 1, name: 'Marta' },
      { key: 2, name: 'Luis' },
      { key: 3, name: '\u041Carta\u202E' },
      { key: 4, name: 'marta ' },
    ]);
    expect([...names.values()]).toEqual(['Marta', 'Luis', '\u041Carta \u2461', 'marta \u2462']);
  });
});

describe('typed names', () => {
  it('accepts a name that fits its field, an emoji joined by a joiner too', () => {
    expect(nameFault('Pau \u{1F9D1}\u200D\u{1F692}', 1, 32)).toBeNull();
  });

  it('says why a name is refused', () => {
    expect(nameFault('', 1, 32)).toBe('size');
    expect(nameFault('x'.repeat(33), 1, 32)).toBe('size');
    expect(nameFault('Pau \uD83D', 1, 32)).toBe('broken');
    expect(nameFault('Pau\u202E', 1, 32)).toBe('hidden');
    expect(nameFault('Pa\u200Bu', 1, 32)).toBe('hidden');
  });
});
