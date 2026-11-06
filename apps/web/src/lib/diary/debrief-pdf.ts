// The debrief of an operation laid out as a PDF on A4 (ADR-0118). The first page is the summary:
// a graphite band with the mark, the group and the period, the key figures, the map of the
// operation with its legend and the bars of activity. Then the calls for help, the tasks, the
// people, the field reports and the timeline of the diary.

import type { CoordinateFormat } from '../coordinates/coordinates.ts';
import { formatDateTime, formatDistance } from '../format.ts';
import type { Locale, Translate } from '../i18n/index.ts';
import { PAGE_WIDTH, type Rgb } from '../pdf/pdf-document.ts';
import { textWidth, wrap } from '../pdf/pdf-text.ts';
import { drawMark } from '../pdf/tesel-mark.ts';
import type { Debrief } from './debrief-data.ts';
import { drawActivity, drawMap, wayColor } from './debrief-map.ts';
import {
  drawCalls,
  drawPeople,
  drawReports,
  drawTasks,
  drawTimeline,
  formatSpan,
  type DebriefContext,
} from './debrief-sections.ts';
import { INK, LEFT, LIME, MUTED, PALE, RED, RIGHT, Sheet, TINT, WIDTH } from './debrief-sheet.ts';

export interface DebriefInput {
  readonly group: string;
  readonly debrief: Debrief;
  readonly format: CoordinateFormat;
  readonly locale: Locale;
  readonly t: Translate;
  /** When it is made, in milliseconds. */
  readonly now: number;
}

const BAND = 156;
const WHITE: Rgb = [1, 1, 1];

export function debriefPdf(input: DebriefInput): string {
  const { debrief, t, locale } = input;
  const { from, until } = debrief.period;
  const sheet = new Sheet();
  const oneDay = new Date(from).toDateString() === new Date(until).toDateString();
  const clock = (time: number): string =>
    oneDay
      ? new Date(time).toLocaleTimeString(locale, { timeStyle: 'short' })
      : formatDateTime(time, locale);
  const context: DebriefContext = { sheet, debrief, t, locale, format: input.format, clock };

  drawBand(sheet, input);
  sheet.y = BAND + 22;
  drawFigures(sheet, input);

  sheet.heading(t('debriefMap'), 300);
  if (drawMap(sheet, debrief, t, locale)) drawLegend(sheet, input);
  else {
    sheet.paragraph(LEFT, t('debriefNoMap'), WIDTH, { size: 9, color: MUTED });
    sheet.y += 18;
  }
  sheet.heading(t('debriefActivity'), 100);
  drawActivity(sheet, debrief, t, locale);

  drawCalls(context);
  drawTasks(context);
  drawPeople(context);
  drawReports(context);
  drawTimeline(context);

  const title = `${t('debriefTitle')} · ${input.group}`;
  sheet.finish(title, (page, pages) => t('debriefPage', { page, pages }));
  return sheet.doc.file({ title, made: input.now });
}

/** The graphite band across the top of the first page. */
function drawBand(sheet: Sheet, { group, debrief, t, locale, now }: DebriefInput): void {
  const doc = sheet.doc;
  doc.rect(0, 0, PAGE_WIDTH, BAND, { fill: INK });
  doc.rect(0, BAND, PAGE_WIDTH, 4, { fill: LIME });
  drawMark(doc, LEFT, 30, 30, PALE);
  doc.text(LEFT + 38, 50, 'TESEL', { size: 11, bold: true, color: WHITE, spacing: 2.2 });
  doc.text(RIGHT, 44, t('debriefTitle').toUpperCase(), {
    size: 8,
    bold: true,
    color: LIME,
    spacing: 1.2,
    align: 'end',
  });
  doc.text(RIGHT, 56, t('debriefMade', { time: formatDateTime(now, locale) }), {
    size: 7,
    color: PALE,
    align: 'end',
  });

  let size = 24;
  while (size > 15 && textWidth(group, size, true) > WIDTH) size -= 1;
  const name = wrap(group, WIDTH, size, true).slice(0, 2);
  name.forEach((line, index) => {
    doc.text(LEFT, 104 + index * (size + 2) - (name.length - 1) * (size + 2), line, {
      size,
      bold: true,
      color: WHITE,
    });
  });
  const { from, until } = debrief.period;
  const day = (time: number) =>
    new Date(time).toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const hour = (time: number) => new Date(time).toLocaleTimeString(locale, { timeStyle: 'short' });
  const sameDay = new Date(from).toDateString() === new Date(until).toDateString();
  const when = sameDay
    ? `${day(from)} · ${hour(from)} – ${hour(until)}`
    : `${day(from)} ${hour(from)} – ${day(until)} ${hour(until)}`;
  doc.text(LEFT, 128, capitalised(when), { size: 10, color: PALE });
  doc.text(LEFT, 142, t('debriefDuration', { span: formatSpan((until - from + 1) / 1000) }), {
    size: 8.5,
    color: LIME,
  });
}

