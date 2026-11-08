import { stateOf } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { translator } from '../i18n/index.ts';
import { diaryLines } from './diary.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const key = new Uint8Array(32);
const object = { origin: ANA, seq: 3 };

const EVENTS: TeselEvent[] = [
  {
    type: 'member-info',
    origin: ANA,
    seq: 1,
    time: T0,
    role: 'coordinator',
    publicKey: key,
    alias: 'Ana',
  },
  {
    type: 'member-info',
    origin: BERTA,
    seq: 1,
    time: T0 + 5,
    role: 'member',
    publicKey: key,
    alias: 'Berta',
  },
  {
    type: 'position',
    origin: BERTA,
    seq: 2,
    time: T0 + 6,
    lat: 39.4,
    lon: -0.3,
    accuracy: 5,
    heading: null,
    speed: null,
  },
  {
    type: 'marker',
    origin: ANA,
    seq: 3,
    time: T0 + 10,
    object,
    symbol: 0x0003,
    lat: 39.47,
    lon: -0.37,
    label: 'Almacén',
  },
  {
    type: 'marker',
    origin: ANA,
    seq: 4,
    time: T0 + 20,
    object,
    symbol: 0x0003,
    lat: 39.47,
    lon: -0.37,
    label: 'Almacén norte',
  },
  {
    type: 'sos',
    origin: BERTA,
    seq: 3,
    time: T0 + 30,
    kind: 'medical',
    lat: 39.41,
    lon: -0.31,
    accuracy: 8,
    text: 'Tobillo',
  },
  { type: 'ack', origin: ANA, seq: 5, time: T0 + 40, target: { origin: BERTA, seq: 3 } },
  { type: 'object-delete', origin: BERTA, seq: 4, time: T0 + 50, object },
  { type: 'chat', origin: ANA, seq: 6, time: T0 + 60, text: 'Vamos' },
];

describe('the operation diary', () => {
  it('tells what happened, in order, leaving out routine positions', () => {
    const lines = diaryLines(stateOf([...EVENTS].reverse()), translator('es'));
    expect(lines.map((line) => `${line.author}: ${line.text}`)).toEqual([
      'Ana: Se une al grupo (coordinador).',
      'Berta: Se une al grupo (miembro).',
      expect.stringMatching(/^Ana: Añade .+ «Almacén»\.$/),
      expect.stringMatching(/^Ana: Cambia .+ «Almacén norte»\.$/),
      'Berta: Pide ayuda (SOS): Médica. «Tobillo»',
      'Ana: Ha recibido el SOS de Berta.',
      expect.stringMatching(/^Berta: Borra .+ «Almacén norte»\.$/),
      'Ana: «Vamos»',
    ]);
  });

  it('tells how each task moved along', () => {
    const task = { origin: BERTA, seq: 10 };
    const base = { type: 'task', task, assignee: null, place: null, text: 'Agua' } as const;
    const tasks: TeselEvent[] = [
      { ...base, origin: BERTA, seq: 10, time: T0 + 70, status: 'open' },
      { ...base, origin: BERTA, seq: 11, time: T0 + 71, status: 'open', assignee: ANA },
      { ...base, origin: ANA, seq: 7, time: T0 + 72, status: 'in-progress', assignee: ANA },
      { ...base, origin: ANA, seq: 8, time: T0 + 73, status: 'done', assignee: ANA },
      {
        ...base,
        origin: ANA,
        seq: 9,
        time: T0 + 74,
        status: 'done',
        assignee: ANA,
        text: 'Agua: 20 l',
      },
    ];
    const lines = diaryLines(stateOf([...EVENTS, ...tasks]), translator('es'));
    expect(lines.slice(-5).map((line) => `${line.author}: ${line.text}`)).toEqual([
      'Berta: Añade la tarea «Agua».',
      'Berta: Pasa la tarea «Agua» a Ana.',
      'Ana: Empieza la tarea «Agua».',
      'Ana: Termina la tarea «Agua».',
      'Ana: Cambia la tarea «Agua: 20 l».',
    ]);
  });

  it('tells when a member changes status, and nothing of battery or equipment', () => {
    const state = (seq: number, status: 'active' | 'resting', battery: number) =>
      ({
        type: 'member-state',
        origin: BERTA,
        seq,
        time: T0 + seq,
        profile: 'volunteer',
        status,
        battery,
        equipment: [],
      }) as const;
    const lines = diaryLines(
      stateOf([
        ...EVENTS,
        state(30, 'active', 90),
        state(31, 'active', 80),
        state(32, 'resting', 80),
      ]),
      translator('es'),
    );
    const told = lines.filter((line) => line.text.startsWith('Estado'));
    expect(told.map((line) => `${line.author}: ${line.text}`)).toEqual([
      'Berta: Estado: En descanso.',
    ]);
  });

  it('leaves out alerts and roll calls, which the app neither sends nor shows', () => {
    const call = { type: 'roll-call', origin: ANA, seq: 20, time: T0 + 80, text: '' } as const;
    const alert = {
      type: 'alert',
      origin: ANA,
      seq: 21,
      time: T0 + 81,
      level: 'critical',
      text: 'Evacuad',
    } as const;
    const answer = {
      type: 'ack',
      origin: BERTA,
      seq: 20,
      time: T0 + 82,
      target: { origin: ANA, seq: 20 },
    } as const;
    const before = diaryLines(stateOf(EVENTS), translator('es'));
    expect(diaryLines(stateOf([...EVENTS, call, alert, answer]), translator('es'))).toEqual(before);
  });

  it('places what happened somewhere', () => {
    const lines = diaryLines(stateOf(EVENTS), translator('es'));
    expect(lines.find((line) => line.text.startsWith('Pide ayuda'))?.at).toEqual({
      lat: 39.41,
      lon: -0.31,
    });
  });

  it('tells of the areas members enter and leave, by name, and where', () => {
    const area: TeselEvent = {
      type: 'shape',
      origin: ANA,
      seq: 7,
      time: T0 + 70,
      object: { origin: ANA, seq: 7 },
      style: 0x0001,
      label: 'Derrumbe',
      geometry: { kind: 'circle', center: { lat: 39.47, lon: -0.37 }, radius: 50 },
    };
    const crossing = (
      seq: number,
      kind: 'danger' | 'assigned' | 'other',
      value: 'entered' | 'left',
      zone = 7,
    ): TeselEvent => ({
      type: 'zone-crossing',
      origin: BERTA,
      seq,
      time: T0 + 70 + seq,
      zone: { origin: ANA, seq: zone },
      crossing: value,
      kind,
      lat: 39.47,
      lon: -0.37,
      accuracy: 6,
    });
    const lines = diaryLines(
      stateOf([
        ...EVENTS,
        area,
        crossing(8, 'danger', 'entered'),
        crossing(9, 'danger', 'left'),
        crossing(10, 'assigned', 'entered', 99),
        crossing(11, 'assigned', 'left', 99),
        crossing(12, 'other', 'entered'),
      ]),
      translator('es'),
    ).slice(-5);
    expect(lines.map((line) => line.text)).toEqual([
      'Entra en la zona de peligro «Derrumbe».',
      'Sale de la zona de peligro «Derrumbe».',
      'Llega a la zona de su tarea.',
      'Sale de la zona de su tarea.',
      'Entra en la zona «Derrumbe».',
    ]);
    expect(lines[0]?.at).toEqual({ lat: 39.47, lon: -0.37 });
  });
});
