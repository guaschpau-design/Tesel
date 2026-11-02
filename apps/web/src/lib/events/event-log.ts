// Each group's event log on this device (ARCHITECTURE.md §3): the events received or created that
// its state still uses, which is all of them but old positions (ADR-0055), kept as the bytes that
// travel on the wire so they can be forwarded unchanged.

import {
  encodeEvent,
  eventRefKey,
  isKeepable,
  peekHeader,
  type EventHeader,
  type EventRef,
  type NodeId,
  type TeselEvent,
} from '@tesel/protocol';

import type { AppDb, EventKey, GroupEventRef, OutboxEntry } from '../storage/app-db.ts';
import { cursorKey, groupCursors } from '../sync/cursor-store.ts';
import type { RelayPosition } from '../sync/relay-types.ts';

/** Largest sequence number: the field is an unsigned 32-bit integer (protocol §2). */
const MAX_SEQ = 0xffff_ffff;

/** An event that cannot be encoded, mostly for being too big for the radio (protocol §2). */
export class UnencodableEvent extends Error {}

/** A received event that was new to the log. */
export interface Received {
  readonly entry: GroupEventRef;
  readonly bytes: Uint8Array;
}

/** How far the group's server has been read with some events. */
export interface ServerRead {
  readonly server: string;
  readonly position: RelayPosition;
}

export interface ReceiveOptions {
  /** The events were heard over the radio and this device bridges them: queue them for the server. */
  readonly forward?: boolean;
  /** How far the group's server has been read with these events; saved with them, never ahead. */
  readonly readTo?: ServerRead;
}

/**
 * Stores received events in one transaction, however many: storage is what limits how fast a
 * device catches up after hours without coverage. Returns the new ones, in order. Events already
 * in the log, repeated in the batch or not events at all are skipped; events of types this
 * version does not know are kept, since they are still valid to forward (protocol §3.1).
 */
export async function receiveEvents(
  db: AppDb,
  groupId: string,
  batch: readonly Uint8Array[],
  options: ReceiveOptions = {},
): Promise<Received[]> {
  const candidates = new Map<string, Received>();
  for (const bytes of batch) {
    const header = peekHeader(bytes);
    // A damaged copy must not take the place of the real event (protocol §3.1).
    if (!header.ok || !isKeepable(bytes)) continue;
    const entry: GroupEventRef = { groupId, origin: header.value.origin, seq: header.value.seq };
    const id = eventRefKey(entry);
    if (!candidates.has(id)) candidates.set(id, { entry, bytes });
  }
  // Requests are issued together and served in order by the transaction: much faster than
  // waiting for each one in turn.
  const tx = db.transaction(['events', 'outbox', 'cursors'], 'readwrite');
  const events = tx.objectStore('events');
  const unique = [...candidates.values()];
  const known = await Promise.all(unique.map(({ entry }) => events.getKey(eventKeyOf(entry))));
  const received = unique.filter((_, index) => known[index] === undefined);
  const writes: Promise<unknown>[] = received.map(({ entry, bytes }) =>
    events.put({ ...entry, bytes }),
  );
  if (options.forward === true) {
    writes.push(...received.map(({ entry }) => tx.objectStore('outbox').put(entry)));
  }
  if (options.readTo !== undefined) {
    const { server, position } = options.readTo;
    writes.push(tx.objectStore('cursors').put(position, cursorKey(groupId, server)));
  }
  await Promise.all([...writes, tx.done]);
  return received;
}

function eventKeyOf(entry: GroupEventRef): EventKey {
  return [entry.groupId, entry.origin, entry.seq];
}

export async function loadEvents(db: AppDb, groupId: string): Promise<Uint8Array[]> {
  const events = await db.getAllFromIndex('events', 'byGroup', groupId);
  return events.map((event) => event.bytes);
}

/**
 * Creates an event of this device: takes the next sequence number, encodes the event and
 * stores it in the log and the outbox in one transaction, so a crash never loses or reuses a
 * sequence number.
 */
