import { stateOf } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import type { DiaryLine } from './diary.ts';
import {
  fieldValue,
  lastActivity,
  linesIn,
  periodOf,
  QUIET_HOURS,
  debriefSummary,
} from './debrief.ts';
import { debriefPdf } from './debrief-pdf.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
/** 2026-11-06 at 09:40:20 UTC, in seconds. */
const T0 = Date.UTC(2026, 10, 6, 9, 40, 20) / 1000;
const HOUR = 3600;
const key = new Uint8Array(32);

function line(time: number, text = 'Algo pasa'): DiaryLine {
  return { key: String(time), time, author: 'Ana', text, at: null };
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

describe('the summary of a debrief', () => {
  const join = (origin: NodeId, alias: string, time: number): TeselEvent => ({
    type: 'member-info',
    origin,
    seq: 1,
    time,
    role: origin === ANA ? 'coordinator' : 'member',
    publicKey: key,
    alias,
  });
  const task = { origin: ANA, seq: 2 };
  const base = { type: 'task', task, assignee: null, place: null, text: 'Agua' } as const;
  const events: TeselEvent[] = [
    join(ANA, 'Ana', T0 - 2 * HOUR),
    join(BERTA, 'Berta', T0),
    { ...base, origin: ANA, seq: 2, time: T0 + 10, status: 'open' },
    { ...base, origin: BERTA, seq: 2, time: T0 + 20, status: 'done' },
    { ...base, origin: BERTA, seq: 3, time: T0 + 30, status: 'done' },
    {
      type: 'sos',
      origin: BERTA,
      seq: 4,
      time: T0 + 40,
      kind: 'medical',
      lat: 39.41,
      lon: -0.31,
      accuracy: 8,
      text: '',
    },
  ];

  it('counts who took part, the calls for help and the tasks done, in the period only', () => {
    const summary = debriefSummary(stateOf(events), {
      from: (T0 + 5) * 1000,
      until: (T0 + HOUR) * 1000,
    });
    expect(summary).toEqual({ people: ['Ana', 'Berta'], sos: 1, tasksDone: 1, reports: 0 });
    expect(debriefSummary(stateOf(events), { from: 0, until: (T0 - HOUR) * 1000 })).toEqual({
      people: ['Ana'],
      sos: 0,
      tasksDone: 0,
      reports: 0,
    });
  });

  it('is laid out as a PDF with its title, its summary and the lines of the period', () => {
    const t = translator('es');
    const lines = [
      line(T0, 'Pide ayuda (SOS): Médica. «Tobillo»'),
      { ...line(T0 + 60, 'Añade un punto'), at: { lat: 39.4699, lon: -0.3763 } },
    ];
    const period = { from: T0 * 1000, until: (T0 + HOUR) * 1000 };
    const pdf = debriefPdf({
      group: 'Rescate (Turia)',
      period,
      summary: debriefSummary(stateOf(events), period),
      lines,
      format: 'decimal',
      locale: 'es',
      t,
      now: (T0 + 2 * HOUR) * 1000,
    });
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf).toContain('(Informe de la operaci\\363n)');
    expect(pdf).toContain('(Rescate \\(Turia\\))');
    expect(pdf).toContain('(Llamadas de socorro)');
    expect(pdf).toContain('(Pide ayuda \\(SOS\\): M\\351dica. \\253Tobillo\\273)');
    expect(pdf).toContain('(P\\341gina 1 de 1)');
  });
});