/** The key figures in a row of tiles. */
function drawFigures(sheet: Sheet, { debrief, t, locale }: DebriefInput): void {
  const done = debrief.tasks.filter((task) => task.status === 'done').length;
  const way = debrief.people.reduce((sum, person) => sum + person.distance, 0);
  const figures: { value: string; label: string; color?: Rgb }[] = [
    { value: String(debrief.people.length), label: t('debriefFigurePeople') },
    {
      value: String(debrief.calls.length),
      label: t('debriefFigureCalls'),
      color: debrief.calls.length > 0 ? RED : INK,
    },
    { value: `${String(done)}/${String(debrief.tasks.length)}`, label: t('debriefFigureTasks') },
    { value: String(debrief.reports.length), label: t('debriefFigureReports') },
    { value: String(debrief.messages), label: t('debriefFigureMessages') },
    { value: formatDistance(way, locale), label: t('debriefFigureWay') },
  ];
  const gap = 8;
  const width = (WIDTH - gap * (figures.length - 1)) / figures.length;
  figures.forEach((figure, index) => {
    const x = LEFT + index * (width + gap);
    sheet.doc.rect(x, sheet.y, width, 56, { fill: TINT }, 5);
    let size = 19;
    while (size > 10 && textWidth(figure.value, size, true) > width - 14) size -= 1;
    sheet.doc.text(x + 9, sheet.y + 27, figure.value, {
      size,
      bold: true,
      color: figure.color ?? INK,
    });
    wrap(figure.label.toUpperCase(), width - 14, 6.5, true)
      .slice(0, 2)
      .forEach((line, number) => {
        sheet.doc.text(x + 9, sheet.y + 40 + number * 8, line, {
          size: 6.5,
          bold: true,
          color: MUTED,
          spacing: 0.3,
        });
      });
  });
  sheet.y += 72;
}

/** Who is who on the map: each colour, its person and how far they went. */
function drawLegend(sheet: Sheet, { debrief, locale }: DebriefInput): void {
  const walkers = debrief.people
    .map((person, index) => ({ person, index }))
    .filter(({ person }) => person.track.length > 0);
  const columns = 3;
  const width = WIDTH / columns;
  walkers.forEach(({ person, index }, position) => {
    const x = LEFT + (position % columns) * width;
    const y = sheet.y + Math.floor(position / columns) * 14;
    sheet.doc.line(
      [
        [x, y - 3],
        [x + 14, y - 3],
      ],
      { stroke: wayColor(index), width: 2.4 },
    );
    const name = wrap(person.name, width - 80, 8, true)[0] ?? '';
    sheet.doc.text(x + 20, y, name, { size: 8, bold: true, color: INK });
    sheet.doc.text(x + 22 + textWidth(name, 8, true), y, formatDistance(person.distance, locale), {
      size: 8,
      color: MUTED,
    });
  });
  sheet.y += Math.ceil(walkers.length / columns) * 14 + 10;
}

function capitalised(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}
