// The debrief of an operation, its report once it is over (ADR-0118): what the diary holds between two times that whoever
// coordinates chooses, with a summary. The times start as the group's last spell of activity,
// so that most often the debrief is one tap away. Not to be confused with a field report (a
// "parte", reports/), which the debrief counts.

import type { GroupState } from '@tesel/core';
import { eventRefKey } from '@tesel/protocol';

import { aliasOf } from '../members/alias.ts';
import type { DiaryLine } from './diary.ts';

/** Two times in milliseconds; a line belongs to the period when it falls between them. */
export interface Period {
  readonly from: number;
  readonly until: number;
}

export interface DebriefSummary {
  /** Who did anything in the period, by the name the group knows them by. */
  readonly people: readonly string[];
  readonly sos: number;
  /** Different tasks marked done in the period. */
  readonly tasksDone: number;
  readonly reports: number;
}

/** Hours with nothing in the diary that end one spell of activity and start the next. */
export const QUIET_HOURS = 6;
const MINUTE_MS = 60_000;

/**
 * The group's last spell of activity: from its first diary line after the last quiet of at least
 * QUIET_HOURS to its last line, both to the minute, the end taking in its whole minute. Null
 * with nothing in the diary.
 */
export function lastActivity(lines: readonly DiaryLine[]): Period | null {
  const times = lines.map((line) => line.time * 1000).sort((a, b) => a - b);
  const last = times.at(-1);
  if (last === undefined) return null;
  let from = last;
  for (const time of [...times].reverse()) {
    if (from - time >= QUIET_HOURS * 3_600_000) break;
    from = time;
  }
  return { from: floorMinute(from), until: floorMinute(last) + MINUTE_MS - 1 };
}

export function linesIn(lines: readonly DiaryLine[], period: Period): DiaryLine[] {
  return lines.filter((line) => within(line.time, period));
}

export function debriefSummary(state: GroupState, period: Period): DebriefSummary {
  const people = new Set<string>();
  const done = new Set<string>();
  let sos = 0;
  let reports = 0;
  for (const event of state.journal) {
    if (!within(event.time, period)) continue;
    people.add(aliasOf(state, event.origin));
    if (event.type === 'sos') sos++;
    if (event.type === 'report') reports++;
    if (event.type === 'task' && event.status === 'done') done.add(eventRefKey(event.task));
  }
  return {
    people: [...people].sort((a, b) => a.localeCompare(b)),
    sos,
    tasksDone: done.size,
    reports,
  };
}

/** A time in seconds within a period in milliseconds. */
function within(seconds: number, { from, until }: Period): boolean {
  const time = seconds * 1000;
  return time >= from && time <= until;
}

function floorMinute(time: number): number {
  return Math.floor(time / MINUTE_MS) * MINUTE_MS;
}

/** A time as a date-and-time field holds it, in the device's time: "2026-11-06T09:40". */
export function fieldValue(time: number): string {
  const date = new Date(time);
  const two = (value: number) => String(value).padStart(2, '0');
  return (
    `${String(date.getFullYear())}-${two(date.getMonth() + 1)}-${two(date.getDate())}` +
    `T${two(date.getHours())}:${two(date.getMinutes())}`
  );
}

/**
 * The period two date-and-time fields say, the end taking in its whole minute; null when one is
 * empty or the end comes first.
 */
export function periodOf(from: string, until: string): Period | null {
  // A date and time with no zone is read in the device's time.
  const start = from === '' ? Number.NaN : new Date(from).getTime();
  const end = until === '' ? Number.NaN : new Date(until).getTime() + MINUTE_MS - 1;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return { from: start, until: end };
}
