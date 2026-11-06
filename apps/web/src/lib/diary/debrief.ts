// The period of a debrief, the report of an operation once it is over (ADR-0118): two times that
// whoever coordinates chooses. They start as the group's last spell of activity, so that most
// often the debrief is one tap away. A debrief is not a field report (a "parte", reports/),
// which it counts.

import type { DiaryLine } from './diary.ts';

/** Two times in milliseconds; a line belongs to the period when it falls between them. */
export interface Period {
  readonly from: number;
  readonly until: number;
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
