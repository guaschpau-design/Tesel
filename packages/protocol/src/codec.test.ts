import { describe, expect, it } from 'vitest';

import { compareBytes } from './bytes.ts';
import { compareEncodings, decodeEvent, encodeEvent, isKeepable, peekHeader } from './codec.ts';
import {
  EventTypeCode,
  MAX_CIRCLE_RADIUS_M,
  MAX_DECODABLE_EVENT_SIZE,
  MAX_EVENT_SIZE,
  SHAPE_MAX_POINTS,
  TEAM_MAX_MEMBERS,
} from './constants.ts';
import type { NodeId, ShapeEvent, TeselEvent } from './events.ts';
import { TASK_TEXT_MAX_BYTES } from './fields.ts';
import { EVENT_TYPES, PAYLOADS } from './payloads.ts';
import { ALICE, BOB, CAROL, hex, SAMPLE_EVENTS, seededRandom, T0, toHex } from './test-helpers.ts';

function encodeOrFail(event: TeselEvent): Uint8Array {
  const result = encodeEvent(event);
  if (!result.ok) throw new Error(`encoding failed: ${result.error.detail}`);
  return result.value;
}

function decodeError(bytes: Uint8Array): string {
  const result = decodeEvent(bytes);
  if (result.ok) throw new Error('expected decoding to fail');
  return result.error.code;
}

