// Shared fixtures for this package's tests. Not exported from the package.

import type { TeselEvent, NodeId } from './events.ts';

export const ALICE = 'a1b2c3d4' as NodeId;
export const BOB = '0f1e2d3c' as NodeId;
/** Node ID of the public key 00 01 … 1f, so MEMBER_INFO samples pass the key check. */
export const CAROL = '630dcd29' as NodeId;
export const T0 = 1_761_350_400; // 2025-10-25T00:00:00Z

export function hex(text: string): Uint8Array {
  const clean = text.replace(/\s+/g, '');
  return Uint8Array.from({ length: clean.length / 2 }, (_, i) =>
    Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16),
  );
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Deterministic pseudo-random bytes (xorshift32), for fuzzing and fixed nonces. */
export function seededRandom(seed: number): (length: number) => Uint8Array {
  let state = seed >>> 0 || 1;
  return (length) =>
    Uint8Array.from({ length }, () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) & 0xff;
    });
}

/** One valid event of every type, with coordinates already at wire precision. */
export const SAMPLE_EVENTS: readonly TeselEvent[] = [
  {
    type: 'member-info',
    origin: CAROL,
    seq: 1,
    time: T0,
    role: 'coordinator',
    publicKey: Uint8Array.from({ length: 32 }, (_, i) => i),
    alias: 'Pau · Protección Civil',
  },
  {
    type: 'position',
    origin: ALICE,
    seq: 2,
    time: T0 + 1,
    lat: 41.3874,
    lon: 2.1686,
    accuracy: 5,
    heading: 90,
    speed: 1.5,
  },
  {
    type: 'position',
    origin: BOB,
    seq: 1,
    time: T0,
    lat: -33.8688197,
    lon: -151.2092955,
    accuracy: null,
    heading: null,
    speed: null,
  },
  { type: 'position-hidden', origin: ALICE, seq: 3, time: T0 + 2 },
  { type: 'chat', origin: BOB, seq: 2, time: T0 + 3, text: 'Llegamos al punto de encuentro 👍' },
  {
    type: 'marker',
    origin: ALICE,
    seq: 4,
    time: T0 + 4,
    object: { origin: ALICE, seq: 4 },
    symbol: 0x0001,
    lat: 39.4699,
    lon: -0.3763,
    label: 'Herido leve',
  },
  {
    type: 'shape',
    origin: BOB,
    seq: 3,
    time: T0 + 5,
    object: { origin: BOB, seq: 3 },
    style: 0x0001,
    label: 'Zona inundada',
    geometry: {
      kind: 'polygon',
      points: [
        { lat: 39.47, lon: -0.38 },
        { lat: 39.471, lon: -0.379 },
        { lat: 39.4705, lon: -0.377 },
      ],
    },
  },
  {
    type: 'shape',
    origin: ALICE,
    seq: 5,
    time: T0 + 6,
    object: { origin: BOB, seq: 3 },
    style: 0x0005,
    label: '',
    geometry: {
      kind: 'polyline',
      points: [
        { lat: 42.5, lon: 1.5 },
        { lat: 42.501, lon: 1.502 },
      ],
    },
  },
  {
    type: 'shape',
    origin: ALICE,
    seq: 6,
    time: T0 + 7,
    object: { origin: ALICE, seq: 6 },
    style: 0x0002,
    label: 'Sector 3',
    geometry: { kind: 'circle', center: { lat: 40.4168, lon: -3.7038 }, radius: 250 },
  },
  { type: 'object-delete', origin: BOB, seq: 4, time: T0 + 8, object: { origin: ALICE, seq: 4 } },
  {
    type: 'sos',
    origin: BOB,
    seq: 5,
    time: T0 + 9,
    kind: 'medical',
    lat: 43.2627,
    lon: -2.9253,
    accuracy: 12,
    text: 'Caída, posible fractura',
  },
  { type: 'sos-cancel', origin: ALICE, seq: 7, time: T0 + 10, sos: { origin: BOB, seq: 5 } },
  {
    type: 'alert',
    origin: ALICE,
    seq: 8,
    time: T0 + 11,
    level: 'critical',
    text: 'Evacuad el sector norte',
  },
  { type: 'ack', origin: ALICE, seq: 9, time: T0 + 12, target: { origin: BOB, seq: 5 } },
  {
    type: 'task',
    origin: BOB,
    seq: 6,
    time: T0 + 13,
    task: { origin: BOB, seq: 6 },
    status: 'open',
    assignee: ALICE,
    place: { kind: 'point', at: { lat: 41.3851, lon: 2.1734 } },
    text: 'Revisar el almacén',
  },
  {
    type: 'task',
    origin: ALICE,
    seq: 10,
    time: T0 + 14,
    task: { origin: BOB, seq: 6 },
    status: 'done',
    assignee: null,
    place: { kind: 'object', object: { origin: ALICE, seq: 6 } },
    text: 'Revisar el almacén',
  },
  { type: 'roll-call', origin: CAROL, seq: 2, time: T0 + 15, text: '' },
  { type: 'roll-call', origin: CAROL, seq: 3, time: T0 + 16, text: '¿Todos en el punto B?' },
  {
    type: 'sweep',
    origin: CAROL,
    seq: 4,
    time: T0 + 17,
    object: { origin: CAROL, seq: 4 },
    area: { origin: BOB, seq: 3 },
    spacing: 25,
    heading: 135,
    strip: 1,
    strips: 3,
  },
  {
    type: 'member-state',
    origin: BOB,
    seq: 11,
    time: T0 + 18,
    profile: 'civil-protection',
    status: 'resting',
    battery: 40,
    equipment: ['first-aid', 'water', 'radio'],
  },
  {
    type: 'team',
    origin: ALICE,
    seq: 12,
    time: T0 + 19,
    team: '5eed0001' as NodeId,
    colour: 'orange',
    dissolved: false,
    members: [ALICE, BOB],
    name: 'Equipo Norte',
  },
  {
    type: 'report',
    origin: BOB,
    seq: 13,
    time: T0 + 20,
    place: { kind: 'point', at: { lat: 39.4705, lon: -0.377 } },
    incident: 'fire',
    hazards: ['fire', 'smoke'],
    access: 'difficult',
    casualties: { red: 1, yellow: 2, green: null, black: 0 },
    resources: ['ambulance', 'firefighters'],
    note: 'Nave industrial, dos plantas',
  },
  { type: 'check-in-timer', origin: ALICE, seq: 14, time: T0 + 21, minutes: 30 },
  {
    type: 'zone-crossing',
    origin: BOB,
    seq: 14,
    time: T0 + 22,
    zone: { origin: ALICE, seq: 3 },
    crossing: 'left',
    kind: 'assigned',
    lat: 39.4705,
    lon: -0.377,
    accuracy: 8,
  },
];
