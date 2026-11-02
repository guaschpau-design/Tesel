import 'fake-indexeddb/auto';

import { TRAIL_POINTS } from '@tesel/core';
import {
  deriveGroupKeys,
  encodeEvent,
  encodeLogFile,
  eventRefKey,
  sealEnvelope,
  type NodeId,
  type TeselEvent,
} from '@tesel/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadEvents, receiveEvents } from '../events/event-log.ts';
import { createGroup } from '../groups/group.ts';
import { createLocalIdentity } from '../identity/identity.ts';
import { openAppDb } from '../storage/app-db.ts';
import { GroupFeed } from './group-feed.svelte.ts';
import type { LoraSink } from './lora-events.ts';
import type { SocketLike } from './relay-types.ts';

const MEMBERS = ['0a0a0a0a', '0b0b0b0b', '0c0c0c0c'] as NodeId[];
const T0 = 1_761_350_400;
/** More positions per member than a trail shows. */
const POSITIONS = TRAIL_POINTS + 140;

/** Every member shares their position every ten seconds, and says something once. */
function operation(): TeselEvent[] {
  return MEMBERS.flatMap((origin): TeselEvent[] => [
    ...Array.from({ length: POSITIONS }, (_, i) => ({
      type: 'position' as const,
      origin,
      seq: i + 1,
      time: T0 + 10 * i,
      lat: 39.47,
      lon: -0.37,
      accuracy: 5,
      heading: null,
      speed: null,
    })),
    { type: 'chat', origin, seq: POSITIONS + 1, time: T0, text: 'En posición' },
  ]);
}

function bytesOf(events: readonly TeselEvent[]): Uint8Array[] {
  return events.map((event) => {
    const encoded = encodeEvent(event);
    if (!encoded.ok) throw new Error(encoded.error.detail);
    return encoded.value;
  });
}

let databases = 0;

async function setUp() {
  const db = await openAppDb(`group-feed-${String(++databases)}`);
  const group = createGroup('Rescate', null, Date.now());
  const identity = createLocalIdentity('Ana', Date.now());
  return { db, group, identity };
}

/** Positions kept: each member's trail. Chat, and this device's announcement, are kept too. */
const KEPT = MEMBERS.length * (TRAIL_POINTS + 1) + 1;

describe('a group feed', () => {
  it('forgets the positions its trails have outlived, and does not take them back', async () => {
    const { db, group, identity } = await setUp();
    const feed = await GroupFeed.open(db, group, identity);
    const keys = deriveGroupKeys(group.secret);
    const file = encodeLogFile({
      groupId: keys.groupId,
      envelopes: bytesOf(operation()).map((bytes) => sealEnvelope(keys, bytes)),
    });

    const first = await feed.importLog(file);
    expect(await loadEvents(db, group.id)).toHaveLength(KEPT);
    expect(first.kind === 'loaded' && first.added).toBe(MEMBERS.length * (POSITIONS + 1));
    for (const member of MEMBERS) {
      expect(feed.state.trails.get(member)?.points).toHaveLength(TRAIL_POINTS);
    }

    // The same file again, as a relay or a second device would bring it: nothing is new.
    const again = await feed.importLog(file);
    expect(again.kind === 'loaded' && again.added).toBe(0);
    expect(await loadEvents(db, group.id)).toHaveLength(KEPT);
  });

  it('forgets what a log written before forgetting holds, when the group opens', async () => {
    const { db, group, identity } = await setUp();
    await receiveEvents(db, group.id, bytesOf(operation()));
    expect(await loadEvents(db, group.id)).toHaveLength(MEMBERS.length * (POSITIONS + 1));

    const feed = await GroupFeed.open(db, group, identity);
    expect(await loadEvents(db, group.id)).toHaveLength(KEPT);
    expect(feed.state.chat).toHaveLength(MEMBERS.length);
  });

  it('tells the group a new name, which it then knows this member by', async () => {
    const { db, group, identity } = await setUp();
    const feed = await GroupFeed.open(db, group, identity);
    await feed.rename('Ana G.');
    expect(feed.state.members.get(identity.nodeId)?.alias).toBe('Ana G.');
  });

  describe('with a server', () => {
    beforeEach(() => {
      // The server is never reached: what the device knows of it comes from nowhere.
      vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));
      // The feed listens for the browser coming back online and into view.
      const events = { addEventListener: () => undefined, removeEventListener: () => undefined };
      vi.stubGlobal('window', events);
      vi.stubGlobal('document', events);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    /** A relay that never answers. */
    const silentRelay = (): SocketLike => ({
      onopen: null,
      onmessage: null,
      onclose: null,
      send: () => undefined,
      close: () => undefined,
    });

    it('forwards another member’s radio event without taking it for its own after a restart', async () => {
      const { db, identity } = await setUp();
      const group = createGroup('Rescate', 'https://relay.example/', Date.now());
      const first = await GroupFeed.open(db, group, identity, silentRelay);
      const other = '0d0d0d0d' as NodeId;
      const [heard] = bytesOf([{ type: 'chat', origin: other, seq: 1, time: T0, text: 'Os oigo' }]);
      if (heard === undefined) throw new Error('no event');
      await first.receiveFromRadio(heard);
      first.close();

      const reopened = await GroupFeed.open(db, group, identity, silentRelay);
      // Its own announcement is still undelivered; the other member's chat is not its to deliver.
      expect([...reopened.undelivered]).not.toContain(eventRefKey({ origin: other, seq: 1 }));
      const offered: string[] = [];
      const sink: LoraSink = {
        offer: (packet, source) => offered.push(`${packet.event.origin}:${source}`),
        heard: () => undefined,
        observe: () => undefined,
      };
      await reopened.attachRadio(sink);
      expect(offered).not.toContain(`${other}:own`);
      reopened.close();
    });
  });
});
