import {
  EVENT_TYPES,
  eventRefKey,
  type ChatEvent,
  type TeselEvent,
  type NodeId,
  type PositionEvent,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { EMPTY_STATE, HANDLED_TYPES, reduce, reduceAll, stateOf } from './reducer.ts';

const ALICE = 'a1b2c3d4' as NodeId;
const BOB = '0f1e2d3c' as NodeId;
const TEAM = '5eed0001' as NodeId;
const T0 = 1_761_350_400;

const chat = (origin: NodeId, seq: number, time: number, text: string): ChatEvent => ({
  type: 'chat',
  origin,
  seq,
  time,
  text,
});

const position = (origin: NodeId, seq: number, time: number, lat: number): PositionEvent => ({
  type: 'position',
  origin,
  seq,
  time,
  lat,
  lon: -0.37,
  accuracy: 5,
  heading: null,
  speed: null,
});

const EVENTS: readonly TeselEvent[] = [
  {
    type: 'member-info',
    origin: ALICE,
    seq: 1,
    time: T0,
    role: 'coordinator',
    publicKey: new Uint8Array(32),
    alias: 'Ana',
  },
  {
    type: 'member-info',
    origin: BOB,
    seq: 1,
    time: T0 + 1,
    role: 'member',
    publicKey: new Uint8Array(32),
    alias: 'Berta',
  },
  {
    type: 'member-info',
    origin: BOB,
    seq: 5,
    time: T0 + 50,
    role: 'member',
    publicKey: new Uint8Array(32),
    alias: 'Berta G.',
  },
  position(ALICE, 2, T0 + 10, 39.47),
  position(ALICE, 3, T0 + 20, 39.48),
  { type: 'position-hidden', origin: ALICE, seq: 4, time: T0 + 30 },
  position(BOB, 2, T0 + 12, 39.46),
  chat(ALICE, 6, T0 + 40, 'Hola'),
  chat(BOB, 3, T0 + 40, 'Recibido'),
  chat(BOB, 4, T0 + 41, '¿Dónde?'),
  {
    type: 'marker',
    origin: ALICE,
    seq: 7,
    time: T0 + 60,
    object: { origin: ALICE, seq: 7 },
    symbol: 3,
    lat: 39.47,
    lon: -0.37,
    label: 'Fuego',
  },
  {
    type: 'object-delete',
    origin: ALICE,
    seq: 8,
    time: T0 + 65,
    object: { origin: ALICE, seq: 7 },
  },
  {
    type: 'marker',
    origin: BOB,
    seq: 6,
    time: T0 + 70,
    object: { origin: ALICE, seq: 7 },
    symbol: 3,
    lat: 39.47,
    lon: -0.37,
    label: 'Fuego activo',
  },
  {
    type: 'shape',
    origin: BOB,
    seq: 7,
    time: T0 + 72,
    object: { origin: BOB, seq: 7 },
    style: 1,
    label: 'Zona',
    geometry: { kind: 'circle', center: { lat: 39.47, lon: -0.37 }, radius: 200 },
  },
  { type: 'object-delete', origin: ALICE, seq: 9, time: T0 + 75, object: { origin: BOB, seq: 7 } },
  {
    type: 'sos',
    origin: BOB,
    seq: 8,
    time: T0 + 80,
    kind: 'medical',
    lat: 39.46,
    lon: -0.37,
    accuracy: 8,
    text: 'Tobillo roto',
  },
  { type: 'ack', origin: ALICE, seq: 10, time: T0 + 82, target: { origin: BOB, seq: 8 } },
  { type: 'ack', origin: ALICE, seq: 11, time: T0 + 83, target: { origin: BOB, seq: 8 } },
  { type: 'sos-cancel', origin: BOB, seq: 9, time: T0 + 90, sos: { origin: BOB, seq: 8 } },
  { type: 'sos-cancel', origin: ALICE, seq: 12, time: T0 + 95, sos: { origin: BOB, seq: 8 } },
  {
    type: 'alert',
    origin: ALICE,
    seq: 13,
    time: T0 + 100,
    level: 'critical',
    text: 'Evacuad la zona norte',
  },
  {
    type: 'task',
    origin: BOB,
    seq: 10,
    time: T0 + 110,
    task: { origin: BOB, seq: 10 },
    status: 'open',
    assignee: ALICE,
    place: { kind: 'point', at: { lat: 39.47, lon: -0.38 } },
    text: 'Revisar el almacén',
  },
  {
    type: 'task',
    origin: ALICE,
    seq: 14,
    time: T0 + 130,
    task: { origin: BOB, seq: 10 },
    status: 'done',
    assignee: ALICE,
    place: { kind: 'point', at: { lat: 39.47, lon: -0.38 } },
    text: 'Revisar el almacén',
  },
  {
    type: 'task',
    origin: BOB,
    seq: 11,
    time: T0 + 120,
    task: { origin: BOB, seq: 10 },
    status: 'in-progress',
    assignee: ALICE,
    place: null,
    text: 'Revisar el almacén',
  },
  { type: 'roll-call', origin: ALICE, seq: 15, time: T0 + 140, text: '' },
  { type: 'roll-call', origin: ALICE, seq: 16, time: T0 + 141, text: '¿Todos en el punto B?' },
  {
    type: 'sweep',
    origin: ALICE,
    seq: 17,
    time: T0 + 150,
    object: { origin: ALICE, seq: 17 },
    area: { origin: BOB, seq: 7 },
    spacing: 25,
    heading: 90,
    strip: 0,
    strips: 2,
  },
  {
    type: 'member-state',
    origin: BOB,
    seq: 12,
    time: T0 + 160,
    profile: 'civil-protection',
    status: 'active',
    battery: 80,
    equipment: ['first-aid'],
  },
  {
    type: 'member-state',
    origin: BOB,
    seq: 13,
    time: T0 + 170,
    profile: 'civil-protection',
    status: 'resting',
    battery: 40,
    equipment: ['first-aid', 'water'],
  },
  {
    type: 'team',
    origin: ALICE,
    seq: 18,
    time: T0 + 180,
    team: TEAM,
    colour: 'orange',
    dissolved: false,
    members: [ALICE],
    name: 'Norte',
  },
  {
    type: 'team',
    origin: BOB,
    seq: 14,
    time: T0 + 181,
    team: TEAM,
    colour: 'orange',
    dissolved: false,
    members: [ALICE, BOB],
    name: 'Equipo Norte',
  },
  {
    type: 'report',
    origin: BOB,
    seq: 15,
    time: T0 + 190,
    place: { kind: 'point', at: { lat: 39.4705, lon: -0.377 } },
    incident: 'fire',
    hazards: ['smoke'],
    access: 'difficult',
    casualties: { red: 1, yellow: null, green: null, black: 0 },
    resources: ['firefighters'],
    note: '',
  },
  { type: 'check-in-timer', origin: ALICE, seq: 19, time: T0 + 200, minutes: 30 },
  { type: 'check-in-timer', origin: BOB, seq: 16, time: T0 + 201, minutes: 0 },
];

/** Every ordering of a few events, plus a few shuffles of all of them. */
function* orderings(events: readonly TeselEvent[]): Generator<readonly TeselEvent[]> {
  yield events;
  yield [...events].reverse();
  let seed = 7;
  for (let round = 0; round < 50; round++) {
    const shuffled = [...events];
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j] as TeselEvent, shuffled[i] as TeselEvent];
    }
    yield shuffled;
  }
}

