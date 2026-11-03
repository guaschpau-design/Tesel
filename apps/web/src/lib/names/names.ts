// Names people choose for themselves, their groups and their teams: what makes one usable when it is
// typed, and how two are told to be the same, so that names of others that look alike are told
// apart wherever they are shown, members by ADR-0096 and groups by ADR-0110.

import { isWellFormedText, utf8ByteLength } from '@tesel/protocol';

import type { MessageKey } from '../i18n/index.ts';
import { hasHiddenCharacters, shownText } from '../text.ts';
import { foldLookAlikes } from './confusables.ts';

/**
 * Why a typed name cannot be used: its size does not fit its field, it holds half of an emoji,
 * which no event could carry, or a character that is not seen (text.ts).
 */
export type NameFault = 'size' | 'broken' | 'hidden';

export const NAME_FAULT_MESSAGES: Readonly<Record<NameFault, MessageKey>> = {
  size: 'nameInvalid',
  broken: 'nameBroken',
  hidden: 'nameHidden',
};

/** What is wrong with a name, already trimmed, for a field of `minBytes` to `maxBytes`. */
export function nameFault(name: string, minBytes: number, maxBytes: number): NameFault | null {
  if (!isWellFormedText(name)) return 'broken';
  if (hasHiddenCharacters(name)) return 'hidden';
  const size = utf8ByteLength(name);
  return size >= minBytes && size <= maxBytes ? null : 'size';
}

/** Characters no one sees: format characters, variation selectors, fillers. */
const IGNORABLE = /[\p{Default_Ignorable_Code_Point}\p{Cf}]/gu;

/**
 * What two names that look the same have in common, the same on every device: their compatibility
 * form (NFKC: a full-width m is m, an accent typed apart joins its letter), without the characters no one sees,
 * the look-alike letters of other scripts in their Latin form, in lower case whatever the language
 * of the browser, and with any run of spaces as one.
 */
export function nameKey(name: string): string {
  const visible = name.normalize('NFKC').replace(IGNORABLE, '');
  // Apart, an accent is not taken for a letter: Cyrillic yo is the letter e and its two dots.
  return foldLookAlikes(visible.normalize('NFD'))
    .toLowerCase()
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim();
}

/** Circled numbers for the second to the twentieth of a name; then "(21)" and on. */
const CIRCLED = '②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳';

/**
 * How each of a list of names is shown, by its key: without hidden characters and, when a name
 * before it in the list is the same (nameKey), with a circled number after it, "Marta ②". The
 * order of the list decides who keeps the name as it is.
 */
export function numberedNames<K>(
  named: readonly { readonly key: K; readonly name: string }[],
): Map<K, string> {
  const seen = new Map<string, number>();
  const result = new Map<K, string>();
  for (const { key, name } of named) {
    const shown = shownText(name);
    const same = nameKey(shown);
    const position = (seen.get(same) ?? 0) + 1;
    seen.set(same, position);
    result.set(key, position === 1 ? shown : `${shown.trim()} ${ordinal(position)}`);
  }
  return result;
}

function ordinal(position: number): string {
  return CIRCLED[position - 2] ?? `(${String(position)})`;
}
