// Identity, group key derivation, internet envelopes and sealed radio frames (docs/protocol.md §1,
// §3.3, §5).

import { ctr, gcm } from '@noble/ciphers/aes.js';
import { equalBytes } from '@noble/ciphers/utils.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';

import { ByteWriter, encodeUtf8 } from './bytes.ts';
import {
  AES_BLOCK_SIZE,
  CONTENT_KEY_SIZE,
  ENVELOPE_NONCE_SIZE,
  ENVELOPE_TAG_SIZE,
  EVENT_KEY_MAC_KEY_SIZE,
  EVENT_KEY_SIZE,
  GROUP_ID_SIZE,
  GROUP_SECRET_SIZE,
  KDF_INFO_CONTENT_KEY,
  KDF_INFO_EVENT_KEY,
  KDF_INFO_NONCE_KEY,
  KDF_INFO_GROUP_ID,
  KDF_INFO_RADIO_KEY,
  KDF_INFO_RADIO_MAC_KEY,
  KDF_SALT,
  NONCE_KEY_SIZE,
  MAX_DECODABLE_EVENT_SIZE,
  MAX_ENVELOPE_SIZE,
  MAX_EVENT_SIZE,
  MAX_RADIO_PAYLOAD,
  NODE_ID_SIZE,
  PUBLIC_KEY_SIZE,
  RADIO_KEY_SIZE,
  RADIO_MAC_KEY_SIZE,
  RADIO_SEAL_SIZE,
  SECRET_KEY_SIZE,
} from './constants.ts';
import type { EventRef, NodeId } from './events.ts';
import { nodeIdFromBytes, nodeIdToBytes } from './node-id.ts';

/** Source of cryptographically secure random bytes; injectable so tests are deterministic. */
export type RandomSource = (length: number) => Uint8Array;

const secureRandom: RandomSource = (length) => randomBytes(length);

// --- Identity ----------------------------------------------------------------------------

export interface Identity {
  readonly nodeId: NodeId;
  readonly publicKey: Uint8Array;
  /** Never leaves the device. */
  readonly secretKey: Uint8Array;
}

export function generateIdentity(random: RandomSource = secureRandom): Identity {
  const secretKey = random(SECRET_KEY_SIZE);
  const publicKey = ed25519.getPublicKey(secretKey);
  return { nodeId: nodeIdFromPublicKey(publicKey), publicKey, secretKey };
}

/** §1 The node ID is the first 4 bytes of SHA-256 of the Ed25519 public key. */
export function nodeIdFromPublicKey(publicKey: Uint8Array): NodeId {
  if (publicKey.length !== PUBLIC_KEY_SIZE) {
    throw new RangeError(`an Ed25519 public key is ${PUBLIC_KEY_SIZE} bytes`);
  }
  return nodeIdFromBytes(sha256(publicKey).slice(0, NODE_ID_SIZE));
}

/**
 * §3.15 A new team ID: random bytes in the space of node IDs, never `00000000` and never one that
 * `taken` says a member or another team has.
 */
export function generateTeamId(
  taken: (id: NodeId) => boolean,
  random: RandomSource = secureRandom,
): NodeId {
  for (;;) {
    const id = nodeIdFromBytes(random(NODE_ID_SIZE));
    if (id !== '00000000' && !taken(id)) return id;
  }
}

// --- Group keys --------------------------------------------------------------------------

export interface GroupKeys {
  /** The group secret itself; also the MeshCore channel key. */
  readonly secret: Uint8Array;
  /** Public routing identifier for servers. */
  readonly groupId: Uint8Array;
  readonly contentKey: Uint8Array;
  readonly eventKeyMacKey: Uint8Array;
  /** Derives each envelope's nonce from its event (§5.1). */
  readonly nonceKey: Uint8Array;
  /**
   * Encrypt radio frames and derive their synthetic IVs (§5.2). Keys of their own, so the
   * radio's keystream never meets that of the envelopes, whose nonces are derived the same way.
   */
  readonly radioKey: Uint8Array;
  readonly radioMacKey: Uint8Array;
}

export function generateGroupSecret(random: RandomSource = secureRandom): Uint8Array {
  return random(GROUP_SECRET_SIZE);
}

