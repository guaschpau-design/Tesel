// The debrief of an operation laid out as a PDF on A4 (ADR-0118): a title, the group and the
// period, a summary, then the diary's lines of the period with their times, authors and places,
// and on every page a footer with its number.

import { formatCoordinate, type CoordinateFormat } from '../coordinates/coordinates.ts';
import { formatDateTime } from '../format.ts';
import type { Locale, Translate } from '../i18n/index.ts';
import {
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PdfDocument,
  type Rgb,
  type TextStyle,
} from '../pdf/pdf-document.ts';
import { textWidth, wrap } from '../pdf/pdf-text.ts';
import type { DiaryLine } from './diary.ts';
import type { Period, DebriefSummary } from './debrief.ts';

export interface DebriefInput {
  readonly group: string;
  readonly period: Period;
  readonly summary: DebriefSummary;
  /** The diary's lines of the period, oldest first. */
  readonly lines: readonly DiaryLine[];
  readonly format: CoordinateFormat;
  readonly locale: Locale;
  readonly t: Translate;
  /** When it is made, in milliseconds. */
  readonly now: number;
}

/** Tesel's graphite, its muted grey and the lime of the node (ADR-0113). */
const INK: Rgb = [0.094, 0.098, 0.106];
const MUTED: Rgb = [0.36, 0.38, 0.4];
const LIME: Rgb = [0.6, 0.788, 0.22];
const LINE: Rgb = [0.84, 0.85, 0.84];

const LEFT = 56;
const RIGHT = PAGE_WIDTH - 56;
const TOP = 64;
/** Where the text of a page ends, above its footer. */
const BOTTOM = PAGE_HEIGHT - 72;
/** Where a value of the summary, and the text of a diary line, start. */
const VALUE = LEFT + 128;
const TIME = LEFT;

const BODY: TextStyle = { size: 10, color: INK };
const BODY_BOLD: TextStyle = { size: 10, bold: true, color: INK };
const SMALL: TextStyle = { size: 9, color: MUTED };
const LEADING = 14;

export function debriefPdf(input: DebriefInput): string {
  const { t, locale, period, summary, lines } = input;
  const doc = new PdfDocument();
  doc.addPage();
  let y = TOP;

  /** Room for `height` more points on this page, or a new page. */
  const room = (height: number): void => {
    if (y + height <= BOTTOM) return;
    doc.addPage();
    y = TOP;
  };

  doc.text(LEFT, y, 'TESEL', { size: 9, bold: true, color: INK });
  doc.rule(LEFT, LEFT + 34, y + 7, LIME, 3);
  y += 40;
  doc.text(LEFT, y, t('debriefTitle'), { size: 20, bold: true, color: INK });
  y += 22;
  for (const part of wrap(input.group, RIGHT - LEFT, 13)) {
    doc.text(LEFT, y, part, { size: 13, color: INK });
    y += 17;
  }
  const from = formatDateTime(period.from, locale);
  const until = formatDateTime(period.until, locale);
  doc.text(LEFT, y, t('debriefPeriod', { from, until }), SMALL);
  y += 13;
  doc.text(LEFT, y, t('debriefMade', { time: formatDateTime(input.now, locale) }), SMALL);
  y += 30;

  const rows: [string, string][] = [
    [
      t('debriefPeople'),
      summary.people.length === 0
        ? '0'
        : `${String(summary.people.length)}: ${summary.people.join(', ')}`,
    ],
    [t('debriefEntriesLabel'), String(lines.length)],
    [t('debriefSos'), String(summary.sos)],
    [t('debriefTasksDone'), String(summary.tasksDone)],
    [t('debriefReports'), String(summary.reports)],
  ];
  for (const [label, value] of rows) {
    const parts = wrap(value, RIGHT - VALUE, BODY.size);
    room(parts.length * LEADING);
    doc.text(LEFT, y, label, { ...BODY, color: MUTED });
    for (const part of parts) {
      doc.text(VALUE, y, part, BODY);
      y += LEADING;
    }
  }
  y += 18;

  room(40);
  doc.text(LEFT, y, t('debriefTimeline'), { size: 13, bold: true, color: INK });
  y += 8;
  doc.rule(LEFT, RIGHT, y, LINE, 0.75);
  y += 20;

  const oneDay = new Date(period.from).toDateString() === new Date(period.until).toDateString();
  const when = (time: number): string =>
    oneDay
      ? new Date(time).toLocaleTimeString(locale, { timeStyle: 'short' })
      : formatDateTime(time, locale);
  for (const line of lines) {
    const text = wrap(line.text, RIGHT - VALUE, BODY.size);
    const place = line.at && formatCoordinate(line.at, input.format);
    room((text.length + (place ? 2 : 1)) * LEADING);
    doc.text(TIME, y, when(line.time * 1000), { ...SMALL, color: MUTED });
    doc.text(VALUE, y, line.author, BODY_BOLD);
    y += LEADING;
    for (const part of text) {
      doc.text(VALUE, y, part, BODY);
      y += LEADING;
    }
    if (place) {
      doc.text(VALUE, y, place, SMALL);
      y += LEADING;
    }
    y += 6;
  }

  const pages = doc.pageCount;
  for (let page = 0; page < pages; page++) {
    doc.turnTo(page);
    const footer = `Tesel · ${input.group}`;
    doc.text(LEFT, PAGE_HEIGHT - 40, wrap(footer, 360, 8)[0] ?? '', { size: 8, color: MUTED });
    const number = t('debriefPage', { page: page + 1, pages });
    doc.text(RIGHT - textWidth(number, 8), PAGE_HEIGHT - 40, number, { size: 8, color: MUTED });
  }
  return doc.file({ title: `${t('debriefTitle')} · ${input.group}`, made: input.now });
}