describe('event codec', () => {
  it.each(SAMPLE_EVENTS.map((event) => [event.type, event] as const))(
    'round-trips a %s event',
    (_type, event) => {
      const bytes = encodeOrFail(event);
      expect(bytes.length).toBeLessThanOrEqual(MAX_EVENT_SIZE);
      expect(decodeEvent(bytes)).toEqual({ ok: true, value: event });
    },
  );

  it('matches the chat test vector computed independently from the spec', () => {
    const event: TeselEvent = { type: 'chat', origin: ALICE, seq: 1, time: T0, text: 'Hola' };
    expect(toHex(encodeOrFail(event))).toBe('0104a1b2c3d4010000000013fc68486f6c61');
  });

  // Each enumerated field pinned by one vector: its codes are written out in constants.ts, and a
  // change to them would change these bytes.
  it('matches the member-info test vector computed independently from the spec', () => {
    // RFC 8032's first Ed25519 public key; its node ID is the first 4 bytes of its SHA-256.
    const publicKey = hex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
    const event: TeselEvent = {
      type: 'member-info',
      origin: '21fe31df' as NodeId,
      seq: 1,
      time: T0,
      role: 'coordinator',
      publicKey,
      alias: 'Ana',
    };
    expect(toHex(encodeOrFail(event))).toBe(
      '010121fe31df010000000013fc6801d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a416e61',
    );
  });

  it('matches the SOS, alert and task test vectors computed independently from the spec', () => {
    const sos: TeselEvent = {
      type: 'sos',
      origin: ALICE,
      seq: 2,
      time: T0,
      kind: 'fire',
      lat: 41.3874,
      lon: 2.1686,
      accuracy: 25,
      text: 'Humo',
    };
    expect(toHex(encodeOrFail(sos))).toBe(
      '0108a1b2c3d4020000000013fc68035037ab18f0e64a01190048756d6f',
    );
    const alert: TeselEvent = {
      type: 'alert',
      origin: ALICE,
      seq: 3,
      time: T0,
      level: 'critical',
      text: 'Evacuad',
    };
    expect(toHex(encodeOrFail(alert))).toBe('010aa1b2c3d4030000000013fc680245766163756164');
    const task: TeselEvent = {
      type: 'task',
      origin: ALICE,
      seq: 5,
      time: T0,
      task: { origin: ALICE, seq: 4 },
      status: 'in-progress',
      assignee: BOB,
      place: { kind: 'point', at: { lat: 41.3874, lon: 2.1686 } },
      text: 'Buscar',
    };
    expect(toHex(encodeOrFail(task))).toBe(
      '010ca1b2c3d4050000000013fc68a1b2c3d404000000010f1e2d3c015037ab18f0e64a01427573636172',
    );
  });

  it('matches the position test vector computed independently from the spec', () => {
    const event: TeselEvent = {
      type: 'position',
      origin: ALICE,
      seq: 7,
      time: T0,
      lat: 41.3874,
      lon: 2.1686,
      accuracy: 5,
      heading: 90,
      speed: 1.5,
    };
    const bytes = encodeOrFail(event);
    expect(bytes.length).toBe(28);
    expect(toHex(bytes)).toBe('0102a1b2c3d4070000000013fc685037ab18f0e64a0105005a009600');
  });

  it('keeps events that decode and those of unknown types, not damaged ones', () => {
    const chat = encodeOrFail({ type: 'chat', origin: ALICE, seq: 1, time: T0, text: 'Hola' });
    expect(isKeepable(chat)).toBe(true);
    const unknown = chat.slice();
    unknown[1] = 0x7f;
    expect(isKeepable(unknown)).toBe(true);
    const position = encodeOrFail({
      type: 'position',
      origin: ALICE,
      seq: 7,
      time: T0,
      lat: 41.3874,
      lon: 2.1686,
      accuracy: 5,
      heading: 90,
      speed: 1.5,
    });
    expect(isKeepable(position.slice(0, 20))).toBe(false);
    expect(isKeepable(position.slice(0, 10))).toBe(false);
  });

  describe('encoding limits', () => {
    it('accepts a chat text that fills the event exactly', () => {
      const event: TeselEvent = {
        type: 'chat',
        origin: BOB,
        seq: 1,
        time: T0,
        text: 'x'.repeat(139),
      };
      expect(encodeOrFail(event).length).toBe(MAX_EVENT_SIZE);
    });

    it('refuses a chat text one byte too long', () => {
      const event: TeselEvent = {
        type: 'chat',
        origin: BOB,
        seq: 1,
        time: T0,
        text: 'x'.repeat(140),
      };
      const result = encodeEvent(event);
      expect(result.ok ? null : result.error.code).toBe('too-large');
    });

    it('counts text limits in UTF-8 bytes, not characters', () => {
      const event: TeselEvent = {
        type: 'chat',
        origin: BOB,
        seq: 1,
        time: T0,
        text: 'ñ'.repeat(70),
      };
      expect(encodeEvent(event).ok).toBe(false); // 140 bytes
    });

    it('decodes events written before radio frames were sealed, up to their larger size', () => {
      const chat = (length: number): Uint8Array =>
        Uint8Array.from([
          ...hex('0104a1b2c3d4010000000013fc68'),
          ...new Uint8Array(length).fill(0x78),
        ]);
      expect(MAX_DECODABLE_EVENT_SIZE).toBe(165);
      const earlier = decodeEvent(chat(151));
      expect(earlier.ok && earlier.value).toMatchObject({ type: 'chat', text: 'x'.repeat(151) });
      expect(decodeError(chat(152))).toBe('too-large');
    });

    it('refuses sequence number 0', () => {
      const event: TeselEvent = { type: 'position-hidden', origin: BOB, seq: 0, time: T0 };
      expect(encodeEvent(event).ok).toBe(false);
    });

    it('saturates huge measurements below the unknown marker', () => {
      const event: TeselEvent = {
        type: 'position',
        origin: BOB,
        seq: 1,
        time: T0,
        lat: 0,
        lon: 0,
        accuracy: 1e9,
        heading: 360,
        speed: 1e6,
      };
      const decoded = decodeEvent(encodeOrFail(event));
      expect(decoded.ok && decoded.value).toMatchObject({
        accuracy: 65534,
        heading: 0,
        speed: 655.34,
      });
    });
  });

  describe('shapes', () => {
    const baseShape = {
      type: 'shape',
      origin: ALICE,
      seq: 1,
      time: T0,
      object: { origin: ALICE, seq: 1 },
      style: 0,
      label: '',
    } as const;

    function line(count: number, step: number): ShapeEvent {
      const points = Array.from({ length: count }, (_, i) => ({ lat: 40 + i * step, lon: -3 }));
      return { ...baseShape, geometry: { kind: 'polyline', points } };
    }

    it('fits 30 points with an empty label', () => {
      expect(encodeOrFail(line(30, 0.001)).length).toBe(151);
    });

    it('refuses a 31st point', () => {
      expect(encodeEvent(line(31, 0.001)).ok).toBe(false);
    });

    it('fits the points the app allows with the longest label', () => {
      expect(SHAPE_MAX_POINTS).toBe(22);
      const longest = { ...line(SHAPE_MAX_POINTS, 0.001), label: 'x'.repeat(32) };
      expect(encodeOrFail(longest).length).toBeLessThanOrEqual(MAX_EVENT_SIZE);
      expect(encodeEvent({ ...line(SHAPE_MAX_POINTS + 1, 0.001), label: 'x'.repeat(32) }).ok).toBe(
        false,
      );
    });

    it('refuses consecutive points too far apart for a 16-bit delta', () => {
      expect(encodeEvent(line(2, 0.4)).ok).toBe(false);
    });

    function circle(radius: number): ShapeEvent {
      return { ...baseShape, geometry: { kind: 'circle', center: { lat: 85, lon: 0 }, radius } };
    }

    it('accepts a circle of up to 1 000 km and refuses a larger one, or no radius at all', () => {
      expect(MAX_CIRCLE_RADIUS_M).toBe(1_000_000);
      expect(decodeEvent(encodeOrFail(circle(MAX_CIRCLE_RADIUS_M)))).toEqual({
        ok: true,
        value: circle(MAX_CIRCLE_RADIUS_M),
      });
      for (const radius of [MAX_CIRCLE_RADIUS_M + 1, 4e9, 0.4, Number.NaN, Infinity]) {
        expect(encodeEvent(circle(radius)).ok).toBe(false);
      }
    });

    it('discards a circle whose radius is above 1 000 km or 0', () => {
      const bytes = encodeOrFail(circle(MAX_CIRCLE_RADIUS_M));
      const radius = new DataView(bytes.buffer, bytes.byteOffset + bytes.length - 4);
      radius.setUint32(0, MAX_CIRCLE_RADIUS_M + 1);
      expect(decodeError(bytes)).toBe('invalid-value');
      radius.setUint32(0, 4_000_000_000);
      expect(decodeError(bytes)).toBe('invalid-value');
      radius.setUint32(0, 0);
      expect(decodeError(bytes)).toBe('invalid-value');
    });

    it('refuses a polygon whose last point repeats the first', () => {
      const p = { lat: 40, lon: -3 };
      const event: ShapeEvent = {
        ...baseShape,
        geometry: {
          kind: 'polygon',
          points: [p, { lat: 40.001, lon: -3 }, { lat: 40, lon: -2.999 }, p],
        },
      };
      expect(encodeEvent(event).ok).toBe(false);
    });

    it('does not accumulate rounding error along a long line', () => {
      const points = Array.from({ length: 30 }, (_, i) => ({
        lat: 40 + i * 0.0012345,
        lon: -3 + (i % 2) * 0.0006789,
      }));
      const event: ShapeEvent = { ...baseShape, geometry: { kind: 'polyline', points } };
      const decoded = decodeEvent(encodeOrFail(event));
      if (
        !decoded.ok ||
        decoded.value.type !== 'shape' ||
        decoded.value.geometry.kind !== 'polyline'
      ) {
        throw new Error('expected a polyline');
      }
      decoded.value.geometry.points.forEach((point, i) => {
        const original = points[i];
        expect(Math.abs(point.lat - (original?.lat ?? NaN))).toBeLessThanOrEqual(0.5e-5 + 1e-9);
        expect(Math.abs(point.lon - (original?.lon ?? NaN))).toBeLessThanOrEqual(0.5e-5 + 1e-9);
      });
    });
  });

  describe('decoding untrusted input', () => {
    const chat = hex('0104a1b2c3d4010000000013fc68486f6c61');

    it('rejects an unsupported protocol version', () => {
      expect(decodeError(Uint8Array.of(2, ...chat.slice(1)))).toBe('unsupported-version');
    });

    it('reports an unknown event type so receivers can ignore it', () => {
      expect(decodeError(Uint8Array.of(1, 0xee, ...chat.slice(2)))).toBe('unknown-type');
    });

    it('rejects a truncated header', () => {
      expect(decodeError(chat.slice(0, 10))).toBe('truncated');
    });

    it('rejects bytes after the last field', () => {
      const ack = encodeOrFail({
        type: 'ack',
        origin: ALICE,
        seq: 1,
        time: T0,
        target: { origin: BOB, seq: 2 },
      });
      expect(decodeError(Uint8Array.of(...ack, 0))).toBe('trailing-bytes');
    });

    it('rejects invalid UTF-8', () => {
      expect(decodeError(Uint8Array.of(...chat.slice(0, 14), 0xff, 0xfe))).toBe('invalid-utf8');
    });

    it('rejects an out-of-range latitude', () => {
      const position = hex(
        '0102a1b2c3d4070000000013fc68' + '00ca9a3b' + '00000000' + 'ffffffffffff',
      );
      expect(decodeError(position)).toBe('invalid-value'); // 100° latitude
    });

    it('rejects sequence number 0', () => {
      expect(decodeError(hex('0103a1b2c3d4000000000013fc68'))).toBe('invalid-value');
    });

    it('shows a reserved SOS kind as general', () => {
      const sos = encodeOrFail({
        type: 'sos',
        origin: BOB,
        seq: 1,
        time: T0,
        kind: 'fire',
        lat: 1,
        lon: 1,
        accuracy: null,
        text: '',
      });
      sos[14] = 200;
      const decoded = decodeEvent(sos);
      expect(decoded.ok && decoded.value.type === 'sos' && decoded.value.kind).toBe('general');
    });

    it('never throws on random input', () => {
      const random = seededRandom(42);
      for (let i = 0; i < 5000; i++) {
        const length = random(1)[0] ?? 0;
        const bytes = random(length % 200);
        if (bytes.length > 1) {
          bytes[0] = 1; // valid version, so decoding goes deep
          bytes[1] = (bytes[1] ?? 0) % 0x0c;
        }
        expect(() => decodeEvent(bytes)).not.toThrow();
      }
    });
  });
});

