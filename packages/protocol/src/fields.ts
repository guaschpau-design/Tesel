// Payload field helpers shared by the payload layouts (payloads.ts): references, texts, measurements, enumerations and
// shape geometry (docs/protocol.md §1, §3).

import { ByteReader, ByteWriter, encodeUtf8, ProtocolFailure } from './bytes.ts';
import {
  ACCURACY_SIZE,
  EVENT_REF_SIZE,
  HEADER_SIZE,
  KIND_SIZE,
  MAX_CIRCLE_RADIUS_M,
  MAX_DECODABLE_EVENT_SIZE,
  MAX_EVENT_SIZE,
  NODE_ID_SIZE,
  PLACE_SIZE,
  PlaceCode,
  REPORT_FIXED_SIZE,
  POINT_SIZE,
  ShapeKindCode,
  SYMBOL_SIZE,
  UNKNOWN_U16,
} from './constants.ts';
import type { EventRef, NodeId, ShapeGeometry, Place } from './events.ts';
import { readPoint, readPointList, writePoint, writePointList } from './geometry.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';

// --- Text limits: each is the payload budget left after the type's fixed fields -----------

const PAYLOAD_BUDGET = MAX_EVENT_SIZE - HEADER_SIZE;

export const CHAT_MAX_BYTES = PAYLOAD_BUDGET; // §3.5
export const MARKER_LABEL_MAX_BYTES = PAYLOAD_BUDGET - EVENT_REF_SIZE - SYMBOL_SIZE - POINT_SIZE; // §3.6
export const SOS_TEXT_MAX_BYTES = PAYLOAD_BUDGET - KIND_SIZE - POINT_SIZE - ACCURACY_SIZE; // §3.8
export const ALERT_TEXT_MAX_BYTES = PAYLOAD_BUDGET - KIND_SIZE; // §3.9
export const TASK_TEXT_MAX_BYTES =
  PAYLOAD_BUDGET - EVENT_REF_SIZE - KIND_SIZE - NODE_ID_SIZE - KIND_SIZE - PLACE_SIZE; // §3.11
export const ROLL_CALL_TEXT_MAX_BYTES = PAYLOAD_BUDGET; // §3.12
export const REPORT_NOTE_MAX_BYTES = PAYLOAD_BUDGET - REPORT_FIXED_SIZE; // §3.16

/**
 * The longest text a decoder accepts in a field limited above: events written before radio frames
 * were sealed had the larger budget of MAX_DECODABLE_EVENT_SIZE, and still decode (§2).
 */
export function readableMaxBytes(maxBytes: number): number {
  return maxBytes + MAX_DECODABLE_EVENT_SIZE - MAX_EVENT_SIZE;
}

// --- Enumerations ------------------------------------------------------------------------
// Each value's code is written out in constants.ts (RoleCode and the like), never taken from an
// order: reordering a list must not change the wire format.

/** The code of an enumerated value; a value the protocol does not define is refused. */
export function enumCode<T extends string>(
  codes: Readonly<Record<T, number>>,
  value: T,
  field: string,
): number {
  if (!isValueOf(codes, value)) throw new ProtocolFailure('invalid-value', `unknown ${field}`);
  return codes[value];
}

/** The value of a code, or the field's default for a reserved code (§3.1). */
export function enumValue<T extends string>(
  codes: Readonly<Record<T, number>>,
  code: number,
  fallback: T,
): T {
  for (const value of Object.keys(codes)) {
    if (isValueOf(codes, value) && codes[value] === code) return value;
  }
  return fallback;
}

function isValueOf<T extends string>(codes: Readonly<Record<T, number>>, key: string): key is T {
  return Object.hasOwn(codes, key);
}

// --- References --------------------------------------------------------------------------

export function writeRef(writer: ByteWriter, ref: EventRef): void {
  if (ref.seq < 1) throw new ProtocolFailure('invalid-value', 'reference seq must be at least 1');
  writer.raw(nodeIdToBytes(ref.origin)).u32(ref.seq);
}

export function readRef(reader: ByteReader): EventRef {
  const origin = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
  const seq = reader.u32();
  if (seq < 1) throw new ProtocolFailure('invalid-value', 'reference seq must be at least 1');
  return { origin, seq };
}

// --- Assignee and place (§3.11) ----------------------------------------------------------

const ANYONE = new Uint8Array(NODE_ID_SIZE);
const ANYONE_ID = nodeIdFromBytes(ANYONE);

/** Writes a node ID, or all zeros for anyone. */
export function writeAssignee(writer: ByteWriter, assignee: NodeId | null): void {
  if (assignee === ANYONE_ID) {
    throw new ProtocolFailure(
      'invalid-value',
      'node ID 00000000 means anyone and cannot be assigned',
    );
  }
  writer.raw(assignee === null ? ANYONE : nodeIdToBytes(assignee));
}

export function readAssignee(reader: ByteReader): NodeId | null {
  const id = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
  return id === ANYONE_ID ? null : id;
}

/** Writes the place kind and its point or object reference, zeros for none. */
export function writePlace(writer: ByteWriter, place: Place | null): void {
  if (place === null) {
    writer.u8(PlaceCode.NONE).raw(new Uint8Array(PLACE_SIZE));
    return;
  }
  switch (place.kind) {
    case 'point':
      writer.u8(PlaceCode.POINT);
      writePoint(writer, place.at);
      return;
    case 'object':
      writer.u8(PlaceCode.OBJECT);
      writeRef(writer, place.object);
      return;
  }
}

