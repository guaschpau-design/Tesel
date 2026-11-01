// The contract between Tesel and a LoRa radio (ADR-0006). The app depends only on this; the
// MeshCore implementation is in meshcore-radio.ts. This module is the package's light entry
// (`@tesel/meshcore/link`): the app loads it at start, and the implementation, with the MeshCore
// library, only when a radio is connected.

export type RadioLinkState = 'disconnected' | 'connecting' | 'ready';

/** Whether this browser can reach a radio at all: links reach radios over Web Bluetooth. */
export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Why a link failed: no free channel slot, not connected, no answer in time, a command the radio
 * refused, or a radio this device has not paired with (its PIN was never given).
 */
export class RadioError extends Error {
  readonly code: 'no-free-channel' | 'not-ready' | 'timeout' | 'refused' | 'not-paired';

  constructor(code: RadioError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

export interface ReceivedFrame {
  /** Encoded event bytes, exactly as the sender produced them. */
  readonly bytes: Uint8Array;
  /** Signal-to-noise ratio of the last hop, in dB. */
  readonly snr: number;
  /**
   * The secret of the channel it arrived on: the group configured now, or another group whose
   * channel this radio still holds.
   */
  readonly secret: Uint8Array;
}

/**
 * A text message of another MeshCore app that reached this radio. Tesel reads every message the
 * radio holds, so it keeps these instead of losing them.
 */
export interface RadioText {
  /** A channel message, or a private one to this radio. */
  readonly kind: 'channel' | 'direct';
  /** Channel name, when known. */
  readonly channel: string | null;
  /** The sender's name (channels) or the start of their public key in hex (private). */
  readonly sender: string | null;
  readonly text: string;
  /** Seconds since the epoch, by the sender's clock. */
  readonly time: number;
}

export type SendOutcome =
  { readonly status: 'sent' } | { readonly status: 'failed'; readonly reason: string };

export interface RadioLink {
  readonly state: RadioLinkState;
  /** Name the radio advertises over Bluetooth, once connected. */
  readonly name: string | null;

  /**
   * Asks the user to pick a radio and connects to it. If the connection is lost afterwards, the
   * link reconnects to the same radio by itself, showing `connecting` meanwhile, until
   * `disconnect` is called.
   */
  connect(): Promise<void>;

  /**
   * Stores the group secret in a channel slot so the radio encrypts and decrypts our traffic.
   * Reuses a slot that already holds the secret; never overwrites another channel.
   */
  configureGroupChannel(groupName: string, secret: Uint8Array): Promise<void>;

  /** Clears every channel slot whose secret `matches`: those of groups that were left. */
  forgetChannels(matches: (secret: Uint8Array) => boolean): Promise<void>;

  /** Floods one encoded event on the group channel. */
  send(bytes: Uint8Array): Promise<SendOutcome>;

  /**
   * Subscribes to events received on any channel holding a secret, the group channel and those of
   * other groups this radio carried before; returns an unsubscribe function.
   */
  onReceive(listener: (frame: ReceivedFrame) => void): () => void;

  /** Subscribes to text messages of other MeshCore apps; returns an unsubscribe function. */
  onText(listener: (message: RadioText) => void): () => void;

  /** Subscribes to state changes; returns an unsubscribe function. */
  onStateChange(listener: (state: RadioLinkState) => void): () => void;

  disconnect(): Promise<void>;
}