const polygonAt = (points: ShapeEvent['geometry']): ShapeEvent => ({
  type: 'shape',
  origin: ALICE,
  seq: 1,
  time: T0,
  object: { origin: ALICE, seq: 1 },
  style: 0,
  label: '',
  geometry: points,
});

describe('text fields', () => {
  it('refuses half of a surrogate pair rather than send other text', () => {
    const chat = SAMPLE_EVENTS.find((event) => event.type === 'chat');
    expect(chat).toBeDefined();
    if (chat?.type !== 'chat') return;
    expect(encodeEvent({ ...chat, text: 'SOS \ud83d' }).ok).toBe(false);
    expect(encodeEvent({ ...chat, text: 'SOS \ud83d\udea8' }).ok).toBe(true);
  });

  it('keeps a leading byte-order mark instead of silently dropping it', () => {
    const event: TeselEvent = { type: 'chat', origin: ALICE, seq: 1, time: T0, text: '﻿hi' };
    expect(decodeEvent(encodeOrFail(event))).toEqual({ ok: true, value: event });
  });
});

describe('polygon closure', () => {
  const almostClosed = polygonAt({
    kind: 'polygon',
    points: [
      { lat: 10, lon: 10 },
      { lat: 10.01, lon: 10 },
      { lat: 10.000001, lon: 10.000001 },
    ],
  });

  it('refuses a polygon whose last point rounds onto the first', () => {
    expect(encodeEvent(almostClosed).ok).toBe(false);
  });

  it('rejects such a polygon when decoding', () => {
    const triangle = encodeOrFail(
      polygonAt({
        kind: 'polygon',
        points: [
          { lat: 10, lon: 10 },
          { lat: 10.01, lon: 10 },
          { lat: 10, lon: 10.01 },
        ],
      }),
    );
    // Rewrite the last delta so the reconstructed last point equals the first.
    const view = new DataView(triangle.buffer);
    const lastDelta = triangle.length - 4;
    view.setInt16(lastDelta, -1000, true);
    view.setInt16(lastDelta + 2, 0, true);
    expect(decodeEvent(triangle).ok).toBe(false);
  });

  it('keeps reconstructed points inside the valid range near the pole', () => {
    const line = polygonAt({
      kind: 'polyline',
      points: [
        { lat: 89.99, lon: 0 },
        { lat: 89.999999999, lon: 0.000006 },
      ],
    });
    const decoded = decodeEvent(encodeOrFail(line));
    expect(decoded.ok).toBe(true);
  });
});

