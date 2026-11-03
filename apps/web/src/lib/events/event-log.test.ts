import 'fake-indexeddb/auto';

import { openSosCalls, stateOf } from '@tesel/core';
import { decodeEvent, encodeEvent, type NodeId, type TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { openAppDb, type AppDb } from '../storage/app-db.ts';
import { fillStorage } from '../storage/full-storage.ts';
import { loadPosition } from '../sync/cursor-store.ts';
import {
  deleteGroupEvents,
  deleteLeftovers,
  loadEvents,
  receiveEvents,
  storeHeld,
} from './event-log.ts';
import { pendingEvents } from './outbox.ts';

const OTHER = '0f1e2d3c' as NodeId;
const VICTIM = 'a1b2c3d4' as NodeId;
let dbCounter = 0;
const freshDb = () => openAppDb(`event-log-test-${String(dbCounter++)}`);

const encoded = (event: TeselEvent) => {
  const bytes = encodeEvent(event);
  if (!bytes.ok) throw new Error(bytes.error.detail);
  return bytes.value;
};
const chatBytes = (origin: NodeId, seq: number, text: string, time = 1000) =>
  encoded({ type: 'chat', origin, seq, time, text });
const sosBytes = (origin: NodeId, seq: number, text: string, time = 2000) =>
  encoded({ type: 'sos', origin, seq, time, kind: 'medical', lat: 1, lon: 2, accuracy: 5, text });
const stateIn = async (db: AppDb, groupId: string) =>
  stateOf(
    (await loadEvents(db, groupId)).flatMap((bytes) => {
      const event = decodeEvent(bytes);
      return event.ok ? [event.value] : [];
    }),
  );

describe('event log', () => {
  it('drops a damaged event, so that the real one is still taken later', async () => {
    const db = await freshDb();
    const real = chatBytes(OTHER, 4, 'hola');
    // A known type cut short, with the same (origin, seq): its payload does not decode.
    const truncated = encoded({
      type: 'position',
      origin: OTHER,
      seq: 4,
      time: 1000,
      lat: 1,
      lon: 2,
      accuracy: 5,
      heading: null,
      speed: null,
    }).slice(0, 20);
    expect((await receiveEvents(db, 'group', [truncated])).added).toEqual([]);
    expect((await receiveEvents(db, 'group', [real])).added).toHaveLength(1);
  });

  it('stores a received event once, whichever transport brings it again', async () => {
    const db = await freshDb();
    const bytes = chatBytes(OTHER, 4, 'hola');
    const entry = { groupId: 'group', origin: OTHER, seq: 4 };
    expect(await receiveEvents(db, 'group', [bytes])).toEqual({
      added: [{ entry, bytes }],
      displaced: false,
      rivalled: [],
    });
    const again = await receiveEvents(db, 'group', [bytes, new Uint8Array([1, 2, 3])]);
    expect(again).toEqual({ added: [], displaced: false, rivalled: [] });
    expect(await loadEvents(db, 'group')).toEqual([bytes]);
    expect(await pendingEvents(db, 'group')).toEqual([]);
  });

  it('stores a batch in order, skipping what repeats within it', async () => {
    const db = await freshDb();
    const first = chatBytes(OTHER, 1, 'uno');
    const second = chatBytes(OTHER, 2, 'dos');
    const { added } = await receiveEvents(db, 'group', [first, second, first]);
    expect(added.map((r) => r.bytes)).toEqual([first, second]);
    expect(await loadEvents(db, 'group')).toHaveLength(2);
  });

  it('saves how far the server was read together with the events read', async () => {
    const db = await freshDb();
    const server = 'https://tesel.example/';
    const position = { cursor: 42, store: 'store' };
    await receiveEvents(db, 'group', [chatBytes(OTHER, 1, 'a')], { readTo: { server, position } });
    expect(await loadPosition(db, 'group', server)).toEqual(position);
  });

  it('queues an event heard over the radio for the server when bridging', async () => {
    const db = await freshDb();
    const bytes = chatBytes(OTHER, 7, 'por radio');
    const { added } = await receiveEvents(db, 'group', [bytes], { forward: true });
    expect(await pendingEvents(db, 'group')).toEqual(added);
  });

  it('forgets everything a group left behind', async () => {
    const db = await freshDb();
    await receiveEvents(db, 'gone', [chatBytes(OTHER, 1, 'a')]);
    await receiveEvents(db, 'kept', [chatBytes(OTHER, 2, 'b')]);
    await deleteGroupEvents(db, 'gone');
    expect(await loadEvents(db, 'gone')).toEqual([]);
    expect(await loadEvents(db, 'kept')).toHaveLength(1);
  });

  it('forgets what groups no longer on the device left behind, and nothing else', async () => {
    const db = await freshDb();
    await receiveEvents(db, 'gone', [chatBytes(OTHER, 1, 'a')], {
      forward: true,
      readTo: { server: 'https://tesel.example', position: { cursor: 3, store: null } },
    });
    await receiveEvents(db, 'kept', [chatBytes(OTHER, 2, 'b')], { forward: true });
    await deleteLeftovers(db, ['kept']);
    expect(await loadEvents(db, 'gone')).toEqual([]);
    expect(await pendingEvents(db, 'gone')).toEqual([]);
    expect(await db.getAllKeys('cursors')).toEqual([]);
    expect(await loadEvents(db, 'kept')).toHaveLength(1);
    expect(await pendingEvents(db, 'kept')).toHaveLength(1);
  });
});

describe('rivals under one (origin, seq)', () => {
  it('shows an SOS sent under a number someone else took first with a harmless event', async () => {
    const db = await freshDb();
    // Any member writes a chat line under the victim's next sequence number.
    await receiveEvents(db, 'g', [chatBytes(VICTIM, 42, 'x')]);
    // Later the victim really calls for help with that number.
    const real = sosBytes(VICTIM, 42, 'help');
    const received = await receiveEvents(db, 'g', [real]);
    expect(received.added.map(({ bytes }) => bytes)).toEqual([real]);
    expect(received.displaced).toBe(true);
    expect(received.rivalled).toEqual([{ groupId: 'g', origin: VICTIM, seq: 42 }]);
    const calls = [...openSosCalls(await stateIn(db, 'g'))];
    expect(calls.map(([, call]) => call.text)).toEqual(['help']);
    expect((await stateIn(db, 'g')).chat).toEqual([]);
  });

  it('ends up the same on two devices that get two versions in opposite orders', async () => {
    const a = await freshDb();
    const b = await freshDb();
    const one = chatBytes(VICTIM, 7, 'one');
    const two = chatBytes(VICTIM, 7, 'two');
    await receiveEvents(a, 'g', [one]);
    await receiveEvents(a, 'g', [two]);
    await receiveEvents(b, 'g', [two]);
    await receiveEvents(b, 'g', [one]);
    expect(await loadEvents(a, 'g')).toEqual(await loadEvents(b, 'g'));
    expect((await stateIn(a, 'g')).chat).toEqual((await stateIn(b, 'g')).chat);
  });

  it('keeps a forged SOS and the real one under the same number, in any order', async () => {
    const forged = sosBytes(VICTIM, 42, '', 0);
    const real = sosBytes(VICTIM, 42, 'help');
    const seen: string[][] = [];
    for (const order of [
      [forged, real],
      [real, forged],
    ]) {
      const db = await freshDb();
      for (const bytes of order) await receiveEvents(db, 'g', [bytes], { forward: true });
      seen.push([...openSosCalls(await stateIn(db, 'g'))].map(([, call]) => call.text));
      // Both go to the server, so members who only reach it see the real one too.
      expect((await pendingEvents(db, 'g')).map(({ bytes }) => bytes)).toHaveLength(2);
    }
    expect(seen[0]).toEqual(seen[1]);
    expect([...(seen[0] ?? [])].sort()).toEqual(['', 'help']);
  });

  it('keeps nothing an ordinary event forged after an SOS brings', async () => {
    const db = await freshDb();
    const real = sosBytes(VICTIM, 42, 'help');
    await receiveEvents(db, 'g', [real]);
    const later = await receiveEvents(db, 'g', [chatBytes(VICTIM, 42, 'x', 0)]);
    expect(later).toEqual({
      added: [],
      displaced: false,
      rivalled: [{ groupId: 'g', origin: VICTIM, seq: 42 }],
    });
    expect(await loadEvents(db, 'g')).toEqual([real]);
  });
});

describe('a storage with no room', () => {
  it('holds an SOS, a cancellation and an acknowledgement, and stores them when there is room', async () => {
    const db = await freshDb();
    const storage = fillStorage(db);
    const call = sosBytes(OTHER, 3, 'help');
    const chat = chatBytes(OTHER, 4, 'hola');
    await expect(receiveEvents(db, 'g', [call, chat], { forward: true })).rejects.toThrow();
    // Only the call is held: it is read with the log and waits for the server.
    expect(await loadEvents(db, 'g')).toEqual([call]);
    expect((await pendingEvents(db, 'g')).map(({ bytes }) => bytes)).toEqual([call]);
    expect(await storeHeld(db, 'g')).toBe(false);
    storage.room();
    expect(await storeHeld(db, 'g')).toBe(true);
    expect(await loadEvents(db, 'g')).toEqual([call]);
    expect((await pendingEvents(db, 'g')).map(({ bytes }) => bytes)).toEqual([call]);
  });
});
