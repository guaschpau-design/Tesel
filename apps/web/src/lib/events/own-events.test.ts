import 'fake-indexeddb/auto';

import { decodeEvent, type EventHeader, type NodeId, type TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { openAppDb } from '../storage/app-db.ts';
import { fillStorage } from '../storage/full-storage.ts';
import { loadEvents, storeHeld } from './event-log.ts';
import { pendingEvents } from './outbox.ts';
import { publishEvent, skipSequence } from './own-events.ts';

const ME = 'a1b2c3d4' as NodeId;
/** November 2026. */
const NOW = 1_793_000_000;
const YEAR = 365 * 24 * 3600;
let dbCounter = 0;
const freshDb = () => openAppDb(`own-events-test-${String(dbCounter++)}`);

const chat =
  (text = 'hola') =>
  (header: EventHeader): TeselEvent => ({ ...header, type: 'chat', text });
const sos = (header: EventHeader): TeselEvent => ({
  ...header,
  type: 'sos',
  kind: 'medical',
  lat: 39.47,
  lon: -0.37,
  accuracy: 5,
  text: 'Ayuda',
});
const timeOf = (bytes: Uint8Array) => {
  const decoded = decodeEvent(bytes);
  return decoded.ok ? decoded.value.time : null;
};

describe('own events', () => {
  it('numbers own events from 1 in each group on its own, and never reuses a number', async () => {
    const db = await freshDb();
    const a = await publishEvent(db, 'group-a', chat('uno'), { origin: ME, time: 1000 });
    const b = await publishEvent(db, 'group-b', chat('dos'), { origin: ME, time: 1001 });
    expect([a.entry.seq, b.entry.seq]).toEqual([1, 1]);
    db.close();
    const reopened = await openAppDb(db.name);
    const c = await publishEvent(reopened, 'group-a', chat('tres'), { origin: ME, time: 1002 });
    expect(c.entry.seq).toBe(2);
  });

  it('starts each group above the one number every group shared before, so none is used twice', async () => {
    const db = await freshDb();
    // Before version 8 of the database, one counter numbered every group.
    await db.put('sequence', 41, 'next');
    const a = await publishEvent(db, 'group-a', chat(), { origin: ME, time: 1000 });
    const b = await publishEvent(db, 'group-b', chat(), { origin: ME, time: 1001 });
    const again = await publishEvent(db, 'group-a', chat(), { origin: ME, time: 1002 });
    expect([a.entry.seq, b.entry.seq, again.entry.seq]).toEqual([41, 41, 42]);
  });

  it('never stamps an own event earlier than the one before, if the clock goes back', async () => {
    const db = await freshDb();
    await publishEvent(db, 'group', chat(), { origin: ME, time: 5000 });
    const { bytes } = await publishEvent(db, 'group', chat(), { origin: ME, time: 4000 });
    expect(timeOf(bytes)).toBe(5000);
  });

  it('goes by the clock again once it is set right after running far ahead', async () => {
    const db = await freshDb();
    // The phone started with its clock ten years ahead.
    await publishEvent(db, 'group', chat(), { origin: ME, time: NOW + 10 * YEAR });
    const later = await publishEvent(db, 'group', chat(), { origin: ME, time: NOW + 60 });
    expect(timeOf(later.bytes)).toBe(NOW + 60);
  });

  it('refuses an event that does not fit the protocol, without using a sequence number', async () => {
    const db = await freshDb();
    await expect(
      publishEvent(db, 'group', chat('x'.repeat(500)), { origin: ME, time: 1000 }),
    ).rejects.toThrow(/encode/);
    const next = await publishEvent(db, 'group', chat('ok'), { origin: ME, time: 1000 });
    expect(next.entry.seq).toBe(1);
  });

  it('sends an SOS with no room to store it, and stores it once there is room', async () => {
    const db = await freshDb();
    await publishEvent(db, 'group', chat(), { origin: ME, time: 1000 });
    const storage = fillStorage(db);
    await expect(publishEvent(db, 'group', chat(), { origin: ME, time: 1001 })).rejects.toThrow();
    const call = await publishEvent(db, 'group', sos, { origin: ME, time: 1002 });
    expect(call).toMatchObject({ entry: { seq: 2 }, stored: false });
    // It is in the log and waits for the server, held in memory.
    expect(await loadEvents(db, 'group')).toContainEqual(call.bytes);
    expect((await pendingEvents(db, 'group')).map(({ bytes }) => bytes)).toContainEqual(call.bytes);
    // Its number is not used again, before or after the storage has room.
    const cancel = await publishEvent(
      db,
      'group',
      (header) => ({ ...header, type: 'sos-cancel', sos: call.entry }),
      { origin: ME, time: 1003 },
    );
    expect(cancel.entry.seq).toBe(3);
    // Another group's numbers are its own.
    const elsewhere = await publishEvent(db, 'other', sos, { origin: ME, time: 1003 });
    expect(elsewhere.entry.seq).toBe(1);
    storage.room();
    expect(await storeHeld(db, 'group')).toBe(true);
    expect(await loadEvents(db, 'group')).toHaveLength(3);
    db.close();
    const reopened = await openAppDb(db.name);
    const next = await publishEvent(reopened, 'group', chat(), { origin: ME, time: 1004 });
    expect(next.entry.seq).toBe(4);
  });

  it('skips a number someone else took under this device name, and says whether it was unused', async () => {
    const db = await freshDb();
    await publishEvent(db, 'group', chat(), { origin: ME, time: 1000 });
    expect(await skipSequence(db, 'group', 1)).toBe(false);
    expect(await skipSequence(db, 'group', 5)).toBe(true);
    const next = await publishEvent(db, 'group', sos, { origin: ME, time: 1001 });
    expect(next.entry.seq).toBe(6);
    const elsewhere = await publishEvent(db, 'other', sos, { origin: ME, time: 1001 });
    expect(elsewhere.entry.seq).toBe(1);
  });
});