/** §5 Derives every group value from the 16-byte secret. */
export function deriveGroupKeys(secret: Uint8Array): GroupKeys {
  if (secret.length !== GROUP_SECRET_SIZE) {
    throw new RangeError(`a group secret is ${GROUP_SECRET_SIZE} bytes`);
  }
  const salt = encodeUtf8(KDF_SALT);
  const derive = (info: string, length: number): Uint8Array =>
    hkdf(sha256, secret, salt, encodeUtf8(info), length);
  return {
    secret: secret.slice(),
    groupId: derive(KDF_INFO_GROUP_ID, GROUP_ID_SIZE),
    contentKey: derive(KDF_INFO_CONTENT_KEY, CONTENT_KEY_SIZE),
    eventKeyMacKey: derive(KDF_INFO_EVENT_KEY, EVENT_KEY_MAC_KEY_SIZE),
    nonceKey: derive(KDF_INFO_NONCE_KEY, NONCE_KEY_SIZE),
    radioKey: derive(KDF_INFO_RADIO_KEY, RADIO_KEY_SIZE),
    radioMacKey: derive(KDF_INFO_RADIO_MAC_KEY, RADIO_MAC_KEY_SIZE),
  };
}

/** §5 Opaque de-duplication key the server stores alongside an envelope. */
export function eventKey(keys: GroupKeys, ref: EventRef): Uint8Array {
  const message = new ByteWriter().raw(nodeIdToBytes(ref.origin)).u32(ref.seq).toBytes();
  return hmac(sha256, keys.eventKeyMacKey, message).slice(0, EVENT_KEY_SIZE);
}

// --- Envelopes ---------------------------------------------------------------------------

/**
 * §5.1 Encrypts an encoded event for the internet transport. The nonce is derived from the event,
 * so sealing the same event again gives the same envelope, which a server stores once. Events
 * written before radio frames were sealed, larger than encoders write now, are sealed too.
 */
export function sealEnvelope(keys: GroupKeys, event: Uint8Array): Uint8Array {
  if (event.length > MAX_DECODABLE_EVENT_SIZE) {
    throw new RangeError(
      `events are at most ${MAX_DECODABLE_EVENT_SIZE} bytes; encode with encodeEvent`,
    );
  }
  const nonce = hmac(sha256, keys.nonceKey, event).slice(0, ENVELOPE_NONCE_SIZE);
  const ciphertext = gcm(keys.contentKey, nonce, keys.groupId).encrypt(event);
  const envelope = new Uint8Array(nonce.length + ciphertext.length);
  envelope.set(nonce, 0);
  envelope.set(ciphertext, nonce.length);
  return envelope;
}

/** §5.1 Decrypts an envelope; returns null if it is malformed or was not sealed with these keys. */
export function openEnvelope(keys: GroupKeys, envelope: Uint8Array): Uint8Array | null {
  if (
    envelope.length > MAX_ENVELOPE_SIZE ||
    envelope.length < ENVELOPE_NONCE_SIZE + ENVELOPE_TAG_SIZE
  ) {
    return null;
  }
  const nonce = envelope.subarray(0, ENVELOPE_NONCE_SIZE);
  const ciphertext = envelope.subarray(ENVELOPE_NONCE_SIZE);
  try {
    return gcm(keys.contentKey, nonce, keys.groupId).decrypt(ciphertext);
  } catch {
    return null;
  }
}

// --- Radio frames ------------------------------------------------------------------------

/**
 * §5.2 Seals an encoded event for the radio: a synthetic IV, the event's HMAC, followed by the
 * event encrypted in CTR mode from that IV. The same event always gives the same frame, as SOS
 * repeats and bridges expect. Returns null for an event too large for a frame: one written before
 * frames were sealed, which travels over the internet only.
 */
export function sealRadioFrame(keys: GroupKeys, event: Uint8Array): Uint8Array | null {
  if (event.length > MAX_EVENT_SIZE) return null;
  const siv = hmac(sha256, keys.radioMacKey, event).slice(0, RADIO_SEAL_SIZE);
  const frame = new Uint8Array(RADIO_SEAL_SIZE + event.length);
  frame.set(siv, 0);
  frame.set(ctr(keys.radioKey, counterBlock(siv)).encrypt(event), RADIO_SEAL_SIZE);
  return frame;
}

/**
 * §5.2 The event a radio frame carries; null if the frame was not sealed with these keys or was
 * changed on the way, which the receiver drops without a word.
 */
export function openRadioFrame(keys: GroupKeys, frame: Uint8Array): Uint8Array | null {
  if (frame.length <= RADIO_SEAL_SIZE || frame.length > MAX_RADIO_PAYLOAD) return null;
  const siv = frame.subarray(0, RADIO_SEAL_SIZE);
  const event = ctr(keys.radioKey, counterBlock(siv)).decrypt(frame.subarray(RADIO_SEAL_SIZE));
  const expected = hmac(sha256, keys.radioMacKey, event).subarray(0, RADIO_SEAL_SIZE);
  return equalBytes(expected, siv) ? event : null;
}

/**
 * The first counter block: the synthetic IV and a 32-bit counter from zero. A frame holds at most
 * 10 blocks, so the counter never carries into the IV.
 */
function counterBlock(siv: Uint8Array): Uint8Array {
  const block = new Uint8Array(AES_BLOCK_SIZE);
  block.set(siv, 0);
  return block;
}
