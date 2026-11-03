import 'fake-indexeddb/auto';

import { decodeEvent, encodeEvent, type EventHeader, type NodeId } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { loadEvents, receiveEvents } from './event-log.ts';
import { confirmStored, pendingEvents, requeueOwnEvents } from './outbox.ts';
import { publishEvent } from './own-events.ts';

const ME = 'a1b2c3d4' as NodeId;
const OTHER = '0f1e2d3c' as NodeId;
let dbCounter = 0;
const freshDb = () => openAppDb(`outbox-test-${String(dbCounter++)}`);
const hola = (header: EventHeader) => ({ ...header, type: 'chat', text: 'hola' }) as const;

describe('outbox', () => {
  it('keeps own events in the outbox until the server stores them', async () => {
    const db = await freshDb();
    const { entry } = await publishEvent(db, 'group', hola, { origin: ME, time: 1000 });
    const pending = await pendingEvents(db, 'group');
    expect(pending.map((p) => p.entry)).toEqual([entry]);
    expect(decodeEvent(pending[0]?.bytes ?? new Uint8Array()).ok).toBe(true);
    await confirmStored(db, entry);
    expect(await pendingEvents(db, 'group')).toEqual([]);
    expect(await loadEvents(db, 'group')).toHaveLength(1);
  });

  it('puts own events back in the outbox for a server that lost them', async () => {
    const db = await freshDb();
    const stored = await publishEvent(db, 'group', hola, { origin: ME, time: 1000 });
    await confirmStored(db, stored.entry);
    const waiting = await publishEvent(db, 'group', hola, { origin: ME, time: 1001 });
    const other = encodeEvent({ type: 'chat', origin: OTHER, seq: 1, time: 1000, text: 'de otro' });
    if (!other.ok) throw new Error('encode');
    await receiveEvents(db, 'group', [other.value]);
    await requeueOwnEvents(db, 'group', ME);
    const pending = await pendingEvents(db, 'group');
    expect(pending.map(({ entry }) => entry)).toEqual([
      { ...stored.entry, aired: true },
      waiting.entry,
    ]);
  });
});
