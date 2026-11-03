// Cutting text between the characters people see, so an emoji or an accented letter is never
// split in two; and showing text of others without the characters that are not seen (ADR-0110).

import { utf8ByteLength } from '@tesel/protocol';

const segmenter = new Intl.Segmenter();

function characters(text: string): string[] {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}

/** The text cut to at most `length` characters, with an ellipsis when it was longer. */
export function shorten(text: string, length: number): string {
  const all = characters(text);
  return all.length <= length ? text : `${all.slice(0, length - 1).join('')}…`;
}

/** The text cut to at most `maxBytes` bytes of UTF-8, for a field of the protocol. */
export function fitBytes(text: string, maxBytes: number): string {
  let fitted = '';
  for (const character of characters(text)) {
    if (utf8ByteLength(fitted + character) > maxBytes) break;
    fitted += character;
  }
  return fitted;
}

/** The first character of a name, in capitals, for a round avatar. */
export function initialOf(name: string): string {
  return characters(name.trim())[0]?.toUpperCase() ?? '?';
}

/**
 * Characters that are not seen but change what is: Unicode's format characters (category Cf), such
 * as a zero-width space or a right-to-left override, which turns the words around it backwards.
 * The zero-width joiner and non-joiner are left out: emoji such as the firefighter and several
 * scripts need them, and they reorder nothing.
 */
const HIDDEN = /(?![\u200C\u200D])\p{Cf}/u;
const EVERY_HIDDEN = new RegExp(HIDDEN, 'gu');

/** Whether a text holds a character that is not seen (HIDDEN): a name typed so is refused. */
export function hasHiddenCharacters(text: string): boolean {
  return HIDDEN.test(text);
}

/** A text from other members or other radio apps as it is shown: without hidden characters. */
export function shownText(text: string): string {
  return text.replace(EVERY_HIDDEN, '');
}
