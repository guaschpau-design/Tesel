// Each group's event log on this device (ARCHITECTURE.md §3): the events received or created that
// its state still uses, which is all of them but old positions (ADR-0055), kept as the bytes that
// travel on the wire so they can be forwarded unchanged. Under one `(origin, seq)` it keeps what
// protocol §3.1 says of rivals, the same on every device (ADR-0103). This device's own events are
// created in own-events.ts, what waits for the server is in outbox.ts, and what there was no room
// to store is held in memory (held-events.ts).

import { isLifeSafety, keptRivals } from '@tesel/core';
import {
  bytesEqual,
  eventRefKey,
  isKeepable,
  peekHeader,
  type EventRef,
  type NodeId,
} from '@tesel/protocol';

import { eventKeyOf, type AppDb, type GroupEventRef, type StoredEvent } from '../storage/app-db.ts';
import { withRoom } from '../storage/storage-space.svelte.ts';
import { cursorKey, groupCursors } from '../sync/cursor-store.ts';
import { peekType } from '../sync/lora-events.ts';
import type { RelayPosition } from '../sync/relay-types.ts';
import { heldEvents, hold, release } from './held-events.ts';
import { skipSequence } from './own-events.ts';

/** A received event that was new to the log. */
export interface Received {
  readonly entry: GroupEventRef;
  readonly bytes: Uint8Array;
}

