// What waits for the group's server (protocol §8): this device's own events, and those of others it
// heard by radio and forwards. An event leaves the outbox once the server says it stored it.

import { peekHeader, type NodeId } from '@tesel/protocol';

import { eventKeyOf, type AppDb, type GroupEventRef, type OutboxEntry } from '../storage/app-db.ts';
import { heldEvents, heldSent } from './held-events.ts';

/**
 * Events waiting for the server, with their bytes: every version the log keeps of each (protocol
 * §3.1), and those held in memory for lack of room (held-events.ts). What concerns only this
 * device's own events (what is still to deliver, what to put on the air) filters by origin.
 */
export async function pendingEvents(
  db: AppDb,
  groupId: string,
): Promise<{ entry: OutboxEntry; bytes: Uint8Array }[]> {
  const tx = db.transaction(['outbox', 'events']);
  const entries = await tx.objectStore('outbox').index('byGroup').getAll(groupId);
  const pending = [];
  for (const entry of entries) {
    const stored = await tx.objectStore('events').get(eventKeyOf(entry));
    if (stored === undefined) continue;
    for (const bytes of [stored.bytes, ...(stored.rivals ?? [])]) pending.push({ entry, bytes });
  }
  await tx.done;
  for (const { bytes, outbox } of heldEvents(db, groupId)) {
    const header = peekHeader(bytes);
    if (!outbox || !header.ok) continue;
    pending.push({ entry: { groupId, origin: header.value.origin, seq: header.value.seq }, bytes });
  }
  return pending;
}

export async function confirmStored(db: AppDb, entry: GroupEventRef): Promise<void> {
  heldSent(db, entry);
  await db.delete('outbox', eventKeyOf(entry));
}

/**
 * Puts every own event of a group back in the outbox, for a server that lost them (protocol §8):
 * they go to it again on the next sync. They reached the group before, so they count as aired and
 * do not go on the radio again.
 */
export async function requeueOwnEvents(db: AppDb, groupId: string, origin: NodeId): Promise<void> {
  const tx = db.transaction(['events', 'outbox'], 'readwrite');
  const keys = await tx.objectStore('events').index('byGroup').getAllKeys(groupId);
  const outbox = tx.objectStore('outbox');
  const own = keys.filter(([, author]) => author === origin);
  const queued = await Promise.all(own.map((key) => outbox.getKey(key)));
  await Promise.all(
    own.flatMap(([, , seq], index) =>
      queued[index] === undefined ? [outbox.put({ groupId, origin, seq, aired: true })] : [],
    ),
  );
  await tx.done;
}

/** Notes that an own event went out over LoRa while it still waits for the server. */
export async function markAired(db: AppDb, entry: GroupEventRef): Promise<void> {
  const tx = db.transaction('outbox', 'readwrite');
  const current = await tx.store.get(eventKeyOf(entry));
  if (current !== undefined) await tx.store.put({ ...current, aired: true });
  await tx.done;
}