describe('member info', () => {
  const publicKey = Uint8Array.from({ length: 32 }, (_, i) => i);
  const member: TeselEvent = {
    type: 'member-info',
    origin: CAROL,
    seq: 1,
    time: T0,
    role: 'member',
    publicKey,
    alias: 'Carol',
  };

  it('refuses to encode a public key that does not match the origin', () => {
    expect(encodeEvent({ ...member, origin: ALICE }).ok).toBe(false);
  });

  it('rejects a received public key that does not match the origin', () => {
    const bytes = encodeOrFail(member);
    bytes[2] = 0x00; // change the origin
    expect(decodeEvent(bytes).ok).toBe(false);
  });

  it('reads a reserved role as member', () => {
    const bytes = encodeOrFail(member);
    bytes[14] = 9;
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value.type === 'member-info' && decoded.value.role).toBe('member');
  });
});

describe('reserved values and unknown types', () => {
  it('reads a reserved alert level as warning', () => {
    const bytes = encodeOrFail({
      type: 'alert',
      origin: ALICE,
      seq: 1,
      time: T0,
      level: 'info',
      text: 'x',
    });
    bytes[14] = 7;
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value.type === 'alert' && decoded.value.level).toBe('warning');
  });

  it('exposes the header of an unknown event type so bridges can forward it', () => {
    const bytes = encodeOrFail({ type: 'chat', origin: ALICE, seq: 42, time: T0, text: 'hi' });
    bytes[1] = 0x7f;
    expect(decodeEvent(bytes).ok).toBe(false);
    expect(peekHeader(bytes)).toEqual({
      ok: true,
      value: { typeCode: 0x7f, origin: ALICE, seq: 42, time: T0 },
    });
  });
});

