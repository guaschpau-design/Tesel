// The session with the real MeshCore link underneath, radios in memory: what the app does when the
// Bluetooth link drops and comes back by itself.

import 'fake-indexeddb/auto';

import {
  MeshCoreRadio,
  type ChannelInfo,
  type CompanionConnection,
  type SyncedMessage,
} from '@tesel/meshcore';
import type { OpenedRadio } from '@tesel/radio';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoraSink } from '../sync/lora-events.ts';
import { RadioSession, type RadioFeed } from './radio.svelte.ts';

const SECRET = new Uint8Array(16).fill(1);
const EMPTY = new Uint8Array(16);

/**
 * A radio in memory with a free slot; `drop` is the Bluetooth link going. A busy one never answers
 * the first time it is asked for a channel.
 */
class Radio implements CompanionConnection {
  readonly #listeners = new Map<string | number, Set<() => void>>();
  #busy: boolean;
  channels: ChannelInfo[] = [
    { channelIdx: 0, name: 'Public', secret: EMPTY },
    { channelIdx: 1, name: '', secret: EMPTY },
  ];

  constructor(busy = false) {
    this.#busy = busy;
  }

  on(event: string | number, listener: () => void): void {
    this.#listeners.set(event, (this.#listeners.get(event) ?? new Set()).add(listener));
  }

  off(event: string | number, listener: () => void): void {
    this.#listeners.get(event)?.delete(listener);
  }

  drop(): void {
    for (const listener of this.#listeners.get('disconnected') ?? []) listener();
  }

  getChannel(index: number): Promise<ChannelInfo> {
    if (this.#busy) {
      this.#busy = false;
      return new Promise(() => undefined);
    }
    const channel = this.channels[index];
    // meshcore.js rejects with no reason when the radio answers ERR; the fake does the same.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return channel ? Promise.resolve(channel) : Promise.reject();
  }

  setChannel(index: number, name: string, secret: Uint8Array): Promise<void> {
    this.channels[index] = { channelIdx: index, name, secret };
    return Promise.resolve();
  }

  sendChannelData(): Promise<unknown> {
    return Promise.resolve({});
  }

  syncNextMessage(): Promise<SyncedMessage> {
    return Promise.resolve(null);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

/** Opens the radios in turn: the first on connecting, the next each time the link reopens. */
function opener(radios: Radio[]): () => Promise<OpenedRadio<CompanionConnection>> {
  const open = (): Promise<OpenedRadio<CompanionConnection>> => {
    const radio = radios.shift();
    if (radio === undefined) return Promise.reject(new Error('radio out of range'));
    return Promise.resolve({ connection: radio, name: 'MeshCore-Radio A', reopen: open });
  };
  return open;
}

class Feed implements RadioFeed {
  readonly groupId = 'rescate';
  readonly radioChannel = { name: 'Rescate', secret: SECRET };
  sink: LoraSink | null = null;
  links = 0;

  attachRadio(sink: LoraSink | null): Promise<void> {
    this.sink = sink;
    if (sink !== null) this.links++;
    return Promise.resolve();
  }

  radioSent(): Promise<void> {
    return Promise.resolve();
  }

  receiveFromRadio(): Promise<void> {
    return Promise.resolve();
  }
}

// Node 24, as CI runs, has the browser's window locks, which a test's radio would hold into the
// next one: each test is a window of its own, with no locks to hold.
beforeEach(() => {
  vi.stubGlobal('navigator', {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('a radio whose Bluetooth link drops and comes back', () => {
  it('is linked to the group again, its channel set, without the user doing anything', async () => {
    vi.useFakeTimers();
    const first = new Radio();
    const again = new Radio();
    const session = new RadioSession(() =>
      Promise.resolve(new MeshCoreRadio(opener([first, again]))),
    );
    const feed = new Feed();
    await session.useFeed(feed);
    await session.connect();
    expect(session.linked).toBe(true);
    first.drop();
    expect(session.reconnecting).toBe(true);
    await vi.advanceTimersByTimeAsync(1000);
    expect(session.state).toBe('ready');
    expect(session.linked).toBe(true);
    expect(feed.links).toBe(2);
    expect(feed.sink).not.toBeNull();
    expect(again.channels[1]?.secret).toEqual(SECRET);
    await session.disconnect();
  });

  it('is linked again after a command timed out while linking it, by itself', async () => {
    vi.useFakeTimers();
    const first = new Radio();
    const busy = new Radio(true);
    const third = new Radio();
    const session = new RadioSession(() =>
      Promise.resolve(new MeshCoreRadio(opener([first, busy, third]))),
    );
    const feed = new Feed();
    await session.useFeed(feed);
    await session.connect();
    first.drop();
    // Back on the busy radio: linking it times out, and the link is dropped and made again.
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(6000);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(session.state).toBe('ready');
    expect(session.linked).toBe(true);
    expect(session.problem).toBeNull();
    expect(feed.sink).not.toBeNull();
    expect(third.channels[1]?.secret).toEqual(SECRET);
    await session.disconnect();
  });
});

describe('a radio that does not answer while it is first linked', () => {
  it('is linked once it answers, without the user doing anything', async () => {
    vi.useFakeTimers();
    const busy = new Radio(true);
    const again = new Radio();
    const session = new RadioSession(() =>
      Promise.resolve(new MeshCoreRadio(opener([busy, again]))),
    );
    const feed = new Feed();
    await session.useFeed(feed);
    const connecting = session.connect();
    await vi.advanceTimersByTimeAsync(6000);
    await connecting;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(session.state).toBe('ready');
    expect(session.linked).toBe(true);
    expect(feed.sink).not.toBeNull();
    await session.disconnect();
  });
});
