// The sections of a debrief after its first page (ADR-0118): each call for help as a card, the
// tasks, the people and the field reports as tables, and the whole diary of the period as a
// timeline whose dots say what kind of thing each line is.

import type { JournalEvent } from '@tesel/core';
import type { TaskStatus } from '@tesel/protocol';

import { formatCoordinate, type CoordinateFormat } from '../coordinates/coordinates.ts';
import { formatDistance } from '../format.ts';
import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
import { SOS_KINDS } from '../incidents/sos-kinds.ts';
import { DUTY_STATUSES } from '../members/member-catalog.ts';
import type { Rgb, TextStyle } from '../pdf/pdf-document.ts';
import { wrap } from '../pdf/pdf-text.ts';
import { reportLine } from '../reports/report-summary.ts';
import type { Debrief } from './debrief-data.ts';
import { wayColor } from './debrief-map.ts';
import {
  BODY,
  INK,
  LEFT,
  LIME_DEEP,
  MUTED,
  RED,
  RED_TINT,
  RIGHT,
  RULE,
  Sheet,
  SMALL,
  TINT,
  WIDTH,
} from './debrief-sheet.ts';

export interface DebriefContext {
  readonly sheet: Sheet;
  readonly debrief: Debrief;
  readonly t: Translate;
  readonly locale: Locale;
  readonly format: CoordinateFormat;
  /** A time of the period as its lines show it: the hour, and the day too if it spans days. */
  readonly clock: (time: number) => string;
}

const BLUE: Rgb = [0.13, 0.42, 0.75];
const AMBER: Rgb = [0.8, 0.5, 0.05];
const GREY: Rgb = [0.6, 0.62, 0.64];

const TASK_STATUSES: Readonly<Record<TaskStatus, { label: MessageKey; color: Rgb }>> = {
  open: { label: 'taskOpen', color: MUTED },
  'in-progress': { label: 'taskInProgress', color: BLUE },
  done: { label: 'taskDone', color: LIME_DEEP },
  cancelled: { label: 'debriefTaskCancelled', color: GREY },
};

