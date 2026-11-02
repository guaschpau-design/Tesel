// Byte vectors worked out by hand from the protobuf encoding rules, and checked against Google's
// protobuf library with Meshtastic's public message definitions.

import { describe, expect, it } from 'vitest';

import { decodeFromRadio, type FromRadio } from './from-radio.ts';
import { ProtoMessage, ProtoWriter } from './protobuf.ts';
import { setChannel, toRadioPacket, wantConfig } from './to-radio.ts';

const hex = (text: string): Uint8Array =>
  Uint8Array.from(text.split(' ').map((byte) => Number.parseInt(byte, 16)));

function fromRadio(text: string): FromRadio {
  const decoded = decodeFromRadio(hex(text));
  if (!decoded.ok) throw new Error(decoded.error);
  return decoded.value;
}

describe('the protobuf wire codec', () => {
  it('writes varints of up to 32 bits, little groups of seven bits first', () => {
    expect(new ProtoWriter().varint(1, 0).finish()).toEqual(hex('08 00'));
    expect(new ProtoWriter().varint(1, 300).finish()).toEqual(hex('08 ac 02'));
    expect(new ProtoWriter().varint(1, 0xffffffff).finish()).toEqual(hex('08 ff ff ff ff 0f'));
    expect(() => new ProtoWriter().varint(1, -1)).toThrow(RangeError);
  });

  it('writes field numbers above 15 with a tag of two bytes', () => {
    expect(new ProtoWriter().varint(33, 1).finish()).toEqual(hex('88 02 01'));
  });

  it('reads back what it writes, of every wire type it knows', () => {
    const nested = new ProtoWriter().string(1, 'ñ');
    const written = new ProtoWriter()
      .varint(1, 4_000_000_000)
      .fixed32(2, -37_630_000)
      .bytes(3, new Uint8Array([1, 2]))
      .message(4, nested)
      .finish();
    const parsed = ProtoMessage.parse(written);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.uint32(1)).toBe(4_000_000_000);
    expect(parsed.value.sfixed32(2)).toBe(-37_630_000);
    expect(parsed.value.bytes(3)).toEqual(new Uint8Array([1, 2]));
    expect(parsed.value.message(4)?.string(1)).toBe('ñ');
    // Asked as another type, a field reads as absent.
    expect(parsed.value.bytes(1)).toBeUndefined();
  });

  it('reads negative int32s in ten bytes, and skips 64-bit fields', () => {
    const parsed = ProtoMessage.parse(
      hex('08 ff ff ff ff ff ff ff ff ff 01 11 01 02 03 04 05 06 07 08'),
    );
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.value.int32(1)).toBe(-1);
    expect(parsed.value.uint32(2)).toBeUndefined();
  });

  it('turns malformed input into an error, never an exception', () => {
    expect(ProtoMessage.parse(hex('0a 05 01 02')).ok).toBe(false); // bytes cut short
    expect(ProtoMessage.parse(hex('08 ff')).ok).toBe(false); // varint cut short
    expect(ProtoMessage.parse(hex('0b 00')).ok).toBe(false); // a group, which nothing uses
    expect(ProtoMessage.parse(hex('00 01')).ok).toBe(false); // field number 0
    expect(ProtoMessage.parse(hex('08 ff ff ff ff ff ff ff ff ff ff 01')).ok).toBe(false);
  });
});