describe('check-in timers', () => {
  it('matches the test vector computed from the spec', () => {
    const timer: TeselEvent = {
      type: 'check-in-timer',
      origin: ALICE,
      seq: 11,
      time: T0,
      minutes: 30,
    };
    expect(toHex(encodeOrFail(timer))).toBe('0112a1b2c3d40b0000000013fc681e00');
  });
});

describe('reports', () => {
  const report: TeselEvent = {
    type: 'report',
    origin: ALICE,
    seq: 10,
    time: T0,
    place: null,
    incident: 'collapse',
    hazards: ['gas', 'collapse'],
    access: 'blocked',
    casualties: { red: 2, yellow: null, green: 5, black: 0 },
    resources: ['rescue', 'machinery'],
    note: 'Bloque B',
  };

  it('matches the test vector computed from the spec', () => {
    // Kind 0, no place, incident 4, hazards bits 2 and 5 (0x0024), access 3, counts 2, 255, 5, 0,
    // resources bits 3 and 5 (0x0028).
    expect(toHex(encodeOrFail(report))).toBe(
      '0111a1b2c3d40a0000000013fc68' +
        '00000000000000000000' +
        '04240003' +
        '02ff0500' +
        '2800' +
        '426c6f7175652042',
    );
  });

  it('refuses a count of casualties above 254, and fits the longest note', () => {
    const casualties = { red: 255, yellow: 0, green: 0, black: 0 };
    expect(encodeEvent({ ...report, casualties }).ok).toBe(false);
    expect(encodeOrFail({ ...report, note: 'x'.repeat(119) }).length).toBe(MAX_EVENT_SIZE);
  });
});

