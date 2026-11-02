// The contract between Tesel and a LoRa radio (ADR-0006, ADR-0098). The app depends only on this;
// each kind of radio implements it in its own package: MeshCore companion radios in
// `packages/meshcore`, Meshtastic radios in `packages/meshtastic`. This package is light, so the
// app loads it at start, and a kind's implementation only when a radio of that kind is picked.

export type RadioLinkState = 'disconnected' | 'connecting' | 'ready';

/** The firmware a radio runs, which decides how Tesel talks to it. */
export type RadioFamily = 'meshcore' | 'meshtastic';

/** Whether this browser can reach a radio at all: links reach radios over Web Bluetooth. */
export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

/**
 * Why a link failed: no free channel, not connected, no answer in time, a command the radio
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
 * A text message of another app on the same radio network (MeshCore or Meshtastic chat) that
 * reached this radio. Tesel reads every message the radio holds, so it keeps these instead of
 * losing them.
 */
export interface RadioText {
  /** A channel message, or a private one to this radio. */
  readonly kind: 'channel' | 'direct';
  /** Channel name, when known. */
  readonly channel: string | null;
  /** The sender's name, or an identifier of the sender's radio in hex when it has none. */
  readonly sender: string | null;
  readonly text: string;
  /** Seconds since the epoch: when it was sent, by the sender's clock, or else when it was heard. */
  readonly time: number;
}

export type SendOutcome =
  { readonly status: 'sent' } | { readonly status: 'failed'; readonly reason: string };

export interface RadioLink {
  readonly family: RadioFamily;
  readonly state: RadioLinkState;
  /** Name the radio advertises over Bluetooth, once connected. */
  readonly name: string | null;

  /**
   * Connects to the radio this link was made for, which the user picked. If the connection is
   * lost afterwards, the link goes straight back to `connecting` (never through `disconnected`)
   * and reconnects to the same radio by itself, until `disconnect` is called, which may be done
   * while it reconnects.
   */
  connect(): Promise<void>;

  /**
   * Stores the group secret in one of the radio's channels so the radio encrypts and decrypts our
   * traffic. Reuses a channel that already holds the secret; never overwrites another channel.
   */
  configureGroupChannel(groupName: string, secret: Uint8Array): Promise<void>;

  /** Clears every channel whose secret `matches`: those of groups that were left. */
  forgetChannels(matches: (secret: Uint8Array) => boolean): Promise<void>;

  /** Floods one encoded event on the group channel. */
  send(bytes: Uint8Array): Promise<SendOutcome>;

  /**
   * How long sending an event of `eventBytes` bytes keeps the air busy, in milliseconds, with the
   * radio's settings as far as they are known: the airtime budget counts it (ADR-0015). Estimates
   * err on the long side.
   */
  airtimeMs(eventBytes: number): number;

  /**
   * Subscribes to events received on any channel holding a secret, the group channel and those of
   * other groups this radio carried before; returns an unsubscribe function.
   */
  onReceive(listener: (frame: ReceivedFrame) => void): () => void;

  /** Subscribes to text messages of other apps; returns an unsubscribe function. */
  onText(listener: (message: RadioText) => void): () => void;

  /** Subscribes to state changes; returns an unsubscribe function. */
  onStateChange(listener: (state: RadioLinkState) => void): () => void;

  disconnect(): Promise<void>;
}
