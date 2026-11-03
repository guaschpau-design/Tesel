import { describe, expect, it } from 'vitest';

import { hasHiddenCharacters, initialOf, shorten, shownText } from './text.ts';

describe('text', () => {
  it('shortens long texts with an ellipsis and leaves short ones alone', () => {
    expect(shorten('Revisar el almacén', 30)).toBe('Revisar el almacén');
    expect(shorten('Revisar el almacén', 8)).toBe('Revisar…');
  });

  it('never splits a character in two', () => {
    expect(shorten('👩‍🚒👩‍🚒👩‍🚒', 2)).toBe('👩‍🚒…');
    expect(initialOf('👩‍🚒 Ana')).toBe('👩‍🚒');
  });

  it('takes the first letter of a name, in capitals', () => {
    expect(initialOf(' ángela')).toBe('Á');
    expect(initialOf('')).toBe('?');
  });

  it('shows a text without the characters that turn it around or hide in it', () => {
    // "Marta" followed by a right-to-left override would show the words after it backwards.
    expect(shownText('Marta\u202E atnem\u202C ok')).toBe('Marta atnem ok');
    expect(shownText('Ma\u200Brta\u2066\uFEFF')).toBe('Marta');
    expect(hasHiddenCharacters('Ma\u200Brta')).toBe(true);
  });

  it('keeps the joiners that emoji and scripts need', () => {
    expect(shownText('🧑‍🚒 Ana')).toBe('🧑‍🚒 Ana');
    expect(hasHiddenCharacters('🧑‍🚒 Ana')).toBe(false);
    expect(hasHiddenCharacters('می\u200Cخواهم')).toBe(false);
  });
});