describe('teams', () => {
  const team: TeselEvent = {
    type: 'team',
    origin: ALICE,
    seq: 9,
    time: T0,
    team: '5eed0001' as NodeId,
    colour: 'teal',
    dissolved: false,
    members: [ALICE, BOB],
    name: 'Sur',
  };

  it('matches the test vector computed from the spec', () => {
    expect(toHex(encodeOrFail(team))).toBe(
      '0110a1b2c3d4090000000013fc685eed0001020002a1b2c3d40f1e2d3c537572',
    );
  });

  it('refuses a team ID of 00000000 and a team without a name', () => {
    expect(encodeEvent({ ...team, team: '00000000' as NodeId }).ok).toBe(false);
    expect(encodeEvent({ ...team, name: '' }).ok).toBe(false);
  });

  it('holds 25 members with the longest name', () => {
    expect(TEAM_MAX_MEMBERS).toBe(25);
    const members = Array.from(
      { length: TEAM_MAX_MEMBERS },
      (_, index) => (0x10000000 + index).toString(16) as NodeId,
    );
    const full = { ...team, members, name: 'x'.repeat(32) };
    expect(encodeEvent(full).ok).toBe(true);
    expect(encodeEvent({ ...full, members: [...members, '7fffffff' as NodeId] }).ok).toBe(false);
  });
});

describe('member states', () => {
  const state: TeselEvent = {
    type: 'member-state',
    origin: ALICE,
    seq: 8,
    time: T0,
    profile: 'firefighters',
    status: 'active',
    battery: 64,
    equipment: ['first-aid', 'rope', 'weapon'],
  };

  it('matches the test vector computed from the spec', () => {
    // Profile 3, status 0, battery 64, bits 0, 6 and 12: 0x1041.
    expect(toHex(encodeOrFail(state))).toBe('010fa1b2c3d4080000000013fc6803004041100000');
  });

  it('reads reserved codes as their defaults, and unknown equipment as absent', () => {
    const bytes = encodeOrFail(state);
    bytes[14] = 99;
    bytes[15] = 7;
    bytes[16] = 101;
    bytes[20] = 0x80;
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value).toMatchObject({
      profile: 'unspecified',
      status: 'active',
      battery: null,
      equipment: ['first-aid', 'rope', 'weapon'],
    });
  });

  it('carries a linked LoRa radio in bit 13', () => {
    const linked = encodeOrFail({ ...state, equipment: ['lora'] });
    expect(toHex(linked.slice(17))).toBe('00200000');
    const decoded = decodeEvent(linked);
    expect(decoded.ok && decoded.value).toMatchObject({ equipment: ['lora'] });
  });

  it('carries the equipment added later in the higher bits', () => {
    const bytes = encodeOrFail({ ...state, equipment: ['four-by-four', 'megaphone'] });
    // Bits 14 and 25.
    expect(toHex(bytes.slice(17))).toBe('00400002');
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value).toMatchObject({ equipment: ['four-by-four', 'megaphone'] });
  });

  it('refuses a battery that is not a whole percent', () => {
    expect(encodeEvent({ ...state, battery: 101 }).ok).toBe(false);
    expect(encodeEvent({ ...state, battery: 50.5 }).ok).toBe(false);
  });
});

describe('sweeps', () => {
  const sweep: TeselEvent = {
    type: 'sweep',
    origin: ALICE,
    seq: 7,
    time: T0,
    object: { origin: ALICE, seq: 7 },
    area: { origin: BOB, seq: 3 },
    spacing: 25,
    heading: 135,
    strip: 1,
    strips: 3,
  };

  it('matches the test vector computed from the spec', () => {
    expect(toHex(encodeOrFail(sweep))).toBe(
      '010ea1b2c3d4070000000013fc68a1b2c3d4070000000f1e2d3c03000000190087000103',
    );
  });

  it('refuses lanes on top of one another, a heading of a full turn and a strip past the last', () => {
    expect(encodeEvent({ ...sweep, spacing: 0 }).ok).toBe(false);
    expect(encodeEvent({ ...sweep, heading: 180 }).ok).toBe(false);
    expect(encodeEvent({ ...sweep, strip: 3 }).ok).toBe(false);
  });

  it('discards a sweep whose strip is past the last', () => {
    const bytes = encodeOrFail(sweep);
    bytes[bytes.length - 2] = 3;
    expect(decodeEvent(bytes).ok).toBe(false);
  });
});

