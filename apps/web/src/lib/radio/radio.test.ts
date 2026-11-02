import { encodeEvent, type NodeId, type TeselEvent } from '@tesel/protocol';
import 'fake-indexeddb/auto';

import { RadioError } from '@tesel/radio';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadEvents } from '../events/event-log.ts';
import { createGroup } from '../groups/group.ts';
import { saveGroup } from '../groups/group-store.ts';
import { openAppDb } from '../storage/app-db.ts';
import { FakeFeed, FakeLink, sealedFor } from './fake-radio.ts';
import { RadioSession } from './radio.svelte.ts';

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
  it('configures the active group’s channel once connected and sends its events sealed', async () => {
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
    expect(link.sent).toEqual([sealedFor(bytes)]);
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
    expect(link.sent).toEqual([sealedFor(bytes)]);
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

  it('hands what it hears to the feed, opened', async () => {
    const link = new FakeLink();
    const radio = new RadioSession(() => Promise.resolve(link));
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    link.hear(sealedFor(bytes));
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
    link.hear(sealedFor(bytes, other.secret), other.secret);
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

  it('makes a link for each radio picked, of its kind, and follows only the last', async () => {
    const meshcore = new FakeLink();
    const meshtastic = new FakeLink('meshtastic');
    const picked = [meshcore, meshtastic];
    const radio = new RadioSession(() => Promise.resolve(picked.shift() ?? meshtastic));
    await radio.connect();
    expect(radio.family).toBe('meshcore');
    // Connected already: there is nothing to pick.
    await radio.connect();
    expect(picked).toHaveLength(1);
    await radio.disconnect();
    await radio.connect();
    expect(radio.family).toBe('meshtastic');
    meshcore.say({ kind: 'channel', channel: null, sender: null, text: 'Antes', time: 1 });
    expect(radio.texts).toEqual([]);
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

describe('Tesel’s seal on radio frames', () => {
  async function linked(): Promise<{ link: FakeLink; radio: RadioSession; feed: FakeFeed }> {
    const link = new FakeLink();
    const radio = new RadioSession(
      () => Promise.resolve(link),
      () => 0,
    );
    const feed = new FakeFeed();
    await radio.connect();
    await radio.useFeed(feed);
    return { link, radio, feed };
  }

  it('drops frames that do not open: unsealed, changed on the way, or sealed by another group', async () => {
    const { link, radio, feed } = await linked();
    const changed = sealedFor(bytes);
    changed[changed.length - 1] = (changed[changed.length - 1] ?? 0) ^ 1;
    link.hear(bytes);
    link.hear(changed);
    link.hear(sealedFor(bytes, new Uint8Array(16).fill(9)));
    await vi.advanceTimersByTimeAsync(1000);
    expect(feed.received).toEqual([]);
    expect(radio.lastSnr).toBeNull();
  });

  it('weighs each packet’s airtime at the size of its sealed frame', async () => {
    const { link, feed } = await linked();
    feed.sink?.offer({ event: chat, bytes }, 'own');
    await vi.advanceTimersByTimeAsync(1000);
    expect(link.weighed).toContain(sealedFor(bytes).length);
    expect(link.weighed).not.toContain(bytes.length);
  });

  it('keeps off the air an event too large for a frame, written before frames were sealed', async () => {
    const { link, feed } = await linked();
    // A chat line of 151 bytes, which filled an event before frames were sealed.
    const earlier = { ...chat, seq: 2, text: 'x'.repeat(151) };
    const earlierBytes = Uint8Array.from([
      ...bytes.subarray(0, 6),
      ...[2, 0, 0, 0],
      ...bytes.subarray(10, 14),
      ...new Uint8Array(151).fill(0x78),
    ]);
    feed.sink?.offer({ event: earlier, bytes: earlierBytes }, 'own');
    feed.sink?.offer({ event: chat, bytes }, 'own');
    await vi.advanceTimersByTimeAsync(5000);
    expect(link.sent).toEqual([sealedFor(bytes)]);
  });
});