/** Reads the place; a reserved kind reads as none and what follows it is skipped. */
export function readPlace(reader: ByteReader): Place | null {
  switch (reader.u8()) {
    case PlaceCode.POINT:
      return { kind: 'point', at: readPoint(reader) };
    case PlaceCode.OBJECT:
      return { kind: 'object', object: readRef(reader) };
    default:
      reader.raw(PLACE_SIZE);
      return null;
  }
}

// --- Sets of flags (§3.14) ----------------------------------------------------------------

/** Writes a set as a u16 or u32 of bits, each value at its bit. */
export function writeFlags<T extends string>(
  writer: ByteWriter,
  bits: Readonly<Record<T, number>>,
  values: readonly T[],
  size: 2 | 4,
): void {
  const flags = values.reduce((all, value) => (all | (1 << bits[value])) >>> 0, 0);
  if (size === 2) writer.u16(flags);
  else writer.u32(flags);
}

/** Reads a u16 or u32 of bits as the set of values whose bits are on, in the order of their bits. */
export function readFlags<T extends string>(
  reader: ByteReader,
  bits: Readonly<Record<T, number>>,
  size: 2 | 4,
): T[] {
  const flags = size === 2 ? reader.u16() : reader.u32();
  return (Object.keys(bits) as T[])
    .filter((value) => (flags & (1 << bits[value])) !== 0)
    .sort((a, b) => bits[a] - bits[b]);
}

// --- Text --------------------------------------------------------------------------------

export function writeTextRest(
  writer: ByteWriter,
  text: string,
  minBytes: number,
  maxBytes: number,
  field: string,
): void {
  const data = encodeUtf8(text);
  if (data.length > maxBytes) {
    throw new ProtocolFailure('too-large', `${field} is ${data.length} bytes, maximum ${maxBytes}`);
  }
  if (data.length < minBytes) {
    throw new ProtocolFailure('invalid-value', `${field} needs at least ${minBytes} bytes`);
  }
  writer.raw(data);
}

// --- Measurements ------------------------------------------------------------------------

/**
 * A non-negative measurement stored as u16 in `1/scale` of its unit, saturating just below the
 * "unknown" marker so that a huge value is never mistaken for an unknown one.
 */
export function writeMeasurement(writer: ByteWriter, value: number | null, scale: number): void {
  if (value === null) {
    writer.u16(UNKNOWN_U16);
    return;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new ProtocolFailure('invalid-value', `measurement ${String(value)}`);
  }
  writer.u16(Math.min(Math.round(value * scale), UNKNOWN_U16 - 1));
}

export function readMeasurement(reader: ByteReader, scale: number): number | null {
  const raw = reader.u16();
  return raw === UNKNOWN_U16 ? null : raw / scale;
}

// --- Shape geometry (§3.7) ---------------------------------------------------------------

export function shapeKindCode(geometry: ShapeGeometry): number {
  switch (geometry.kind) {
    case 'polyline':
      return ShapeKindCode.POLYLINE;
    case 'polygon':
      return ShapeKindCode.POLYGON;
    case 'circle':
      return ShapeKindCode.CIRCLE;
  }
}

export function writeGeometry(writer: ByteWriter, geometry: ShapeGeometry): void {
  switch (geometry.kind) {
    case 'polyline':
      requireCount(geometry.points.length, 2, 'polyline');
      writePointList(writer, geometry.points, false);
      return;
    case 'polygon':
      requireCount(geometry.points.length, 3, 'polygon');
      writePointList(writer, geometry.points, true);
      return;
    case 'circle': {
      const radius = Math.round(geometry.radius);
      requireRadius(radius);
      writePoint(writer, geometry.center);
      writer.u32(radius);
      return;
    }
  }
}

/** §3.7: a reserved shape kind cannot be parsed, so the event is rejected. */
export function readGeometry(reader: ByteReader, kindCode: number): ShapeGeometry {
  switch (kindCode) {
    case ShapeKindCode.POLYLINE:
      return { kind: 'polyline', points: readPointList(reader, 2, false) };
    case ShapeKindCode.POLYGON:
      return { kind: 'polygon', points: readPointList(reader, 3, true) };
    case ShapeKindCode.CIRCLE: {
      const center = readPoint(reader);
      const radius = reader.u32();
      requireRadius(radius);
      return { kind: 'circle', center, radius };
    }
    default:
      throw new ProtocolFailure('invalid-value', `shape kind ${kindCode}`);
  }
}

/** §3.7: a circle's radius is from 1 m to MAX_CIRCLE_RADIUS_M, in whole metres. */
function requireRadius(radius: number): void {
  if (!(radius >= 1 && radius <= MAX_CIRCLE_RADIUS_M)) {
    throw new ProtocolFailure(
      'invalid-value',
      `circle radius must be 1 to ${String(MAX_CIRCLE_RADIUS_M)} m`,
    );
  }
}

function requireCount(count: number, min: number, kind: string): void {
  if (count < min) throw new ProtocolFailure('invalid-value', `${kind} needs ${min}+ points`);
}