/** What a batch of received events changed in the log. */
export interface ReceivedBatch {
  /** The events new to the log, in the order of the batch. */
  readonly added: Received[];
  /**
   * Whether events the log had gave way to a rival that wins over them (`keptRivals`): the
   * picture made with them is to be made again from the log.
   */
  readonly displaced: boolean;
  /** Refs under which the batch brought another event than the log had: someone writes as another. */
  readonly rivalled: GroupEventRef[];
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

/** The versions of one event that arrive together, under its ref. */
interface Arriving {
  readonly entry: GroupEventRef;
  readonly versions: Uint8Array[];
}

/** What versions arriving under one ref change in the log (`settle`). */
interface Settled {
  /** The versions to keep, or null if they are those the log has. */
  readonly kept: Pick<StoredEvent, 'bytes' | 'rivals'> | null;
  /** Those of them new to the log. */
  readonly added: Uint8Array[];
  /** Whether some the log had are dropped. */
  readonly displaced: boolean;
  /** Whether a version unlike the others arrived. */
  readonly rivalled: boolean;
}

/**
 * Stores received events in one transaction, however many: storage is what limits how fast a
 * device catches up after hours without coverage. Events already in the log, repeated in the batch
 * or not events at all are skipped; events of types this version does not know are kept, since
 * they are still valid to forward (protocol §3.1). If there is no room for them even once map tiles
 * have made room, the SOS calls, cancellations and acknowledgements among them are held in memory
 * (held-events.ts) and the failure is passed on.
 */
export async function receiveEvents(
  db: AppDb,
  groupId: string,
  batch: readonly Uint8Array[],
  options: ReceiveOptions = {},
): Promise<ReceivedBatch> {
  const arriving = arrivingVersions(groupId, batch);
  try {
    const received = await withRoom(() => storeVersions(db, groupId, arriving, options));
    release(db, groupId, batch);
    return received;
  } catch (error) {
    const outbox = options.forward === true;
    const urgent = [...arriving.values()].flatMap(({ versions }) =>
      versions.filter((bytes) => isLifeSafety(peekType(bytes))),
    );
    hold(
      db,
      urgent.map((bytes) => ({ groupId, bytes, outbox, own: false })),
    );
    throw error;
  }
}

/** The versions of each event of a batch, by ref, in the order the batch first has them. */
function arrivingVersions(groupId: string, batch: readonly Uint8Array[]): Map<string, Arriving> {
  const arriving = new Map<string, Arriving>();
  for (const bytes of batch) {
    const header = peekHeader(bytes);
    // A damaged copy must not take the place of the real event (protocol §3.1).
    if (!header.ok || !isKeepable(bytes)) continue;
    const entry: GroupEventRef = { groupId, origin: header.value.origin, seq: header.value.seq };
    const id = eventRefKey(entry);
    const known = arriving.get(id);
    if (known === undefined) arriving.set(id, { entry, versions: [bytes] });
    else known.versions.push(bytes);
  }
  return arriving;
}

async function storeVersions(
  db: AppDb,
  groupId: string,
  arriving: ReadonlyMap<string, Arriving>,
  options: ReceiveOptions,
): Promise<ReceivedBatch> {
  // Requests are issued together and served in order by the transaction: much faster than
  // waiting for each one in turn.
  const tx = db.transaction(['events', 'outbox', 'cursors'], 'readwrite');
  const events = tx.objectStore('events');
  const refs = [...arriving.values()];
  const stored = await Promise.all(refs.map(({ entry }) => events.get(eventKeyOf(entry))));
  const added: Received[] = [];
  const rivalled: GroupEventRef[] = [];
  let displaced = false;
  const writes: Promise<unknown>[] = [];
  refs.forEach(({ entry, versions }, index) => {
    const record = stored[index];
    const settled = settle(record === undefined ? [] : versionsOf(record), versions);
    if (settled.rivalled) rivalled.push(entry);
    if (settled.kept === null) return;
    displaced ||= settled.displaced;
    added.push(...settled.added.map((bytes) => ({ entry, bytes })));
    writes.push(events.put({ ...entry, ...settled.kept }));
    if (options.forward === true && settled.added.length > 0) {
      writes.push(tx.objectStore('outbox').put(entry));
    }
  });
  if (options.readTo !== undefined) {
    const { server, position } = options.readTo;
    writes.push(tx.objectStore('cursors').put(position, cursorKey(groupId, server)));
  }
  await Promise.all([...writes, tx.done]);
  return { added, displaced, rivalled };
}

/** What versions arriving under one ref change among those the log has (`keptRivals`). */
function settle(known: readonly Uint8Array[], arriving: readonly Uint8Array[]): Settled {
  const seen = [...known];
  for (const bytes of arriving) if (!includes(seen, bytes)) seen.push(bytes);
  const kept = keptRivals(seen);
  const added = kept.filter((bytes) => !includes(known, bytes));
  const displaced = known.some((bytes) => !includes(kept, bytes));
  const [first, ...rest] = kept;
  const changed = first !== undefined && (added.length > 0 || displaced);
  return {
    kept: changed ? { bytes: first, ...(rest.length > 0 ? { rivals: rest } : {}) } : null,
    added,
    displaced,
    rivalled: seen.length > Math.max(known.length, 1),
  };
}

function includes(list: readonly Uint8Array[], bytes: Uint8Array): boolean {
  return list.some((other) => bytesEqual(other, bytes));
}

/** Every version the log keeps of an event, in byte order. */
function versionsOf(record: StoredEvent): Uint8Array[] {
  return [record.bytes, ...(record.rivals ?? [])];
}

/** Every event of the group on this device: those stored, and those held for lack of room. */
export async function loadEvents(db: AppDb, groupId: string): Promise<Uint8Array[]> {
  const events = await db.getAllFromIndex('events', 'byGroup', groupId);
  return [...events.flatMap(versionsOf), ...heldEvents(db, groupId).map(({ bytes }) => bytes)];
}

/**
 * Stores what was held for lack of room, if there is room now, and counts the numbers of own
 * events among them as used. Returns whether nothing is held any longer.
 */
export async function storeHeld(db: AppDb, groupId: string): Promise<boolean> {
  const held = heldEvents(db, groupId);
  const forwarded = held.filter(({ outbox }) => outbox).map(({ bytes }) => bytes);
  const rest = held.filter(({ outbox }) => !outbox).map(({ bytes }) => bytes);
  try {
    if (forwarded.length > 0) await receiveEvents(db, groupId, forwarded, { forward: true });
    if (rest.length > 0) await receiveEvents(db, groupId, rest);
    for (const { bytes } of held.filter(({ own }) => own)) {
      const header = peekHeader(bytes);
      if (header.ok) await skipSequence(db, header.value.seq);
    }
  } catch (error) {
    console.warn('Storing what was held for lack of room failed', error);
  }
  return heldEvents(db, groupId).length === 0;
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

/** Forgets everything a group left on this device: its events, outbox, cursors and what is held. */
export async function deleteGroupEvents(db: AppDb, groupId: string): Promise<void> {
  release(
    db,
    groupId,
    heldEvents(db, groupId).map(({ bytes }) => bytes),
  );
  const tx = db.transaction(['events', 'outbox', 'cursors'], 'readwrite');
  for (const name of ['events', 'outbox'] as const) {
    const store = tx.objectStore(name);
    for (const key of await store.index('byGroup').getAllKeys(groupId)) await store.delete(key);
  }
  await tx.objectStore('cursors').delete(groupCursors(groupId));
  await tx.done;
}
