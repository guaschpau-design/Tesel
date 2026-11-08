// The payload of every event type (docs/protocol.md §3.3–§3.18), each written next to the code
// that reads it, so that the two halves of a layout cannot drift apart. Adding an event type
// means adding its entry here: the record is keyed by every `EventType`, so the compiler refuses
// a type without a layout.

import { ByteReader, ByteWriter, ProtocolFailure } from './bytes.ts';
import {
  ACCURACY_SCALE,
  ALIAS_MAX_BYTES,
  ALIAS_MIN_BYTES,
  AlertLevelCode,
  DutyStatusCode,
  EquipmentBit,
  EventTypeCode,
  FULL_TURN_DEGREES,
  HALF_TURN_DEGREES,
  HazardBit,
  IncidentTypeCode,
  NODE_ID_SIZE,
  ProfileCode,
  PUBLIC_KEY_SIZE,
  REPORT_KIND_SITUATION,
  ResourceBit,
  RoleCode,
  SceneAccessCode,
  SHAPE_LABEL_MAX_BYTES,
  SosKindCode,
  SPEED_SCALE,
  TaskStatusCode,
  TEAM_NAME_MAX_BYTES,
  TeamColourCode,
  UNKNOWN_BATTERY,
  UNKNOWN_COUNT,
  UNKNOWN_U16,
  ZoneCrossingCode,
  ZoneKindCode,
} from './constants.ts';
import { nodeIdFromPublicKey } from './crypto.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';
import type { EventHeader, EventType, MemberInfoEvent, SweepEvent, TeselEvent } from './events.ts';
import {
  ALERT_TEXT_MAX_BYTES,
  CHAT_MAX_BYTES,
  enumCode,
  enumValue,
  MARKER_LABEL_MAX_BYTES,
  REPORT_NOTE_MAX_BYTES,
  readableMaxBytes,
  readAssignee,
  readFlags,
  readGeometry,
  readMeasurement,
  readPlace,
  readRef,
  shapeKindCode,
  SOS_TEXT_MAX_BYTES,
  ROLL_CALL_TEXT_MAX_BYTES,
  TASK_TEXT_MAX_BYTES,
  writeAssignee,
  writeFlags,
  writeGeometry,
  writeMeasurement,
  writePlace,
  writeRef,
  writeTextRest,
} from './fields.ts';
import { readPoint, writePoint } from './geometry.ts';

/** How one event type is laid out after the header. */
export interface PayloadCodec<E extends TeselEvent> {
  /** §3.2 type code. */
  readonly code: number;
  write(writer: ByteWriter, event: E): void;
  read(reader: ByteReader, header: EventHeader): E;
}

type EventOfType<K extends EventType> = Extract<TeselEvent, { readonly type: K }>;

