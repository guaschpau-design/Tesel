import { describe, expect, it } from 'vitest';
import { gcm } from '@noble/ciphers/aes.js';

import {
  MAX_DECODABLE_EVENT_SIZE,
  MAX_ENVELOPE_SIZE,
  MAX_EVENT_SIZE,
  MAX_RADIO_PAYLOAD,
  RADIO_SEAL_SIZE,
} from './constants.ts';
import {
  deriveGroupKeys,
  eventKey,
  generateIdentity,
  generateTeamId,
  nodeIdFromPublicKey,
  openEnvelope,
  openRadioFrame,
  sealEnvelope,
  sealRadioFrame,
} from './crypto.ts';
import { ALICE, hex, seededRandom, toHex } from './test-helpers.ts';

// Expected values below were computed with an independent Python implementation of the spec.
const SECRET = Uint8Array.from({ length: 16 }, (_, i) => i);

describe('team IDs', () => {
  it('draws again for 00000000 and for an ID already taken', () => {
    const draws = [
      [0, 0, 0, 0],
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ];
    const random = () => Uint8Array.from(draws.shift() ?? []);
    expect(generateTeamId((id) => id === '01020304', random)).toBe('05060708');
  });
});

describe('identity', () => {
  it('derives the node ID from the public key as the spec defines', () => {
    expect(nodeIdFromPublicKey(Uint8Array.from({ length: 32 }, (_, i) => i))).toBe('630dcd29');
  });

  it('generates an identity whose node ID matches its public key', () => {
    const identity = generateIdentity(seededRandom(7));
    expect(identity.publicKey.length).toBe(32);
    expect(identity.nodeId).toBe(nodeIdFromPublicKey(identity.publicKey));
  });
});

describe('group keys', () => {
  const keys = deriveGroupKeys(SECRET);

  it('derives the group ID, content key and event-key MAC key from the spec test vector', () => {
    expect(toHex(keys.groupId)).toBe('47399e7ce1a62403d2c0c2fe97c98b60');
    expect(toHex(keys.contentKey)).toBe(
      '9715137b9ca8878d3d3f0f2e80de0441c67ffbbe36262c7c32c754abce7309c2',
    );
    expect(toHex(keys.eventKeyMacKey)).toBe(
      'ccf754f08b3da4bbf80eaffe83d2f59f3446651ddfb8b04d27338b6a259629f5',
    );
  });

  it('computes event keys from the spec test vector', () => {
    expect(toHex(eventKey(keys, { origin: ALICE, seq: 1 }))).toBe(
      '9a04f3743bd327c9653a4b0883181451',
    );
  });

  it('gives different event keys to different events', () => {
    const a = toHex(eventKey(keys, { origin: ALICE, seq: 1 }));
    const b = toHex(eventKey(keys, { origin: ALICE, seq: 2 }));
    expect(a).not.toBe(b);
  });

  it('rejects a secret of the wrong size', () => {
    expect(() => deriveGroupKeys(new Uint8Array(15))).toThrow(RangeError);
  });
});

describe('envelopes', () => {
  const keys = deriveGroupKeys(SECRET);
  // As large as an event written before radio frames were sealed: those still travel this way.
  const event = Uint8Array.from({ length: MAX_DECODABLE_EVENT_SIZE }, (_, i) => i & 0xff);

  it('round-trips an event and stays within the size limit', () => {
    const envelope = sealEnvelope(keys, event);
    expect(envelope.length).toBe(MAX_ENVELOPE_SIZE);
    expect(openEnvelope(keys, envelope)).toEqual(event);
  });

  it('seals the same event into the same envelope, and other events with other nonces', () => {
    expect(toHex(sealEnvelope(keys, event))).toBe(toHex(sealEnvelope(keys, event)));
    const other = event.slice();
    other[0] = 0xff;
    const nonce = (envelope: Uint8Array) => toHex(envelope.subarray(0, 12));
    expect(nonce(sealEnvelope(keys, other))).not.toBe(nonce(sealEnvelope(keys, event)));
  });

  it('opens envelopes sealed with a random nonce, as earlier versions did', () => {
    const nonce = seededRandom(1)(12);
    const sealed = gcm(keys.contentKey, nonce, keys.groupId).encrypt(event);
    expect(openEnvelope(keys, Uint8Array.from([...nonce, ...sealed]))).toEqual(event);
  });

  it('refuses a tampered envelope', () => {
    const envelope = sealEnvelope(keys, event);
    envelope[20] = (envelope[20] ?? 0) ^ 1;
    expect(openEnvelope(keys, envelope)).toBeNull();
  });

  it('refuses an envelope sealed for another group', () => {
    const other = deriveGroupKeys(new Uint8Array(16).fill(9));
    expect(openEnvelope(other, sealEnvelope(keys, event))).toBeNull();
  });

  it('refuses envelopes that are too short or too long', () => {
    expect(openEnvelope(keys, new Uint8Array(10))).toBeNull();
    expect(openEnvelope(keys, new Uint8Array(MAX_ENVELOPE_SIZE + 1))).toBeNull();
  });

  it('refuses to seal an event larger than the protocol allows', () => {
    const keys = deriveGroupKeys(new Uint8Array(16));
    const tooLarge = new Uint8Array(MAX_DECODABLE_EVENT_SIZE + 1);
    expect(() => sealEnvelope(keys, tooLarge)).toThrow(RangeError);
  });
});

