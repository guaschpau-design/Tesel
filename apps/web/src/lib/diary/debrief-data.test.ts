import { stateOf } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { diaryLines } from './diary.ts';
import { gatherDebrief } from './debrief-data.ts';
import { debriefPdf } from './debrief-pdf.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
/** 2026-11-06 at 09:40 UTC, in seconds. */
const T0 = Date.UTC(2026, 10, 6, 9, 40) / 1000;
const HOUR = 3600;
const key = new Uint8Array(32);
const t = translator('es');

const join = (origin: NodeId, alias: string, time: number): TeselEvent => ({
  type: 'member-info',
  origin,
  seq: 1,
  time,
  role: origin === ANA ? 'coordinator' : 'member',
  publicKey: key,
  alias,
});
const at = (seq: number, time: number, lat: number): TeselEvent => ({
  type: 'position',
  origin: BERTA,
  seq,
  time,
  lat,
  lon: -0.3,
  accuracy: 5,
  heading: null,
  speed: null,
});
const task = { origin: ANA, seq: 2 };
const base = {
  type: 'task',
  task,
  assignee: BERTA,
  place: null,
  text: 'Revisar el puente',
} as const;
const sos = { origin: BERTA, seq: 20 };

const EVENTS: TeselEvent[] = [
  join(ANA, 'Ana', T0 - 2 * HOUR),
  join(BERTA, 'Berta', T0),
  at(2, T0 + 60, 39.4),
  at(3, T0 + 600, 39.41),
  { ...base, origin: ANA, seq: 2, time: T0 + 120, status: 'open' },
  { ...base, origin: BERTA, seq: 4, time: T0 + 900, status: 'in-progress' },
  { ...base, origin: BERTA, seq: 5, time: T0 + 1500, status: 'done' },
  {
    type: 'sos',
    ...sos,
    time: T0 + 1800,
    kind: 'medical',
    lat: 39.41,
    lon: -0.3,
    accuracy: 8,
    text: 'Tobillo',
  },
  { type: 'ack', origin: ANA, seq: 6, time: T0 + 1840, target: sos },
  { type: 'sos-cancel', origin: ANA, seq: 7, time: T0 + 2400, sos },
  { type: 'chat', origin: ANA, seq: 8, time: T0 + 2500, text: 'Volvemos' },
];

function debriefOf(events: readonly TeselEvent[], from: number, until: number) {
  const state = stateOf([...events]);
  return gatherDebrief(state, diaryLines(state, t), { from: from * 1000, until: until * 1000 });
}

describe('the debrief of an operation', () => {
  it('tells who took part, their team and how far they went', () => {
    const debrief = debriefOf(EVENTS, T0, T0 + HOUR);
    expect(debrief.people.map((person) => person.name)).toEqual(['Ana', 'Berta']);
    const berta = debrief.people.find((person) => person.name === 'Berta');
    expect(berta?.track).toHaveLength(2);
    expect(berta?.distance).toBeCloseTo(1112, -1);
    expect(debrief.people.find((person) => person.name === 'Ana')?.coordinator).toBe(true);
    expect(debrief.messages).toBe(1);
  });

  it('tells each call for help, who received it how soon and who closed it', () => {
    const [call] = debriefOf(EVENTS, T0, T0 + HOUR).calls;
    expect(call).toMatchObject({
      name: 'Berta',
      kind: 'medical',
      text: 'Tobillo',
      received: [{ name: 'Ana', after: 40 }],
      cancelled: { name: 'Ana', time: (T0 + 2400) * 1000 },
    });
    // Before it was closed, it was still open.
    expect(debriefOf(EVENTS, T0, T0 + 2000).calls.at(0)?.cancelled).toBeNull();
  });

  it('tells each task where it stood at the end, and when it was done', () => {
    expect(debriefOf(EVENTS, T0, T0 + HOUR).tasks).toEqual([
      {
        text: 'Revisar el puente',
        assignee: 'Berta',
        status: 'done',
        added: (T0 + 120) * 1000,
        done: (T0 + 1500) * 1000,
      },
    ]);
    expect(debriefOf(EVENTS, T0, T0 + 1000).tasks.at(0)?.status).toBe('in-progress');
  });

  it('leaves out what happened outside the period', () => {
    const debrief = debriefOf(EVENTS, T0 - 2 * HOUR, T0 - HOUR);
    expect(debrief.people.map((person) => person.name)).toEqual(['Ana']);
    expect(debrief.calls).toEqual([]);
    expect(debrief.tasks).toEqual([]);
  });

  it('is laid out as a PDF with its cover, its map, its sections and its timeline', () => {
    const debrief = debriefOf(EVENTS, T0, T0 + HOUR);
    const pdf = debriefPdf({
      group: 'Rescate (Turia)',
      debrief,
      format: 'decimal',
      locale: 'es',
      t,
      now: (T0 + 2 * HOUR) * 1000,
    });
    expect(pdf.startsWith('%PDF-1.4\n')).toBe(true);
    expect(pdf).toContain('(INFORME DE LA OPERACI\\323N)');
    expect(pdf).toContain('(Rescate \\(Turia\\))');
    expect(pdf).toContain('(Mapa de la operaci\\363n)');
    expect(pdf).toContain('(SOS \\267 Berta)');
    expect(pdf).toContain('(Recibida por Ana \\(40 s\\) \\267 cerrada por Ana a las');
    expect(pdf).toContain('(Revisar el puente)');
    expect(pdf).toContain('(\\253Volvemos\\273)');
    expect(pdf).toMatch(/\(P\\341gina 1 de \d\)/);
  });
});