export const PAYLOADS: { readonly [K in EventType]: PayloadCodec<EventOfType<K>> } = {
  // §3.3
  'member-info': {
    code: EventTypeCode.MEMBER_INFO,
    write(writer, event) {
      checkMemberKey(event);
      writer.u8(enumCode(RoleCode, event.role, 'role')).raw(event.publicKey);
      writeTextRest(writer, event.alias, ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
    },
    read(reader, header) {
      const role = enumValue(RoleCode, reader.u8(), 'member');
      const publicKey = reader.raw(PUBLIC_KEY_SIZE);
      const alias = reader.textRest(ALIAS_MIN_BYTES, ALIAS_MAX_BYTES, 'alias');
      const event: MemberInfoEvent = { ...header, type: 'member-info', role, publicKey, alias };
      checkMemberKey(event);
      return event;
    },
  },
  // §3.4
  position: {
    code: EventTypeCode.POSITION,
    write(writer, event) {
      writePoint(writer, event);
      writeMeasurement(writer, event.accuracy, ACCURACY_SCALE);
      writer.u16(
        event.heading === null ? UNKNOWN_U16 : Math.round(event.heading) % FULL_TURN_DEGREES,
      );
      writeMeasurement(writer, event.speed, SPEED_SCALE);
    },
    read(reader, header) {
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, ACCURACY_SCALE);
      const rawHeading = reader.u16();
      if (rawHeading !== UNKNOWN_U16 && rawHeading >= FULL_TURN_DEGREES) {
        throw new ProtocolFailure('invalid-value', `heading ${rawHeading}`);
      }
      const heading = rawHeading === UNKNOWN_U16 ? null : rawHeading;
      const speed = readMeasurement(reader, SPEED_SCALE);
      return { ...header, type: 'position', ...point, accuracy, heading, speed };
    },
  },
  // §3.4: empty payload
  'position-hidden': {
    code: EventTypeCode.POSITION_HIDDEN,
    write() {},
    read: (_reader, header) => ({ ...header, type: 'position-hidden' }),
  },
  // §3.5
  chat: {
    code: EventTypeCode.CHAT,
    write(writer, event) {
      writeTextRest(writer, event.text, 1, CHAT_MAX_BYTES, 'chat text');
    },
    read: (reader, header) => ({
      ...header,
      type: 'chat',
      text: reader.textRest(1, readableMaxBytes(CHAT_MAX_BYTES), 'chat text'),
    }),
  },
  // §3.6
  marker: {
    code: EventTypeCode.MARKER,
    write(writer, event) {
      writeRef(writer, event.object);
      writer.u16(event.symbol);
      writePoint(writer, event);
      writeTextRest(writer, event.label, 0, MARKER_LABEL_MAX_BYTES, 'marker label');
    },
    read(reader, header) {
      const object = readRef(reader);
      const symbol = reader.u16();
      const point = readPoint(reader);
      const label = reader.textRest(0, readableMaxBytes(MARKER_LABEL_MAX_BYTES), 'marker label');
      return { ...header, type: 'marker', object, symbol, ...point, label };
    },
  },
  // §3.7
  shape: {
    code: EventTypeCode.SHAPE,
    write(writer, event) {
      writeRef(writer, event.object);
      writer.u8(shapeKindCode(event.geometry)).u16(event.style);
      writer.textU8(event.label, 0, SHAPE_LABEL_MAX_BYTES, 'shape label');
      writeGeometry(writer, event.geometry);
    },
    read(reader, header) {
      const object = readRef(reader);
      const kindCode = reader.u8();
      const style = reader.u16();
      const label = reader.textU8(0, SHAPE_LABEL_MAX_BYTES, 'shape label');
      const geometry = readGeometry(reader, kindCode);
      return { ...header, type: 'shape', object, style, label, geometry };
    },
  },
  // §3.10: the object reference
  'object-delete': {
    code: EventTypeCode.OBJECT_DELETE,
    write(writer, event) {
      writeRef(writer, event.object);
    },
    read: (reader, header) => ({ ...header, type: 'object-delete', object: readRef(reader) }),
  },
  // §3.8
  sos: {
    code: EventTypeCode.SOS,
    write(writer, event) {
      writer.u8(enumCode(SosKindCode, event.kind, 'SOS kind'));
      writePoint(writer, event);
      writeMeasurement(writer, event.accuracy, ACCURACY_SCALE);
      writeTextRest(writer, event.text, 0, SOS_TEXT_MAX_BYTES, 'SOS text');
    },
    read(reader, header) {
      const kind = enumValue(SosKindCode, reader.u8(), 'general');
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, ACCURACY_SCALE);
      const text = reader.textRest(0, readableMaxBytes(SOS_TEXT_MAX_BYTES), 'SOS text');
      return { ...header, type: 'sos', kind, ...point, accuracy, text };
    },
  },
  // §3.2: the reference of the SOS being cancelled
  'sos-cancel': {
    code: EventTypeCode.SOS_CANCEL,
    write(writer, event) {
      writeRef(writer, event.sos);
    },
    read: (reader, header) => ({ ...header, type: 'sos-cancel', sos: readRef(reader) }),
  },
  // §3.9
  alert: {
    code: EventTypeCode.ALERT,
    write(writer, event) {
      writer.u8(enumCode(AlertLevelCode, event.level, 'alert level'));
      writeTextRest(writer, event.text, 1, ALERT_TEXT_MAX_BYTES, 'alert text');
    },
    read(reader, header) {
      const level = enumValue(AlertLevelCode, reader.u8(), 'warning');
      const text = reader.textRest(1, readableMaxBytes(ALERT_TEXT_MAX_BYTES), 'alert text');
      return { ...header, type: 'alert', level, text };
    },
  },
  // §3.2: the reference of the event acknowledged
  ack: {
    code: EventTypeCode.ACK,
    write(writer, event) {
      writeRef(writer, event.target);
    },
    read: (reader, header) => ({ ...header, type: 'ack', target: readRef(reader) }),
  },
  // §3.11
  task: {
    code: EventTypeCode.TASK,
    write(writer, event) {
      writeRef(writer, event.task);
      writer.u8(enumCode(TaskStatusCode, event.status, 'task status'));
      writeAssignee(writer, event.assignee);
      writePlace(writer, event.place);
      writeTextRest(writer, event.text, 1, TASK_TEXT_MAX_BYTES, 'task text');
    },
    read(reader, header) {
      const task = readRef(reader);
      const status = enumValue(TaskStatusCode, reader.u8(), 'open');
      const assignee = readAssignee(reader);
      const place = readPlace(reader);
      const text = reader.textRest(1, readableMaxBytes(TASK_TEXT_MAX_BYTES), 'task text');
      return { ...header, type: 'task', task, status, assignee, place, text };
    },
  },
  // §3.12
  'roll-call': {
    code: EventTypeCode.ROLL_CALL,
    write(writer, event) {
      writeTextRest(writer, event.text, 0, ROLL_CALL_TEXT_MAX_BYTES, 'roll call text');
    },
    read: (reader, header) => ({
      ...header,
      type: 'roll-call',
      text: reader.textRest(0, readableMaxBytes(ROLL_CALL_TEXT_MAX_BYTES), 'roll call text'),
    }),
  },
  // §3.13
  sweep: {
    code: EventTypeCode.SWEEP,
    write(writer, event) {
      checkSweep(event);
      writeRef(writer, event.object);
      writeRef(writer, event.area);
      writer.u16(event.spacing).u16(event.heading).u8(event.strip).u8(event.strips);
    },
    read(reader, header) {
      const sweep = {
        ...header,
        type: 'sweep',
        object: readRef(reader),
        area: readRef(reader),
        spacing: reader.u16(),
        heading: reader.u16(),
        strip: reader.u8(),
        strips: reader.u8(),
      } as const;
      checkSweep(sweep);
      return sweep;
    },
  },
  // §3.17
  'check-in-timer': {
    code: EventTypeCode.CHECK_IN_TIMER,
    write(writer, event) {
      writer.u16(event.minutes);
    },
    read: (reader, header) => ({ ...header, type: 'check-in-timer', minutes: reader.u16() }),
  },
  // §3.18
  'zone-crossing': {
    code: EventTypeCode.ZONE_CROSSING,
    write(writer, event) {
      writeRef(writer, event.zone);
      writer.u8(enumCode(ZoneCrossingCode, event.crossing, 'zone crossing'));
      writer.u8(enumCode(ZoneKindCode, event.kind, 'zone kind'));
      writePoint(writer, event);
      writeMeasurement(writer, event.accuracy, ACCURACY_SCALE);
    },
    read(reader, header) {
      const zone = readRef(reader);
      const crossing = enumValue(ZoneCrossingCode, reader.u8(), 'entered');
      const kind = enumValue(ZoneKindCode, reader.u8(), 'other');
      const point = readPoint(reader);
      const accuracy = readMeasurement(reader, ACCURACY_SCALE);
      return { ...header, type: 'zone-crossing', zone, crossing, kind, ...point, accuracy };
    },
  },
  // §3.16
  report: {
    code: EventTypeCode.REPORT,
    write(writer, event) {
      writer.u8(REPORT_KIND_SITUATION);
      writePlace(writer, event.place);
      writer.u8(enumCode(IncidentTypeCode, event.incident, 'incident type'));
      writeFlags(writer, HazardBit, event.hazards, 2, 'hazard');
      writer.u8(enumCode(SceneAccessCode, event.access, 'scene access'));
      for (const category of TRIAGE) writeCount(writer, event.casualties[category]);
      writeFlags(writer, ResourceBit, event.resources, 2, 'resource');
      writeTextRest(writer, event.note, 0, REPORT_NOTE_MAX_BYTES, 'report note');
    },
    read(reader, header) {
      reader.u8(); // The kind: every kind reads as a situation report so far.
      const place = readPlace(reader);
      const incident = enumValue(IncidentTypeCode, reader.u8(), 'other');
      const hazards = readFlags(reader, HazardBit, 2);
      const access = enumValue(SceneAccessCode, reader.u8(), 'unknown');
      const [red, yellow, green, black] = TRIAGE.map(() => readCount(reader));
      const casualties = {
        red: red ?? null,
        yellow: yellow ?? null,
        green: green ?? null,
        black: black ?? null,
      };
      const resources = readFlags(reader, ResourceBit, 2);
      const note = reader.textRest(0, readableMaxBytes(REPORT_NOTE_MAX_BYTES), 'report note');
      return {
        ...header,
        type: 'report',
        place,
        incident,
        hazards,
        access,
        casualties,
        resources,
        note,
      };
    },
  },
  // §3.15
  team: {
    code: EventTypeCode.TEAM,
    write(writer, event) {
      writeAssignee(writer, event.team);
      writer.u8(enumCode(TeamColourCode, event.colour, 'team colour'));
      writer.u8(event.dissolved ? 1 : 0);
      writer.u8(event.members.length);
      for (const member of event.members) writer.raw(nodeIdToBytes(member));
      writeTextRest(writer, event.name, 1, TEAM_NAME_MAX_BYTES, 'team name');
    },
    read(reader, header) {
      const team = readAssignee(reader);
      if (team === null) throw new ProtocolFailure('invalid-value', 'team ID cannot be 00000000');
      const colour = enumValue(TeamColourCode, reader.u8(), 'blue');
      const dissolved = reader.u8() === 1;
      const count = reader.u8();
      const members = Array.from({ length: count }, () =>
        nodeIdFromBytes(reader.raw(NODE_ID_SIZE)),
      );
      const name = reader.textRest(1, TEAM_NAME_MAX_BYTES, 'team name');
      return { ...header, type: 'team', team, colour, dissolved, members, name };
    },
  },
  // §3.14
  'member-state': {
    code: EventTypeCode.MEMBER_STATE,
    write(writer, event) {
      const { battery } = event;
      if (battery !== null && !(Number.isInteger(battery) && battery >= 0 && battery <= 100)) {
        throw new ProtocolFailure('invalid-value', 'battery must be a whole percent');
      }
      writer.u8(enumCode(ProfileCode, event.profile, 'profile'));
      writer.u8(enumCode(DutyStatusCode, event.status, 'duty status'));
      writer.u8(battery ?? UNKNOWN_BATTERY);
      writeFlags(writer, EquipmentBit, event.equipment, 4, 'equipment');
    },
    read: (reader, header) => ({
      ...header,
      type: 'member-state',
      profile: enumValue(ProfileCode, reader.u8(), 'unspecified'),
      status: enumValue(DutyStatusCode, reader.u8(), 'active'),
      battery: readBattery(reader.u8()),
      equipment: readFlags(reader, EquipmentBit, 4),
    }),
  },
};