export async function publishEvent(
  db: AppDb,
  groupId: string,
  build: (header: EventHeader) => TeselEvent,
  header: Omit<EventHeader, 'seq'>,
): Promise<{ entry: OutboxEntry; bytes: Uint8Array }> {
  const tx = db.transaction(['sequence', 'events', 'outbox'], 'readwrite');
  const sequence = tx.objectStore('sequence');
  const [seq = 1, lastTime = 0] = await Promise.all([
    sequence.get('next'),
    sequence.get('lastTime'),
  ]);
  if (seq > MAX_SEQ) throw new RangeError('this device has used every sequence number');
  // A clock put back must not make this event older than the one before (protocol §3.1).
  const time = Math.max(header.time, lastTime);
  const encoded = encodeEvent(build({ ...header, time, seq }));
  if (!encoded.ok) {
    tx.abort();
    await tx.done.catch(() => undefined); // The abort itself rejects `done`.
    throw new UnencodableEvent(`cannot encode event: ${encoded.error.detail}`);
  }
  const entry: OutboxEntry = { groupId, origin: header.origin, seq };
  await Promise.all([
    sequence.put(seq + 1, 'next'),
    sequence.put(time, 'lastTime'),
    tx.objectStore('events').put({ ...entry, bytes: encoded.value }),
    tx.objectStore('outbox').put(entry),
  ]);
  await tx.done;
  return { entry, bytes: encoded.value };
}

/**
 * Events waiting for the server, with their bytes: this device's own and those it forwards. What
 * concerns only its own events (what is still to deliver, what to put on the air) filters by origin.
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
    if (stored !== undefined) pending.push({ entry, bytes: stored.bytes });
  }
  await tx.done;
  return pending;
}

export async function confirmStored(db: AppDb, entry: GroupEventRef): Promise<void> {
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

/**
 * Forgets events the group's state no longer uses (ADR-0055): from the log and, if they still wait
 * for the server, from the outbox, where the newer events that outlived them wait too.
 */
export async function forgetEvents(
  db: AppDb,
  groupId: string,
  events: readonly EventRef[],
): Promise<void> {
  const tx = db.transaction(['events', 'outbox'], 'readwrite');
  const ranges = seqRuns(events).map(({ origin, first, last }) =>
    IDBKeyRange.bound([groupId, origin, first], [groupId, origin, last]),
  );
  await Promise.all([
    ...ranges.flatMap((range) => [
      tx.objectStore('events').delete(range),
      tx.objectStore('outbox').delete(range),
    ]),
    tx.done,
  ]);
}

/**
 * Events grouped in runs of consecutive sequence numbers of one author. Nothing else is stored
 * between the first and last of a run, so each run is deleted as one key range: a log of hours
 * of positions is forgotten in a few requests instead of one per position.
 */
function seqRuns(
  events: readonly EventRef[],
): { readonly origin: NodeId; readonly first: number; last: number }[] {
  const sorted = [...events].sort((a, b) =>
    a.origin === b.origin ? a.seq - b.seq : a.origin < b.origin ? -1 : 1,
  );
  const runs: { readonly origin: NodeId; readonly first: number; last: number }[] = [];
  for (const { origin, seq } of sorted) {
    const run = runs.at(-1);
    if (run?.origin === origin && seq <= run.last + 1) run.last = seq;
    else runs.push({ origin, first: seq, last: seq });
  }
  return runs;
}

/**
 * Forgets what groups no longer on this device left behind: events stored while one was being
 * left, by a feed that had not stopped yet.
 */
export async function deleteLeftovers(db: AppDb, kept: readonly string[]): Promise<void> {
  const found = new Set<string>();
  const tx = db.transaction(['events', 'outbox', 'cursors']);
  for (const name of ['events', 'outbox'] as const) {
    const index = tx.objectStore(name).index('byGroup');
    let cursor = await index.openKeyCursor(null, 'nextunique');
    while (cursor) {
      found.add(cursor.key);
      cursor = await cursor.continue();
    }
  }
  for (const [groupId] of await tx.objectStore('cursors').getAllKeys()) found.add(groupId);
  await tx.done;
  for (const groupId of found) {
    if (!kept.includes(groupId)) await deleteGroupEvents(db, groupId);
  }
}

/** Forgets everything a group left on this device: its events, outbox and cursors. */
export async function deleteGroupEvents(db: AppDb, groupId: string): Promise<void> {
  const tx = db.transaction(['events', 'outbox', 'cursors'], 'readwrite');
  for (const name of ['events', 'outbox'] as const) {
    const store = tx.objectStore(name);
    for (const key of await store.index('byGroup').getAllKeys(groupId)) await store.delete(key);
  }
  await tx.objectStore('cursors').delete(groupCursors(groupId));
  await tx.done;
}
