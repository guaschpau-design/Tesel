// For tests: a radio link and a group feed in memory, around the radio session, and frames
// sealed as another device of the group seals them.

import type { LoraEvent } from '@tesel/core';
import { deriveGroupKeys, sealRadioFrame } from '@tesel/protocol';
import type {
  RadioFamily,
  RadioLink,
  RadioLinkState,
  RadioText,
  ReceivedFrame,
  SendOutcome,
} from '@tesel/radio';

import type { LoraSink } from '../sync/lora-events.ts';
import type { RadioFeed } from './radio.svelte.ts';

/** The secret of the group the fake feed carries. */
const SECRET: Uint8Array = new Uint8Array(16).fill(1);

/** A radio link in memory: it records what is sent and hears what a test says it hears. */
export class FakeLink implements RadioLink {
  readonly family: RadioFamily;
  state: RadioLinkState = 'disconnected';
  name: string | null = null;
  channel: string | null = null;
  readonly sent: Uint8Array[] = [];
  /** The secret of the channel each frame in `sent` went out on. */
  readonly sentOn: Uint8Array[] = [];
  /** The sizes the scheduler asked the airtime of, in bytes. */
  readonly weighed: number[] = [];
  readonly forgotten: Uint8Array[] = [];
  held: Uint8Array[] = [];
  #receive: ((frame: ReceivedFrame) => void) | null = null;
  #stateChange: ((state: RadioLinkState) => void) | null = null;
  #text: ((message: RadioText) => void) | null = null;

  constructor(family: RadioFamily = 'meshcore') {
    this.family = family;
  }

  connect(): Promise<void> {
    this.state = 'ready';
    this.name = 'MeshCore-T1000';
    this.#stateChange?.('ready');
    return Promise.resolve();
  }

  configureGroupChannel(name: string): Promise<void> {
    this.channel = name;
    return Promise.resolve();
  }

  forgetChannels(matches: (secret: Uint8Array) => boolean): Promise<void> {
    this.forgotten.push(...this.held.filter(matches));
    this.held = this.held.filter((secret) => !matches(secret));
    return Promise.resolve();
  }

  /** The Bluetooth link drops, then the radio is back. */
  dropAndReturn(): void {
    this.state = 'connecting';
    this.#stateChange?.('connecting');
    this.state = 'ready';
    this.#stateChange?.('ready');
  }

  send(bytes: Uint8Array, secret: Uint8Array): Promise<SendOutcome> {
    this.sent.push(bytes);
    this.sentOn.push(secret);
    return Promise.resolve({ status: 'sent' });
  }

  airtimeMs(frameBytes: number): number {
    this.weighed.push(frameBytes);
    return 1000;
  }

  onReceive(listener: (frame: ReceivedFrame) => void): () => void {
    this.#receive = listener;
    return () => undefined;
  }

  onStateChange(listener: (state: RadioLinkState) => void): () => void {
    this.#stateChange = listener;
    return () => undefined;
  }

  onText(listener: (message: RadioText) => void): () => void {
    this.#text = listener;
    return () => {
      this.#text = null;
    };
  }

  say(message: RadioText): void {
    this.#text?.(message);
  }

  disconnect(): Promise<void> {
    this.state = 'disconnected';
    this.#stateChange?.('disconnected');
    return Promise.resolve();
  }

  hear(bytes: Uint8Array, secret = SECRET): void {
    this.#receive?.({ bytes, snr: 7.5, secret });
  }
}

/** A group feed in memory: it records what the radio hands it and what went on the air. */
export class FakeFeed implements RadioFeed {
  sink: LoraSink | null = null;
  attached = 0;
  readonly received: Uint8Array[] = [];
  readonly aired: LoraEvent[] = [];
  readonly radioChannel: { readonly name: string; readonly secret: Uint8Array };
  readonly groupId: string;

  constructor(groupId = 'rescate', secret = SECRET) {
    this.groupId = groupId;
    this.radioChannel = { name: 'Rescate', secret };
  }

  attachRadio(sink: LoraSink | null): Promise<void> {
    this.sink = sink;
    if (sink !== null) this.attached++;
    return Promise.resolve();
  }

  radioSent(event: LoraEvent): Promise<void> {
    this.aired.push(event);
    return Promise.resolve();
  }

  receiveFromRadio(bytes: Uint8Array): Promise<void> {
    this.received.push(bytes);
    return Promise.resolve();
  }
}

/** `event` sealed for the radio with the keys of the group of `secret` (protocol §5.2). */
export function sealedFor(event: Uint8Array, secret = SECRET): Uint8Array {
  const frame = sealRadioFrame(deriveGroupKeys(secret), event);
  if (frame === null) throw new RangeError('the event is too large for a radio frame');
  return frame;
}