/** §3.16 The triage categories, in the order of their counts. */
const TRIAGE = ['red', 'yellow', 'green', 'black'] as const;

/** §3.16 A count of casualties, up to 254; unknown as 255. */
function writeCount(writer: ByteWriter, count: number | null): void {
  if (count !== null && !(Number.isInteger(count) && count >= 0 && count < UNKNOWN_COUNT)) {
    throw new ProtocolFailure('invalid-value', 'casualty counts go from 0 to 254');
  }
  writer.u8(count ?? UNKNOWN_COUNT);
}

function readCount(reader: ByteReader): number | null {
  const count = reader.u8();
  return count === UNKNOWN_COUNT ? null : count;
}

/** §3.14 A battery level as a percent, or null when unknown or out of range. */
function readBattery(code: number): number | null {
  return code <= 100 ? code : null;
}

/** §3.13 The recipe of a sweep must make sense: lanes apart, a direction, a strip of those there are. */
function checkSweep(sweep: SweepEvent): void {
  if (sweep.spacing < 1)
    throw new ProtocolFailure('invalid-value', 'sweep spacing must be at least 1 m');
  if (sweep.heading >= HALF_TURN_DEGREES) {
    throw new ProtocolFailure('invalid-value', 'sweep heading must be below 180°');
  }
  if (sweep.strip >= sweep.strips) {
    throw new ProtocolFailure('invalid-value', 'sweep strip must be below the number of strips');
  }
}

