// The diary as a plain text file, for the report of an operation: a header, then one line per
// entry with its time, author, what happened and where.

import { formatCoordinate, type CoordinateFormat } from '../coordinates/coordinates.ts';
import { formatDateTime } from '../format.ts';
import type { Locale, Translate } from '../i18n/index.ts';
import type { DiaryLine } from './diary.ts';

export interface DiaryTextOptions {
  readonly group: string;
  readonly format: CoordinateFormat;
  readonly locale: Locale;
  readonly t: Translate;
  /** When the file is made, in milliseconds. */
  readonly now: number;
}

/**
 * Every entry stays on its line: what members wrote may hold line breaks or other control
 * characters, which would otherwise start what reads as an entry of its own.
 */
function oneLine(text: string): string {
  return text.replace(/[\p{Cc}\u2028\u2029]+/gu, ' ');
}

export function diaryText(lines: readonly DiaryLine[], options: DiaryTextOptions): string {
  const { format, locale, t, now } = options;
  const group = oneLine(options.group);
  const header = [
    `Tesel · ${t('diary')}`,
    t('diaryFileGroup', { group }),
    t('diaryFileMade', { time: formatDateTime(now, locale) }),
    '',
  ];
  const body = lines.map((line) => {
    const where = line.at && formatCoordinate(line.at, format);
    const parts = [
      formatDateTime(line.time * 1000, locale),
      oneLine(line.author),
      oneLine(line.text),
    ];
    return parts.join(' · ') + (where ? ` (${where})` : '');
  });
  return [...header, ...body, ''].join('\n');
}

/**
 * A file name that sorts by date and says which group: "tesel-equipo-turia-2026-10-26.txt", or
 * "tesel-2026-10-26.txt" for a name with no letters or digits.
 */
export function fileName(group: string, now: number, extension: string): string {
  const slug = group
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date(now).toISOString().slice(0, 10);
  return ['tesel', slug, date].filter(Boolean).join('-') + `.${extension}`;
}