describe('radio frames', () => {
  const keys = deriveGroupKeys(SECRET);
  // The chat test vector of codec.test.ts: "Hola" from ALICE.
  const chat = hex('0104a1b2c3d4010000000013fc68486f6c61');
  const largest = Uint8Array.from({ length: MAX_EVENT_SIZE }, (_, i) => i & 0xff);

  function sealOrFail(event: Uint8Array): Uint8Array {
    const frame = sealRadioFrame(keys, event);
    if (frame === null) throw new Error('the event should fit a radio frame');
    return frame;
  }

  it('derives the radio keys from the spec test vector', () => {
    expect(toHex(keys.radioKey)).toBe(
      '8f6190993b81066d7e5228ba72d26c3fcf07cfbae9e5163db6ad9b8245815ba3',
    );
    expect(toHex(keys.radioMacKey)).toBe(
      'd1ab2c84971ed71eb7a29f33e8563561196a123c197fe278ed94b7c8d08c01bc',
    );
  });

  it('seals the spec test vector as an independent implementation does', () => {
    expect(toHex(sealOrFail(chat))).toBe(
      '84dd396abe8d9912086dd31e9a8247df5620923964ee97393acb3b269cc0',
    );
  });

  it('seals the largest event into the largest frame, ten blocks of keystream', () => {
    const frame = sealOrFail(largest);
    expect(frame.length).toBe(MAX_RADIO_PAYLOAD);
    expect(toHex(frame)).toBe(
      '2226a9183e525354fffa02b16a93b8734dbd385d11adcd56946a112599c2ec3b332f569ad91f25308dca6944d9c1a034c44d84c5ab05f36d390d24ed7a7288df49bc27e282f72c596f7bd153beb9cdb01b829691b85c59be786440c9c243acce35fb2ef24ad84b1ed1f028711d7dc63c97b192b64a845e44ed63f5f4fb9dba252bbf32b6e828e13080f7a2409ed8a3998a8cd578042d72424369e8c8ad295c3f829c9aed19',
    );
  });

  it('round-trips an event, adding only the seal', () => {
    for (const event of [chat, largest]) {
      const frame = sealOrFail(event);
      expect(frame.length).toBe(event.length + RADIO_SEAL_SIZE);
      expect(openRadioFrame(keys, frame)).toEqual(event);
    }
  });

  it('seals the same event into the same frame, and other events with other IVs', () => {
    expect(toHex(sealOrFail(chat))).toBe(toHex(sealOrFail(chat)));
    const other = chat.slice();
    other[6] = 2;
    const siv = (frame: Uint8Array) => toHex(frame.subarray(0, RADIO_SEAL_SIZE));
    expect(siv(sealOrFail(other))).not.toBe(siv(sealOrFail(chat)));
  });

  it('refuses a frame with any bit flipped, in the IV or in the ciphertext', () => {
    const frame = sealOrFail(chat);
    for (let bit = 0; bit < frame.length * 8; bit++) {
      const flipped = frame.slice();
      flipped[bit >> 3] = (flipped[bit >> 3] ?? 0) ^ (1 << (bit & 7));
      expect(openRadioFrame(keys, flipped)).toBeNull();
    }
  });

  it('refuses a frame sealed for another group, and an event sent unsealed', () => {
    const other = deriveGroupKeys(new Uint8Array(16).fill(9));
    expect(openRadioFrame(other, sealOrFail(chat))).toBeNull();
    expect(openRadioFrame(keys, chat)).toBeNull();
  });

  it('refuses frames too short to hold an event or too long for the radio', () => {
    expect(openRadioFrame(keys, sealOrFail(chat).subarray(0, RADIO_SEAL_SIZE))).toBeNull();
    expect(openRadioFrame(keys, new Uint8Array(MAX_RADIO_PAYLOAD + 1))).toBeNull();
  });

  it('leaves off the radio an event written before frames were sealed, too large for one', () => {
    expect(sealRadioFrame(keys, new Uint8Array(MAX_EVENT_SIZE + 1))).toBeNull();
  });
});
