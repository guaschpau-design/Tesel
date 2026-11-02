// Event encoding and decoding (docs/protocol.md §3): the header here, the payload of each type in
// payloads.ts, and the field helpers in fields.ts.

import { ByteReader, ByteWriter, ProtocolFailure } from './bytes.ts';
import {
  MAX_DECODABLE_EVENT_SIZE,
  MAX_EVENT_SIZE,
  NODE_ID_SIZE,
  PROTOCOL_VERSION,
} from './constants.ts';
import type { EventHeader, TeselEvent } from './events.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';
import { payloadOf, payloadOfCode } from './payloads.ts';
import { err, ok, type ProtocolError, type Result } from './result.ts';

/** A decoded header plus the raw type code, which may belong to a type we do not know. */
export interface RawHeader extends EventHeader {
  readonly typeCode: number;
}

/**
 * Encodes an event. Fails if a field is out of range or the result exceeds MAX_EVENT_SIZE, the
 * room an event has once sealed for the radio (§2).
 */
export function encodeEvent(event: TeselEvent): Result<Uint8Array, ProtocolError> {
  return catchFailure(() => {
    const writer = new ByteWriter();
    const payload = payloadOf(event);
    writeHeader(writer, event, payload.code);
    payload.write(writer, event);
    if (writer.length > MAX_EVENT_SIZE) {
      throw new ProtocolFailure('too-large', `event is ${writer.length} bytes`);
    }
    return writer.toBytes();
  });
}

/**
 * Reads only the header. Works for event types this implementation does not know, so that
 * bridges can de-duplicate and forward them unchanged (§3.1).
 */
export function peekHeader(bytes: Uint8Array): Result<RawHeader, ProtocolError> {
  return catchFailure(() => readHeader(new ByteReader(bytes), bytes.length));
}

/** Decodes an event. Never throws, whatever the input. */
export function decodeEvent(bytes: Uint8Array): Result<TeselEvent, ProtocolError> {
  return catchFailure(() => {
    const reader = new ByteReader(bytes);
    const { typeCode, ...header } = readHeader(reader, bytes.length);
    const payload = payloadOfCode(typeCode);
    if (payload === undefined) {
      throw new ProtocolFailure('unknown-type', `type code 0x${typeCode.toString(16)}`);
    }
    const event = payload.read(reader, header);
    reader.end();
    return event;
  });
}

/**
 * Whether an event is worth keeping (§3.1): one of a known type that decodes, or one of a type
 * this version does not know, kept and forwarded unchanged. A known type that does not decode is
 * damaged and is dropped, so that it cannot stand in for the real event with its `(origin, seq)`.
 */
export function isKeepable(bytes: Uint8Array): boolean {
  const decoded = decodeEvent(bytes);
  return decoded.ok || decoded.error.code === 'unknown-type';
}

function catchFailure<T>(work: () => T): Result<T, ProtocolError> {
  try {
    return ok(work());
  } catch (failure) {
    if (failure instanceof ProtocolFailure) return err(failure.error);
    throw failure; // A programming error, not bad input: let it surface.
  }
}

// --- Header (§3.1) -----------------------------------------------------------------------

function writeHeader(writer: ByteWriter, event: TeselEvent, typeCode: number): void {
  if (event.seq < 1) throw new ProtocolFailure('invalid-value', 'seq must be at least 1');
  writer
    .u8(PROTOCOL_VERSION)
    .u8(typeCode)
    .raw(nodeIdToBytes(event.origin))
    .u32(event.seq)
    .u32(event.time);
}

/** Accepts events up to the larger size of those written before radio frames were sealed (§2). */
function readHeader(reader: ByteReader, totalLength: number): RawHeader {
  if (totalLength > MAX_DECODABLE_EVENT_SIZE) {
    throw new ProtocolFailure('too-large', `input is ${totalLength} bytes`);
  }
  const version = reader.u8();
  if (version !== PROTOCOL_VERSION) {
    throw new ProtocolFailure('unsupported-version', `version ${version}`);
  }
  const typeCode = reader.u8();
  const origin = nodeIdFromBytes(reader.raw(NODE_ID_SIZE));
  const seq = reader.u32();
  const time = reader.u32();
  if (seq < 1) throw new ProtocolFailure('invalid-value', 'seq must be at least 1');
  return { typeCode, origin, seq, time };
}