describe('group state', () => {
  it('reaches the same state whatever order the events arrive in', () => {
    const expected = stateOf(EVENTS);
    for (const ordering of orderings(EVENTS)) expect(stateOf(ordering)).toEqual(expected);
  });

  it('ignores a duplicate event delivered by a second transport', () => {
    const once = stateOf(EVENTS);
    expect(stateOf([...EVENTS, ...EVENTS])).toEqual(once);
    for (const event of EVENTS) expect(reduce(once, event)).toBe(once);
  });

  it('keeps the latest alias of each member', () => {
    const { members } = stateOf(EVENTS);
    expect(members.get(ALICE)?.alias).toBe('Ana');
    expect(members.get(BOB)?.alias).toBe('Berta G.');
  });

  it('forgets a position once the member stops sharing, even if an older one arrives late', () => {
    const late = position(ALICE, 3, T0 + 20, 39.48);
    const state = reduce(stateOf(EVENTS), late);
    expect(state.positions.get(ALICE)?.type).toBe('position-hidden');
    expect(state.positions.get(BOB)?.type).toBe('position');
  });

  it('keeps the newest roll call as the current one, whatever order they arrive in', () => {
    const first = { type: 'roll-call', origin: ALICE, seq: 20, time: T0 + 200, text: '' } as const;
    const second = { ...first, seq: 21, time: T0 + 300 };
    expect(stateOf([second, first]).rollCall).toBe(second);
    expect(stateOf([first, second]).rollCall).toBe(second);
  });

  it('keeps the latest change of each task, whoever made it', () => {
    const task = stateOf(EVENTS).tasks.get(`${BOB}:10`);
    expect(task?.status).toBe('done');
    expect(task?.origin).toBe(ALICE);
  });

  it('orders chat by time, then origin, then sequence', () => {
    expect(stateOf(EVENTS).chat.map((line) => line.text)).toEqual(['Recibido', 'Hola', '¿Dónde?']);
  });

  it('keeps the newest edit of an object, even against an older deletion that arrives late', () => {
    const { objects } = stateOf(EVENTS);
    const fire = objects.get(`${ALICE}:7`);
    expect(fire?.type === 'marker' && fire.label).toBe('Fuego activo');
    expect(objects.get(`${BOB}:7`)?.type).toBe('object-delete');
  });

  it('records who cancelled an SOS first and who acknowledged it once', () => {
    const state = stateOf(EVENTS);
    expect(state.sos.get(`${BOB}:8`)?.kind).toBe('medical');
    expect(state.sosCancels.get(`${BOB}:8`)?.origin).toBe(BOB);
    const acks = state.acks.get(`${BOB}:8`);
    expect([...(acks?.keys() ?? [])]).toEqual([ALICE]);
    expect(acks?.get(ALICE)?.seq).toBe(10);
  });

  it('keeps the newest roll call, member state, team and check-in, and every report', () => {
    const state = stateOf(EVENTS);
    expect(state.rollCall?.seq).toBe(16);
    expect(state.memberStates.get(BOB)?.status).toBe('resting');
    expect(state.teams.get(TEAM)?.members).toEqual([ALICE, BOB]);
    expect(state.checkIn?.minutes).toBe(0);
    expect(state.reports.map((report) => report.seq)).toEqual([15]);
    expect(state.objects.get(eventRefKey({ origin: ALICE, seq: 17 }))?.type).toBe('sweep');
  });

  it('lists alerts in order', () => {
    expect(stateOf(EVENTS).alerts.map((alert) => alert.text)).toEqual(['Evacuad la zona norte']);
  });

  it('journals every event but positions, in the order every device agrees on', () => {
    const { journal } = stateOf(EVENTS);
    expect(journal).toHaveLength(EVENTS.filter((event) => event.type !== 'position').length);
    const times = journal.map((event) => event.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it('starts empty', () => {
    expect(EMPTY_STATE.members.size + EMPTY_STATE.positions.size + EMPTY_STATE.chat.length).toBe(0);
  });
});

describe('slices', () => {
  it('give every event type of the protocol a place in the state', () => {
    expect([...HANDLED_TYPES].sort()).toEqual([...EVENT_TYPES].sort());
  });

  it('keep the identity of the slices an event does not touch', () => {
    const before = stateOf(EVENTS);
    const after = reduce(before, chat(BOB, 99, T0 + 500, 'later'));
    expect(after.chat).not.toBe(before.chat);
    expect(after.members).toBe(before.members);
    expect(after.objects).toBe(before.objects);
  });
});

describe('applying a batch', () => {
  it('gives exactly the state that applying its events one by one gives, in any order', () => {
    let seed = 7;
    const random = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
    const batch = [...EVENTS, ...EVENTS.slice(0, 6)];
    for (let round = 0; round < 20; round++) {
      const shuffled = [...batch].sort(() => random() - 0.5);
      const split = Math.floor(random() * shuffled.length);
      const before = shuffled.slice(0, split).reduce(reduce, EMPTY_STATE);
      const rest = shuffled.slice(split);
      expect(reduceAll(before, rest)).toEqual(rest.reduce(reduce, before));
    }
  });

  it('opens an operation of tens of thousands of messages and acknowledgements quickly', () => {
    const events: TeselEvent[] = [];
    for (let i = 0; i < 20_000; i++) {
      events.push(chat(i % 2 ? ALICE : BOB, i + 1, T0 + i, 'ok'));
      events.push({
        type: 'ack',
        origin: i % 2 ? BOB : ALICE,
        seq: 100_000 + i,
        time: T0 + i,
        target: { origin: ALICE, seq: i + 1 },
      });
    }
    // Under a second on a laptop; one by one it took minutes. Loose, so a busy machine passes.
    const start = performance.now();
    const state = stateOf(events);
    expect(performance.now() - start).toBeLessThan(20_000);
    expect(state.chat).toHaveLength(20_000);
    expect(state.acks.size).toBe(20_000);
  });
});

describe('long operations', () => {
  it('rebuilds eight hours of fifty members sharing their position every ten seconds', () => {
    const members = Array.from({ length: 50 }, (_, i) => i.toString(16).padStart(8, '0') as NodeId);
    const events: TeselEvent[] = [];
    for (let round = 0; round < (8 * 3600) / 10; round++) {
      members.forEach((member, index) => {
        events.push(position(member, round + 1, T0 + 10 * round, 39.47 + index / 1000));
      });
    }
    // About half a second on a laptop. The bound only catches a slice that turns quadratic, which
    // over these 144,000 events would take hours; it is loose so that a busy machine never fails it.
    const start = performance.now();
    const state = stateOf(events);
    expect(performance.now() - start).toBeLessThan(60_000);
    expect(state.positions.size).toBe(50);
  });
});
