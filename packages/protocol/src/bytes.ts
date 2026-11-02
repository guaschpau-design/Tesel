// Little-endian byte reader and writer (docs/protocol.md §1).
//
// Inside this package, malformed input is signalled by throwing `ProtocolFailure`, which keeps
// field-by-field decoding code linear and readable. Every public entry point catches it and
// returns a `Result`, so callers outside the package never see an exception.

import { protocolError, type ProtocolError, type ProtocolErrorCode } from './result.ts';

export class ProtocolFailure extends Error {
  readonly error: ProtocolError;

  constructor(code: ProtocolErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.error = protocolError(code, detail);
  }
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }); // keep a leading U+FEFF: decoding must be lossless

/**
 * A text as UTF-8. Half of a surrogate pair cannot be written in UTF-8 and would silently become
 * U+FFFD, sending other text than was meant: it is refused instead.
 */
export function encodeUtf8(text: string): Uint8Array {
  if (/\p{Cs}/u.test(text)) {
    throw new ProtocolFailure('invalid-utf8', 'text holds half of a surrogate pair');
  }
  return utf8Encoder.encode(text);
}

/** Size of a text in UTF-8, which is what the protocol's text limits count. */
export function utf8ByteLength(text: string): number {
  return utf8Encoder.encode(text).length;
}

/** Whether two byte strings are the same: keys, group IDs, events. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, index) => byte === b[index]);
}

/**
 * Orders byte strings byte by byte, as unsigned integers; a string that is the start of another
 * comes first. Negative if `a` comes first, 0 only if they are equal.
 */
export function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index++) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return a.length - b.length;
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return utf8Decoder.decode(bytes);
  } catch {
    throw new ProtocolFailure('invalid-utf8', 'text field is not valid UTF-8');
  }
}

export class ByteWriter {
  readonly #bytes: number[] = [];

  u8(value: number): this {
    this.#checkInteger(value, 0, 0xff, 'u8');
    this.#bytes.push(value);
    return this;
  }

  u16(value: number): this {
    this.#checkInteger(value, 0, 0xffff, 'u16');
    this.#bytes.push(value & 0xff, value >>> 8);
    return this;
  }

  u32(value: number): this {
    this.#checkInteger(value, 0, 0xffffffff, 'u32');
    this.#bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, value >>> 24);
    return this;
  }

  i16(value: number): this {
    this.#checkInteger(value, -0x8000, 0x7fff, 'i16');
    return this.u16(value & 0xffff);
  }

  i32(value: number): this {
    this.#checkInteger(value, -0x80000000, 0x7fffffff, 'i32');
    return this.u32(value >>> 0);
  }

  raw(data: Uint8Array): this {
    for (const byte of data) this.#bytes.push(byte);
    return this;
  }

  /** A text-u8 field: one length byte, then the UTF-8 bytes. */
  textU8(text: string, minBytes: number, maxBytes: number, field: string): this {
    const data = encodeUtf8(text);
    if (data.length < minBytes || data.length > maxBytes) {
      throw new ProtocolFailure(
        'invalid-value',
        `${field} must be ${minBytes}-${maxBytes} bytes, got ${data.length}`,
      );
    }
    return this.u8(data.length).raw(data);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.#bytes);
  }

  #checkInteger(value: number, min: number, max: number, kind: string): void {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new ProtocolFailure('invalid-value', `${String(value)} does not fit in ${kind}`);
    }
  }
}

export class ByteReader {
  readonly #data: Uint8Array;
  #offset = 0;

  constructor(data: Uint8Array) {
    this.#data = data;
  }

  get remaining(): number {
    return this.#data.length - this.#offset;
  }

  u8(): number {
    return this.take(1)[0] ?? 0;
  }

  u16(): number {
    const b = this.take(2);
    return (b[0] ?? 0) | ((b[1] ?? 0) << 8);
  }

  u32(): number {
    const b = this.take(4);
    return ((b[0] ?? 0) | ((b[1] ?? 0) << 8) | ((b[2] ?? 0) << 16) | ((b[3] ?? 0) << 24)) >>> 0;
  }

  i16(): number {
    const value = this.u16();
    return value >= 0x8000 ? value - 0x10000 : value;
  }

  i32(): number {
    return this.u32() | 0;
  }

  raw(length: number): Uint8Array {
    return this.take(length).slice();
  }

  /** Everything left in the input. */
  rest(): Uint8Array {
    return this.raw(this.remaining);
  }

  /** A text-u8 field: one length byte, then the UTF-8 bytes. */
  textU8(minBytes: number, maxBytes: number, field: string): string {
    const length = this.u8();
    if (length < minBytes || length > maxBytes) {
      throw new ProtocolFailure('invalid-value', `${field} length ${length} out of range`);
    }
    return decodeUtf8(this.take(length));
  }

  /** A text-rest field: the remaining bytes as UTF-8. */
  textRest(minBytes: number, maxBytes: number, field: string): string {
    const length = this.remaining;
    if (length < minBytes || length > maxBytes) {
      throw new ProtocolFailure('invalid-value', `${field} length ${length} out of range`);
    }
    return decodeUtf8(this.take(length));
  }

  /** Fails unless the whole input has been consumed. */
  end(): void {
    if (this.remaining !== 0) {
      throw new ProtocolFailure('trailing-bytes', `${this.remaining} unexpected bytes at the end`);
    }
  }

  private take(length: number): Uint8Array {
    if (length > this.remaining) {
      throw new ProtocolFailure('truncated', `needed ${length} bytes, ${this.remaining} left`);
    }
    const slice = this.#data.subarray(this.#offset, this.#offset + length);
    this.#offset += length;
    return slice;
  }
}