/** Every event type this version knows, in type-code order. */
export const EVENT_TYPES: readonly EventType[] = (Object.keys(PAYLOADS) as EventType[]).sort(
  (a, b) => PAYLOADS[a].code - PAYLOADS[b].code,
);

const BY_CODE: ReadonlyMap<number, PayloadCodec<TeselEvent>> = new Map(
  EVENT_TYPES.map((type) => [PAYLOADS[type].code, PAYLOADS[type]]),
);

/**
 * The layout of an event's own type. TypeScript cannot relate a key of a mapped type to the
 * matching value once the key is a union, hence the assertion. It is safe: each entry of PAYLOADS
 * writes and reads exactly the events of its own key.
 */
export function payloadOf<E extends TeselEvent>(event: E): PayloadCodec<E> {
  return PAYLOADS[event.type] as PayloadCodec<E>;
}

/** The layout of a type code, or undefined for a type this version does not know. */
export function payloadOfCode(code: number): PayloadCodec<TeselEvent> | undefined {
  return BY_CODE.get(code);
}

/** §3.3: the public key must hash to the origin's node ID. */
function checkMemberKey(event: MemberInfoEvent): void {
  if (event.publicKey.length !== PUBLIC_KEY_SIZE) {
    throw new ProtocolFailure('invalid-value', 'public key must be 32 bytes');
  }
  if (nodeIdFromPublicKey(event.publicKey) !== event.origin) {
    throw new ProtocolFailure('invalid-value', 'public key does not match the origin node ID');
  }
}