describe('what Tesel writes to a Meshtastic radio', () => {
  it('asks for the configuration with a nonce', () => {
    expect(wantConfig(0x12345678)).toEqual(hex('18 f8 ac d1 91 01'));
  });

  it('sends a packet to everyone on a channel, on Tesel’s port', () => {
    const packet = toRadioPacket({
      to: 0xffffffff,
      channel: 2,
      id: 0x01020304,
      hopLimit: 3,
      portnum: 256,
      payload: new Uint8Array([1, 2, 3]),
    });
    expect(packet).toEqual(
      hex('0a 18 15 ff ff ff ff 18 02 22 08 08 80 02 12 03 01 02 03 35 04 03 02 01 48 03'),
    );
  });

  it('sets a secondary channel with the group secret as its key', () => {
    const admin = setChannel({
      index: 1,
      role: 'secondary',
      psk: new Uint8Array(16).fill(9),
      name: 'Rescate',
    });
    expect(admin).toEqual(
      hex(
        '8a 02 21 08 01 12 1b 12 10 09 09 09 09 09 09 09 09 09 09 09 09 09 09 09 09 1a 07 52 65 73 63 61 74 65 18 02',
      ),
    );
  });
});

describe('what a Meshtastic radio tells Tesel', () => {
  it('reads its own node number', () => {
    expect(fromRadio('1a 06 08 d4 87 cb 8d 0a')).toEqual({
      kind: 'my-info',
      myNodeNum: 0xa1b2c3d4,
    });
  });

  it('reads a packet it heard, with its signal and time', () => {
    const message = fromRadio(
      '12 2a 0d fe ca ad 0b 15 ff ff ff ff 18 01 22 07 08 80 02 12 02 07 07 3d 00 d2 49 6b 45 00 00 c8 40 60 a6 ff ff ff ff ff ff ff ff 01',
    );
    expect(message).toEqual({
      kind: 'packet',
      packet: {
        from: 0x0badcafe,
        to: 0xffffffff,
        channel: 1,
        portnum: 256,
        payload: new Uint8Array([7, 7]),
        rxTime: 1_800_000_000,
        rxSnr: 6.25,
      },
    });
  });

  it('reads a node it knows: names, where it was and when it was heard', () => {
    const message = fromRadio(
      '22 28 08 fe 95 b7 5d 12 0b 12 05 4d 61 72 74 61 1a 02 4d 52 1a 0f 0d f8 a0 86 17 15 c8 94 c6 ff 25 00 d2 49 6b 2d 64 d2 49 6b',
    );
    if (message.kind !== 'node') throw new Error(message.kind);
    expect(message.node.num).toBe(0x0badcafe);
    expect(message.node.user).toEqual({ longName: 'Marta', shortName: 'MR' });
    expect(message.node.position?.latitude).toBeCloseTo(39.4699, 6);
    expect(message.node.position?.longitude).toBeCloseTo(-0.3763, 6);
    expect(message.node.position?.time).toBe(1_800_000_000);
    expect(message.node.lastHeard).toBe(1_800_000_100);
  });

  it('reads whether it took a packet into its queue', () => {
    expect(fromRadio('5a 12 08 ff ff ff ff ff ff ff ff ff 01 10 0f 20 84 86 88 08')).toEqual({
      kind: 'queue-status',
      packetId: 0x01020304,
      res: -1,
    });
  });

  it('reads its LoRa settings, its channels and the end of its configuration', () => {
    expect(fromRadio('2a 0a 32 08 08 01 10 04 38 03 40 05')).toEqual({
      kind: 'lora',
      lora: {
        usePreset: true,
        modemPreset: 4,
        bandwidth: 0,
        spreadFactor: 0,
        codingRate: 0,
        hopLimit: 5,
      },
    });
    expect(
      fromRadio(
        '52 1f 08 02 12 19 12 10 04 04 04 04 04 04 04 04 04 04 04 04 04 04 04 04 1a 05 41 6e 74 65 73 18 02',
      ),
    ).toEqual({
      kind: 'channel',
      channel: { index: 2, role: 'secondary', psk: new Uint8Array(16).fill(4), name: 'Antes' },
    });
    expect(fromRadio('38 f8 ac d1 91 01')).toEqual({ kind: 'config-complete', id: 0x12345678 });
  });

  it('lets go of what Tesel does not read', () => {
    // A log record (field 6).
    expect(fromRadio('32 02 0a 00')).toEqual({ kind: 'other' });
    expect(decodeFromRadio(hex('12 05 01')).ok).toBe(false);
  });
});