describe('tasks', () => {
  const task: TeselEvent = {
    type: 'task',
    origin: ALICE,
    seq: 1,
    time: T0,
    task: { origin: ALICE, seq: 1 },
    status: 'in-progress',
    assignee: null,
    place: null,
    text: 'x'.repeat(TASK_TEXT_MAX_BYTES),
  };
  const STATUS = 14 + 8;
  const PLACE = STATUS + 1 + 4;

  it('fills the event exactly with the longest text', () => {
    expect(encodeOrFail(task).length).toBe(MAX_EVENT_SIZE);
  });

  it('writes anyone and no place as zeros', () => {
    const bytes = encodeOrFail(task);
    expect(toHex(bytes.slice(STATUS + 1, PLACE + 9))).toBe('00'.repeat(13));
  });

  it('refuses an empty text', () => {
    expect(encodeEvent({ ...task, text: '' }).ok).toBe(false);
  });

  it('refuses to assign node ID 00000000, which means anyone', () => {
    expect(encodeEvent({ ...task, assignee: '00000000' as NodeId }).ok).toBe(false);
  });

  it('reads a reserved status as open', () => {
    const bytes = encodeOrFail(task);
    bytes[STATUS] = 9;
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value.type === 'task' && decoded.value.status).toBe('open');
  });

  it('writes an object place as kind 2 and the object reference', () => {
    const place = { kind: 'object', object: { origin: BOB, seq: 3 } } as const;
    const bytes = encodeOrFail({ ...task, text: 'x', place });
    expect(toHex(bytes.slice(PLACE, PLACE + 9))).toBe('020f1e2d3c03000000');
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value.type === 'task' && decoded.value.place).toEqual(place);
  });

  it('reads a reserved place kind as none, whatever its point holds', () => {
    const place = { kind: 'point', at: { lat: 41, lon: 2 } } as const;
    const bytes = encodeOrFail({ ...task, text: 'x', place });
    bytes[PLACE] = 7;
    const decoded = decodeEvent(bytes);
    expect(decoded.ok && decoded.value.type === 'task' && decoded.value.place).toBeNull();
  });
});

describe('input validation', () => {
  it('refuses a malformed node ID instead of encoding zeros', () => {
    const event: TeselEvent = {
      type: 'position-hidden',
      origin: 'zz' as NodeId,
      seq: 1,
      time: T0,
    };
    expect(encodeEvent(event).ok).toBe(false);
  });
});

describe('event types', () => {
  it('gives every type of §3.2 a layout, each under its own code', () => {
    const codes = EVENT_TYPES.map((type) => PAYLOADS[type].code);
    expect(codes).toEqual(Object.values(EventTypeCode));
  });

  it('round-trips a sample of every known type', () => {
    const sampled = new Set(SAMPLE_EVENTS.map((event) => event.type));
    expect([...sampled].sort()).toEqual([...EVENT_TYPES].sort());
  });
});

describe('order of rivals (§3.1)', () => {
  it('compares bytes as unsigned integers, a prefix first', () => {
    expect(compareBytes(hex('00ff'), hex('0100'))).toBeLessThan(0);
    expect(compareBytes(hex('80'), hex('7f'))).toBeGreaterThan(0);
    expect(compareBytes(hex('01'), hex('0100'))).toBeLessThan(0);
    expect(compareBytes(hex('0102'), hex('0102'))).toBe(0);
  });

  it('orders two events under one (origin, seq) by their encoding', () => {
    const chat = (text: string): TeselEvent => ({
      type: 'chat',
      origin: ALICE,
      seq: 3,
      time: T0,
      text,
    });
    expect(compareEncodings(chat('a'), chat('b'))).toBeLessThan(0);
    expect(compareEncodings(chat('b'), chat('a'))).toBeGreaterThan(0);
    expect(compareEncodings(chat('a'), chat('a'))).toBe(0);
    expect(Math.sign(compareEncodings(chat('a'), chat('b')))).toBe(
      Math.sign(compareBytes(encodeOrFail(chat('a')), encodeOrFail(chat('b')))),
    );
  });
});
