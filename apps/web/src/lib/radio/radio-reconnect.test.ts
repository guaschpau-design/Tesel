// The session with the real MeshCore link underneath, radios in memory: what the app does when the
// Bluetooth link drops and comes back by itself.

import 'fake-indexeddb/auto';

import {
  MeshCoreRadio,
  type ChannelInfo,
  type CompanionConnection,
  type OpenedRadio,
  type SyncedMessage,
} from '@tesel/meshcore';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { LoraSink } from '../sync/lora-events.ts';
import { RadioSession, type RadioFeed } from './radio.svelte.ts';

const SECRET = new Uint8Array(16).fill(1);
const EMPTY = new Uint8Array(16);

/** A radio in memory with a free slot; `drop` is the Bluetooth link going. */
class Radio implements CompanionConnection {
  readonly #listeners = new Map<string | number, Set<() => void>>();
  channels: ChannelInfo[] = [
    { channelIdx: 0, name: 'Public', secret: EMPTY },
    { channelIdx: 1, name: '', secret: EMPTY },
  ];

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
function opener(radios: Radio[]): () => Promise<OpenedRadio> {
  const open = (): Promise<OpenedRadio> => {
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

afterEach(() => {
  vi.useRealTimers();
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
});
