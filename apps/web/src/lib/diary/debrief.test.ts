import { describe, expect, it } from 'vitest';

import type { DiaryLine } from './diary.ts';
import { fieldValue, lastActivity, linesIn, periodOf, QUIET_HOURS } from './debrief.ts';

/** 2026-11-06 at 09:40:20 UTC, in seconds. */
const T0 = Date.UTC(2026, 10, 6, 9, 40, 20) / 1000;
const HOUR = 3600;

function line(time: number, text = 'Algo pasa'): DiaryLine {
  return { key: String(time), type: 'chat', time, author: 'Ana', text, at: null };
}

describe('the period of a debrief', () => {
  it('starts as the last spell of activity, from its first line to the end of its last minute', () => {
    const lines = [
      line(T0 - (QUIET_HOURS + 1) * HOUR),
      line(T0),
      line(T0 + 2 * HOUR),
      line(T0 + 5 * HOUR + 59),
    ];
    expect(lastActivity(lines)).toEqual({
      from: Date.UTC(2026, 10, 6, 9, 40),
      until: Date.UTC(2026, 10, 6, 14, 42) - 1,
    });
  });

  it('takes in the whole diary when it never went quiet, and nothing when it is empty', () => {
    const lines = [line(T0), line(T0 + 3 * HOUR), line(T0 + 6 * HOUR - 60)];
    expect(lastActivity(lines)?.from).toBe(Date.UTC(2026, 10, 6, 9, 40));
    expect(lastActivity([])).toBeNull();
  });

  it('is read from the two fields as they show it, the end taking in its minute', () => {
    const period = lastActivity([line(T0), line(T0 + HOUR)]);
    expect(period).not.toBeNull();
    if (period === null) return;
    expect(periodOf(fieldValue(period.from), fieldValue(period.until))).toEqual(period);
    expect(fieldValue(period.from)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('is none when a field is empty or the end comes before the start', () => {
    expect(periodOf('', '2026-11-06T10:00')).toBeNull();
    expect(periodOf('2026-11-06T10:00', '2026-11-06T09:59')).toBeNull();
    expect(periodOf('2026-11-06T10:00', '2026-11-06T10:00')).not.toBeNull();
  });

  it('holds the lines between its two times, both included', () => {
    const lines = [line(T0 - 60), line(T0), line(T0 + 60), line(T0 + 61)];
    const period = { from: T0 * 1000, until: (T0 + 60) * 1000 };
    expect(linesIn(lines, period).map((each) => each.time)).toEqual([T0, T0 + 60]);
  });
});
