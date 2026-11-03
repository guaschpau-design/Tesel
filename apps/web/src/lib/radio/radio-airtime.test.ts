import { LIMITS } from '@tesel/core';
import { encodeEvent, type NodeId, type TeselEvent } from '@tesel/protocol';
import 'fake-indexeddb/auto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { loadAirtime, saveAirtime } from './airtime-store.ts';
import { FakeFeed, FakeLink } from './fake-radio.ts';
import { claimRadio } from './radio-lock.ts';
import { RadioSession } from './radio.svelte.ts';

/** A chat line of this device, as the feed offers it to the radio. */
function chat(seq: number): { event: TeselEvent; bytes: Uint8Array } {
  const event: TeselEvent = {
    type: 'chat',
    origin: 'a1b2c3d4' as NodeId,
    seq,
    time: 1,
    text: 'hola',
  };
  const bytes = encodeEvent(event);
  if (!bytes.ok) throw new Error('the event does not encode');
  return { event, bytes: bytes.value };
}

let dbs = 0;
const freshDb = () => openAppDb(`airtime-test-${String(++dbs)}`);

beforeEach(() => {
  // The database needs real timers of its own; the radio's pump runs on fake ones.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the radio’s airtime', () => {
  it('counts what was spent before a reload, so the budget is not spent twice in an hour', async () => {
    const db = await freshDb();
    const now = Date.now();
    // The FakeLink weighs every packet at 1 s: one more fits the normal budget.
    const spent = Array.from({ length: LIMITS.normalBudgetMs / 1000 - 1 }, (_, index) => ({
      at: now - index,
      ms: 1000,
    }));
    await saveAirtime(db, spent);
    const link = new FakeLink();
    const radio = new RadioSession(() => Promise.resolve(link));
    await radio.useStorage(db);
    const feed = new FakeFeed();
    await radio.useFeed(feed);
    await radio.connect();
    feed.sink?.offer(chat(1), 'own');
    feed.sink?.offer(chat(2), 'own');
    await vi.advanceTimersByTimeAsync(3000);
    expect(link.sent).toHaveLength(1);
    expect(await loadAirtime(db)).toHaveLength(spent.length + 1);
  });

  it('tells the user another window drives the radio, and picks none meanwhile', async () => {
    const picked: FakeLink[] = [];
    const radio = new RadioSession(
      () => {
        const link = new FakeLink();
        picked.push(link);
        return Promise.resolve(link);
      },
      Math.random,
      () => Promise.resolve(null),
    );
    await radio.connect();
    expect(radio.problem).toBe('other-window');
    expect(picked).toEqual([]);
  });

  it('holds the radio for one window from connecting until it is disconnected', async () => {
    const releases: string[] = [];
    const radio = new RadioSession(
      () => Promise.resolve(new FakeLink()),
      Math.random,
      () => Promise.resolve(() => releases.push('released')),
    );
    await radio.connect();
    expect(releases).toEqual([]);
    await radio.disconnect();
    expect(releases).toEqual(['released']);
  });
});

describe('the radio lock', () => {
  it('gives the radio to one window at a time', async () => {
    const held = new Set<string>();
    vi.stubGlobal('navigator', {
      locks: {
        request(
          name: string,
          _options: { ifAvailable: true },
          callback: (lock: object | null) => Promise<void> | undefined,
        ): Promise<void> {
          if (held.has(name)) return Promise.resolve(callback(null));
          held.add(name);
          return Promise.resolve(callback({})).then(() => {
            held.delete(name);
          });
        },
      },
    });
    const release = await claimRadio();
    expect(release).not.toBeNull();
    expect(await claimRadio()).toBeNull();
    release?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(await claimRadio()).not.toBeNull();
  });
});
