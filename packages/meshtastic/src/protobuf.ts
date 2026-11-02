// A minimal Protocol Buffers wire codec, written from the public encoding rules
// (protobuf.dev/programming-guides/encoding). Meshtastic radios speak protobuf, and Meshtastic's
// own libraries are GPL, which Tesel's EUPL code cannot take (ADR-0098); a few messages need no
// more than this.
//
// Only what those messages use is supported: unsigned 32-bit varints (enums and booleans among
// them), 32-bit fixed fields (fixed32, sfixed32, float) and length-delimited fields (bytes,
// strings, messages). 64-bit fields are skipped when reading.

import type { Result } from '@tesel/protocol';

const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_BYTES = 2;
const WIRE_FIXED32 = 5;

/** The longest varint: a negative 64-bit value takes ten bytes. */
const MAX_VARINT_BYTES = 10;
const UINT32_MAX = 0xffffffff;

/** Writes fields in the order given; the caller leaves out those at their default value. */
export class ProtoWriter {
  readonly #bytes: number[] = [];

  /** An unsigned 32-bit integer, an enum or a boolean (0 or 1). */
  varint(field: number, value: number): this {
    this.#tag(field, WIRE_VARINT);
    this.#varint(value);
    return this;
  }

  /** A fixed32 or sfixed32: four bytes, little-endian. */
  fixed32(field: number, value: number): this {
    this.#tag(field, WIRE_FIXED32);
    const unsigned = value >>> 0;
    for (let shift = 0; shift < 32; shift += 8) this.#bytes.push((unsigned >>> shift) & 0xff);
    return this;
  }

  bytes(field: number, value: Uint8Array): this {
    this.#tag(field, WIRE_BYTES);
    this.#varint(value.length);
    this.#bytes.push(...value);
    return this;
  }

  string(field: number, value: string): this {
    return this.bytes(field, new TextEncoder().encode(value));
  }

  message(field: number, message: ProtoWriter): this {
    return this.bytes(field, message.finish());
  }

  finish(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }

  #tag(field: number, wire: number): void {
    this.#varint(field * 8 + wire);
  }

  #varint(value: number): void {
    // Callers write field numbers, enums, lengths and ids: never negative, never above 32 bits.
    if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
      throw new RangeError(`not an unsigned 32-bit integer: ${value}`);
    }
    let rest = value;
    while (rest >= 0x80) {
      this.#bytes.push((rest % 0x80) | 0x80);
      rest = Math.floor(rest / 0x80);
    }
    this.#bytes.push(rest);
  }
}

type Field =
  | { readonly wire: 'varint' | 'fixed32'; readonly value: number }
  | { readonly wire: 'bytes'; readonly value: Uint8Array };

/**
 * A decoded message: its fields by number, the last occurrence of each winning as protobuf says.
 * Reading a field as the wrong wire type gives `undefined`, as if it were absent.
 */
export class ProtoMessage {
  readonly #fields: ReadonlyMap<number, Field>;

  private constructor(fields: ReadonlyMap<number, Field>) {
    this.#fields = fields;
  }

  /** Splits `bytes` into fields; malformed input is an error, never an exception. */
  static parse(bytes: Uint8Array): Result<ProtoMessage, string> {
    const fields = new Map<number, Field>();
    const reader = new Reader(bytes);
    while (!reader.done) {
      const tag = reader.varint();
      if (tag === null) return { ok: false, error: 'truncated tag' };
      const number = Math.floor(tag / 8);
      if (number === 0) return { ok: false, error: 'field number 0' };
      const field = reader.field(tag % 8);
      if (field === 'skipped') continue;
      if (field === null) return { ok: false, error: `malformed field ${number}` };
      fields.set(number, field);
    }
    return { ok: true, value: new ProtoMessage(fields) };
  }

  /** An unsigned 32-bit integer or enum. */
  uint32(field: number): number | undefined {
    const found = this.#fields.get(field);
    return found?.wire === 'varint' ? found.value : undefined;
  }

  /** An int32: varints carry negative ones in two's complement. */
  int32(field: number): number | undefined {
    const value = this.uint32(field);
    return value === undefined ? undefined : value | 0;
  }

  bool(field: number): boolean | undefined {
    const value = this.uint32(field);
    return value === undefined ? undefined : value !== 0;
  }

  fixed32(field: number): number | undefined {
    const found = this.#fields.get(field);
    return found?.wire === 'fixed32' ? found.value : undefined;
  }

  sfixed32(field: number): number | undefined {
    const value = this.fixed32(field);
    return value === undefined ? undefined : value | 0;
  }

  float(field: number): number | undefined {
    const value = this.fixed32(field);
    if (value === undefined) return undefined;
    const view = new DataView(new ArrayBuffer(4));
    view.setUint32(0, value, true);
    return view.getFloat32(0, true);
  }

  bytes(field: number): Uint8Array | undefined {
    const found = this.#fields.get(field);
    return found?.wire === 'bytes' ? found.value : undefined;
  }

  /** A string; bytes that are not UTF-8 become replacement characters rather than an error. */
  string(field: number): string | undefined {
    const value = this.bytes(field);
    return value === undefined ? undefined : new TextDecoder().decode(value);
  }

  /** A nested message, or null if it is absent or malformed. */
  message(field: number): ProtoMessage | null {
    const value = this.bytes(field);
    if (value === undefined) return null;
    const parsed = ProtoMessage.parse(value);
    return parsed.ok ? parsed.value : null;
  }
}

class Reader {
  readonly #bytes: Uint8Array;
  #at = 0;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  get done(): boolean {
    return this.#at >= this.#bytes.length;
  }

  /** The low 32 bits of a varint of up to ten bytes, or null if it is cut short or too long. */
  varint(): number | null {
    let value = 0;
    for (let index = 0; index < MAX_VARINT_BYTES; index++) {
      const byte = this.#bytes[this.#at++];
      if (byte === undefined) return null;
      // Bits beyond the 32nd only matter to 64-bit fields, which Tesel does not read.
      if (index < 5) value += (byte & 0x7f) * 2 ** (7 * index);
      if (byte < 0x80) return value >>> 0;
    }
    return null;
  }

  /** The value of a field of `wire` type; 'skipped' for 64-bit ones, null if malformed. */
  field(wire: number): Field | 'skipped' | null {
    switch (wire) {
      case WIRE_VARINT: {
        const value = this.varint();
        return value === null ? null : { wire: 'varint', value };
      }
      case WIRE_FIXED32: {
        const bytes = this.#take(4);
        if (bytes === null) return null;
        const value = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
        return { wire: 'fixed32', value };
      }
      case WIRE_FIXED64:
        return this.#take(8) === null ? null : 'skipped';
      case WIRE_BYTES: {
        const length = this.varint();
        const value = length === null ? null : this.#take(length);
        return value === null ? null : { wire: 'bytes', value };
      }
      default:
        // Groups (3, 4) are long deprecated and unused by Meshtastic; 6 and 7 do not exist.
        return null;
    }
  }

  #take(length: number): Uint8Array | null {
    if (this.#at + length > this.#bytes.length) return null;
    const taken = this.#bytes.slice(this.#at, this.#at + length);
    this.#at += length;
    return taken;
  }
}
