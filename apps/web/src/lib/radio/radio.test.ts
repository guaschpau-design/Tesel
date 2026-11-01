import { encodeEvent, type NodeId, type TeselEvent } from '@tesel/protocol';
import type { LoraEvent } from '@tesel/core';
import 'fake-indexeddb/auto';

import {
  RadioError,
  type RadioLink,
  type RadioLinkState,
  type RadioText,
  type ReceivedFrame,
  type SendOutcome,
} from '@tesel/meshcore/link';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoraSink } from '../sync/lora-events.ts';
import { loadEvents } from '../events/event-log.ts';
import { createGroup } from '../groups/group.ts';
import { saveGroup } from '../groups/group-store.ts';
import { openAppDb } from '../storage/app-db.ts';
import { RadioSession, type RadioFeed } from './radio.svelte.ts';

const SECRET: Uint8Array = new Uint8Array(16).fill(1);

class FakeLink implements RadioLink {
  state: RadioLinkState = 'disconnected';
  name: string | null = null;
  channel: string | null = null;
  readonly sent: Uint8Array[] = [];
  readonly forgotten: Uint8Array[] = [];
  held: Uint8Array[] = [];
  #receive: ((frame: ReceivedFrame) => void) | null = null;
  #stateChange: ((state: RadioLinkState) => void) | null = null;
  #text: ((message: RadioText) => void) | null = null;

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

  send(bytes: Uint8Array): Promise<SendOutcome> {
    this.sent.push(bytes);
    return Promise.resolve({ status: 'sent' });
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
    return () => undefined;
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

class FakeFeed implements RadioFeed {
  sink: LoraSink | null = null;
  attached = 0;
  readonly received: Uint8Array[] = [];
  readonly aired: LoraEvent[] = [];
  readonly radioChannel = { name: 'Rescate', secret: SECRET };

  readonly groupId: string;

  constructor(groupId = 'rescate') {
    this.groupId = groupId;
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

const chat: TeselEvent = {
  type: 'chat',
  origin: 'a1b2c3d4' as NodeId,
  seq: 1,
  time: 1,
  text: 'hola',
};
const encoded = encodeEvent(chat);
const bytes = encoded.ok ? encoded.value : new Uint8Array();

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('radio session', () => {
  it('configures the active group’s channel once connected and sends its events', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(
      () => Promise.resolve(link),
      () => 0,
    );
    const feed = new FakeFeed();
    await radio.useFeed(feed);
    expect(feed.sink).toBeNull();

    await radio.connect();
    expect(radio.state).toBe('ready');
    expect(radio.linked).toBe(true);
    expect(link.channel).toBe('Rescate');

    feed.sink?.offer({ event: chat, bytes }, 'own');
    await vi.advanceTimersByTimeAsync(1000);
    expect(link.sent).toEqual([bytes]);
    expect(feed.aired).toEqual([chat]);
  });

  it('links the group again when a lost radio comes back, and says so meanwhile', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(
      () => Promise.resolve(link),
      () => 0,
    );
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    expect(feed.attached).toBe(1);
    link.dropAndReturn();
    await vi.advanceTimersByTimeAsync(0);
    expect(radio.linked).toBe(true);
    expect(radio.reconnecting).toBe(false);
    expect(feed.attached).toBe(2);
  });

  it('keeps what is queued when the same group’s feed opens again, as for a new alias', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(
      () => Promise.resolve(link),
      () => 0,
    );
    await radio.connect();
    const before = new FakeFeed('rescate');
    await radio.useFeed(before);
    before.sink?.offer({ event: chat, bytes }, 'own');
    await radio.useFeed(new FakeFeed('rescate'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(link.sent).toEqual([bytes]);
  });

  it('never sends what was queued for one group on another group’s channel', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(
      () => Promise.resolve(link),
      () => 0,
    );
    const first = new FakeFeed();
    await radio.connect();
    await radio.useFeed(first);
    // Queued, but the 1 s pump has not run yet when the user switches groups.
    first.sink?.offer({ event: chat, bytes }, 'own');
    await radio.useFeed(new FakeFeed('otro'));
    await vi.advanceTimersByTimeAsync(5000);
    expect(link.sent).toEqual([]);
  });

  it('hands what it hears to the feed', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(() => Promise.resolve(link));
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    link.hear(bytes);
    expect(feed.received).toEqual([bytes]);
    expect(radio.lastSnr).toBe(7.5);
  });

  it('keeps MeshCore text messages across restarts', async () => {
    vi.useRealTimers();
    const db = await openAppDb('radio-session-texts');
    const link = new FakeLink();
    const radio = new RadioSession(() => Promise.resolve(link));
    await radio.useStorage(db);
    await radio.connect();
    link.say({ kind: 'channel', channel: 'Public', sender: 'Marta', text: 'Hola', time: 1 });
    expect(radio.texts.map((text) => text.text)).toEqual(['Hola']);

    await vi.waitFor(async () => {
      const restarted = new RadioSession(() => Promise.resolve(new FakeLink()));
      await restarted.useStorage(db);
      expect(restarted.texts.map((text) => text.text)).toEqual(['Hola']);
    });
  });

  it('keeps what it hears on the channel of another of this device’s groups in that group’s log', async () => {
    vi.useRealTimers();
    const db = await openAppDb('radio-session-other-group');
    const other = createGroup('Antes', null, 1);
    await saveGroup(db, other);
    const link = new FakeLink();
    const radio = new RadioSession(() => Promise.resolve(link));
    await radio.useStorage(db);
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    link.hear(bytes, other.secret);
    await vi.waitFor(async () => {
      expect(await loadEvents(db, other.id)).toEqual([bytes]);
    });
    expect(feed.received).toEqual([]);
  });

  it('clears a left group’s channel from the radio the next time one is linked', async () => {
    vi.useRealTimers();
    const db = await openAppDb('radio-session-forget');
    const left = createGroup('Antes', null, 1);
    const link = new FakeLink();
    link.held = [left.secret];
    const radio = new RadioSession(() => Promise.resolve(link));
    await radio.useStorage(db);
    await radio.forgetGroup(left.secret);
    expect(link.forgotten).toEqual([]);
    await radio.connect();
    await radio.useFeed(new FakeFeed());
    expect(link.forgotten).toEqual([left.secret]);
  });

  it('says when this device is not paired with the radio, and when the picker was just closed', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(() => Promise.resolve(link));
    link.connect = () => Promise.reject(new RadioError('not-paired', 'pairing failed'));
    await radio.connect();
    expect(radio.problem).toBe('not-paired');
    link.connect = () => Promise.reject(new DOMException('User cancelled', 'NotFoundError'));
    await radio.connect();
    expect(radio.problem).toBeNull();
  });

  it('unlinks the feed when the radio goes away', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(() => Promise.resolve(link));
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    await radio.disconnect();
    expect(radio.linked).toBe(false);
    expect(feed.sink).toBeNull();
  });
});
