// The diary as the panel shows it (ADR-0134): its lines by day, newest first, each day named
// ("Hoy", "Ayer", or its date), and each line with the app's own sign for what it tells.

import type { JournalEvent } from '@tesel/core';

import type { Translate } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';
import type { DiaryLine } from './diary.ts';

export interface DiaryDay {
  /** The day, as the device's calendar has it: "2026-11-15". */
  readonly key: string;
  readonly name: string;
  /** Newest first. */
  readonly lines: readonly DiaryLine[];
}

/** The sign of each kind of line: people, the chat, the map, tasks, calls for help. */
export const LINE_SIGNS: Readonly<Record<JournalEvent['type'], GlyphName>> = {
  'member-info': 'person',
  'member-state': 'person',
  'position-hidden': 'hidden',
  'check-in-timer': 'person',
  'roll-call': 'person',
  team: 'person',
  chat: 'chat',
  report: 'pushpin',
  marker: 'pin',
  shape: 'area',
  sweep: 'sweep',
  'zone-crossing': 'area',
  'object-delete': 'trash',
  task: 'task',
  sos: 'warning',
  'sos-cancel': 'warning',
  alert: 'warning',
  ack: 'check',
};

/** A call for help: the one kind of line that stands out, in red. */
export function isCall(line: DiaryLine): boolean {
  return line.type === 'sos';
}

/** The diary's lines, oldest first as diaryLines gives them, by day with the newest first. */
export function diaryDays(
  lines: readonly DiaryLine[],
  { t, locale, now }: { t: Translate; locale: string; now: number },
): DiaryDay[] {
  const days: { key: string; time: number; lines: DiaryLine[] }[] = [];
  for (const line of [...lines].reverse()) {
    const key = dayKey(line.time * 1000);
    const last = days.at(-1);
    if (last?.key === key) last.lines.push(line);
    else days.push({ key, time: line.time * 1000, lines: [line] });
  }
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now).setDate(new Date(now).getDate() - 1));
  return days.map(({ key, time, lines: dayLines }) => ({
    key,
    name:
      key === today
        ? t('today')
        : key === yesterday
          ? t('yesterday')
          : new Date(time).toLocaleDateString(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            }),
    lines: dayLines,
  }));
}

function dayKey(time: number): string {
  const date = new Date(time);
  const two = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