/** A seconds count in words: "40 s", "3 min", "1 h 5 min". */
export function formatSpan(seconds: number): string {
  if (seconds < 60) return `${String(Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;
  const rest = minutes % 60;
  return `${String(Math.floor(minutes / 60))} h${rest > 0 ? ` ${String(rest)} min` : ''}`;
}

export function drawCalls(context: DebriefContext): void {
  const { sheet, debrief, t, format, clock } = context;
  sheet.heading(t('debriefCalls'));
  if (debrief.calls.length === 0) {
    sheet.paragraph(LEFT, t('debriefNoCalls'), WIDTH, { ...BODY, color: MUTED });
    sheet.y += 18;
    return;
  }
  for (const call of debrief.calls) {
    const inner = WIDTH - 28;
    const note = call.text === '' ? [] : wrap(`«${call.text}»`, inner, 9);
    const received =
      call.received.length === 0
        ? t('debriefNobodyReceived')
        : t('debriefReceivedBy', {
            list: call.received
              .map((each) => `${each.name} (${formatSpan(each.after)})`)
              .join(', '),
          });
    const end = call.cancelled
      ? t('debriefCallClosed', { name: call.cancelled.name, time: clock(call.cancelled.time) })
      : t('debriefCallOpen');
    const facts = wrap(`${received} · ${end}`, inner, 8);
    const height = 40 + (note.length + facts.length) * 11;
    sheet.room(height + 8);
    const top = sheet.y;
    sheet.doc.rect(LEFT, top, WIDTH, height, { fill: RED_TINT }, 4);
    sheet.doc.rect(LEFT, top, 4, height, { fill: RED });
    const first = call.received.at(0);
    sheet.doc.text(LEFT + 16, top + 17, `${call.name} · ${t(SOS_KINDS[call.kind].label)}`, {
      size: 10.5,
      bold: true,
      color: RED,
    });
    sheet.doc.text(RIGHT - 12, top + 17, clock(call.time), {
      size: 10.5,
      bold: true,
      color: INK,
      align: 'end',
    });
    let y = top + 31;
    for (const line of note) {
      sheet.doc.text(LEFT + 16, y, line, { size: 9, color: INK });
      y += 11;
    }
    for (const line of facts) {
      sheet.doc.text(LEFT + 16, y, line, { size: 8, color: INK });
      y += 11;
    }
    const where = formatCoordinate(call.at, format) ?? '';
    const response = first ? t('debriefFirstResponse', { span: formatSpan(first.after) }) : '';
    sheet.doc.text(LEFT + 16, y + 1, [where, response].filter(Boolean).join(' · '), SMALL);
    sheet.y = top + height + 8;
  }
  sheet.y += 6;
}

interface Column {
  readonly title: string;
  readonly width: number;
}

interface Cell {
  readonly text: string;
  readonly style?: TextStyle;
  /** A dot of colour before the text. */
  readonly dot?: Rgb | undefined;
}

/** A table that turns the page between rows, with its header again on the new page. */
function table(sheet: Sheet, columns: readonly Column[], rows: readonly (readonly Cell[])[]): void {
  const header = (): void => {
    sheet.doc.rect(LEFT, sheet.y, WIDTH, 17, { fill: TINT });
    let x = LEFT + 6;
    for (const column of columns) {
      sheet.doc.text(x, sheet.y + 11.5, column.title.toUpperCase(), {
        size: 6.8,
        bold: true,
        color: MUTED,
        spacing: 0.4,
      });
      x += column.width;
    }
    sheet.y += 17;
  };
  sheet.room(17 + 24);
  header();
  for (const row of rows) {
    const lines = row.map((cell, index) => {
      const style = cell.style ?? BODY;
      const room = (columns.at(index)?.width ?? 60) - 12 - (cell.dot ? 9 : 0);
      return wrap(cell.text, room, style.size, style.bold);
    });
    const height = Math.max(...lines.map((each) => each.length)) * 11 + 9;
    const page = sheet.doc.pageCount;
    sheet.room(height);
    if (sheet.doc.pageCount !== page) header();
    let x = LEFT + 6;
    row.forEach((cell, index) => {
      const style = cell.style ?? BODY;
      let textX = x;
      if (cell.dot) {
        sheet.doc.circle(x + 3, sheet.y + 10.5, 3, { fill: cell.dot });
        textX += 9;
      }
      (lines.at(index) ?? []).forEach((line, number) => {
        sheet.doc.text(textX, sheet.y + 13.5 + number * 11, line, style);
      });
      x += columns.at(index)?.width ?? 0;
    });
    sheet.y += height;
    sheet.doc.line(
      [
        [LEFT, sheet.y],
        [RIGHT, sheet.y],
      ],
      { stroke: RULE, width: 0.5 },
    );
  }
  sheet.y += 14;
}

export function drawTasks({ sheet, debrief, t, clock }: DebriefContext): void {
  sheet.heading(t('debriefTasks'));
  if (debrief.tasks.length === 0) {
    sheet.paragraph(LEFT, t('debriefNoTasks'), WIDTH, { ...BODY, color: MUTED });
    sheet.y += 18;
    return;
  }
  table(
    sheet,
    [
      { title: t('debriefTask'), width: 215 },
      { title: t('taskAssignee'), width: 92 },
      { title: t('taskStatus'), width: 78 },
      { title: t('debriefTaskTimes'), width: WIDTH - 385 },
    ],
    debrief.tasks.map((task) => {
      const status = TASK_STATUSES[task.status];
      return [
        { text: task.text },
        { text: task.assignee ?? t('anyoneOption') },
        {
          text: t(status.label),
          dot: status.color,
          style: { ...BODY, bold: true, color: status.color },
        },
        {
          text:
            task.done === null
              ? clock(task.added)
              : `${clock(task.added)} – ${clock(task.done)} (${formatSpan((task.done - task.added) / 1000)})`,
          style: { size: 8.5, color: INK },
        },
      ];
    }),
  );
}

export function drawPeople({ sheet, debrief, t, locale }: DebriefContext): void {
  sheet.heading(t('debriefPeople'));
  table(
    sheet,
    [
      { title: t('debriefPerson'), width: 150 },
      { title: t('debriefTeam'), width: 120 },
      { title: t('debriefWay'), width: 90 },
      { title: t('debriefStatusAtEnd'), width: WIDTH - 360 },
    ],
    debrief.people.map((person, index) => [
      {
        text: person.coordinator ? `${person.name} · ${t('debriefCoordinator')}` : person.name,
        dot: person.track.length > 0 ? wayColor(index) : undefined,
        style: { ...BODY, bold: true },
      },
      { text: person.team ?? '—' },
      { text: person.track.length > 1 ? formatDistance(person.distance, locale) : '—' },
      { text: person.status === null ? '—' : t(DUTY_STATUSES[person.status].label) },
    ]),
  );
}

export function drawReports({ sheet, debrief, t, clock }: DebriefContext): void {
  if (debrief.reports.length === 0) return;
  sheet.heading(t('debriefReports'));
  table(
    sheet,
    [
      { title: t('debriefTime'), width: 64 },
      { title: t('debriefPerson'), width: 92 },
      { title: t('debriefReport'), width: WIDTH - 156 },
    ],
    debrief.reports.map((report) => [
      { text: clock(report.time), style: { size: 8.5, color: MUTED } },
      { text: report.name, style: { ...BODY, bold: true } },
      { text: reportLine(report.event, t), dot: AMBER },
    ]),
  );
}

/** The colour of a diary line's dot, by what kind of thing it tells. */
function kindColor(type: JournalEvent['type']): Rgb {
  if (type === 'sos' || type === 'sos-cancel' || type === 'ack') return RED;
  if (type === 'task') return BLUE;
  if (type === 'report' || type === 'zone-crossing') return AMBER;
  if (type === 'chat') return INK;
  if (type === 'marker' || type === 'shape' || type === 'sweep' || type === 'object-delete') {
    return LIME_DEEP;
  }
  return GREY;
}

export function drawTimeline({ sheet, debrief, t, format, clock }: DebriefContext): void {
  sheet.heading(t('debriefTimeline'));
  const textX = LEFT + 70;
  const width = RIGHT - textX;
  for (const line of debrief.lines) {
    const text = wrap(line.text, width, 9);
    const where = line.at && formatCoordinate(line.at, format);
    const height = 12 + text.length * 11 + (where ? 10 : 0) + 6;
    sheet.room(height);
    const y = sheet.y + 10;
    sheet.doc.text(LEFT, y, clock(line.time * 1000), { size: 8, color: MUTED });
    sheet.doc.circle(LEFT + 58, y - 3, 3, { fill: kindColor(line.type) });
    sheet.doc.text(textX, y, line.author, { size: 8.5, bold: true, color: INK });
    text.forEach((part, index) => {
      sheet.doc.text(textX, y + 11 + index * 11, part, BODY);
    });
    if (where) sheet.doc.text(textX, y + 11 + text.length * 11 - 1, where, SMALL);
    sheet.y += height;
  }
}
