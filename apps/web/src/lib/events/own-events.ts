// This device's own events (ARCHITECTURE.md §3.3): each takes the next sequence number of its group
// and a time no earlier than the last one's, and is stored in the log and the outbox in one
// transaction, so a crash never loses or reuses a number. Each group has a counter of its own, so
// members of one group cannot count this device's events in another (ADR-0111). An SOS, its
// cancellation or an acknowledgement goes out even when there is no room to store it (ADR-0103).

import { isLifeSafety } from '@tesel/core';
import { encodeEvent, peekHeader, type EventHeader, type TeselEvent } from '@tesel/protocol';

import {
  sequenceKey,
  type AppDb,
  type GroupSequenceKey,
  type OutboxEntry,
} from '../storage/app-db.ts';
import { storageRefusals, withRoom } from '../storage/storage-space.svelte.ts';
import { peekType } from '../sync/lora-events.ts';
import { hold } from './held-events.ts';

/** Largest sequence number: the field is an unsigned 32-bit integer (protocol §2). */
const MAX_SEQ = 0xffff_ffff;

/**
 * How far ahead of the clock the previous event's time may be and still be kept to, in seconds
 * (protocol §3.1): a clock put back a little keeps an author's events in order, while one that
 * ran far ahead and was set right does not hold every later event at its wrong time (ADR-0103).
 */
const KEEP_TO_PREVIOUS_S = 60 * 60;

/** An event that cannot be encoded, mostly for being too big for the radio (protocol §2). */
export class UnencodableEvent extends Error {}

export interface OwnEvent {
  readonly entry: OutboxEntry;
  readonly bytes: Uint8Array;
  /** False for an event that went out held in memory, without room to store it (held-events.ts). */
  readonly stored: boolean;
}

/**
 * Numbers and times taken by own events not stored yet, by database: while the app runs, no later
 * event takes a number of its group or a time below them, whatever the storage says.
 */
const taken = new WeakMap<AppDb, { readonly next: Map<string, number>; lastTime: number }>();

/**
 * Creates an event of this device. If it cannot be stored, an SOS, a cancellation or an
 * acknowledgement is returned all the same, held in memory until there is room; anything else
 * fails, as the user can try it again.
 */
export async function publishEvent(
  db: AppDb,
  groupId: string,
  build: (header: EventHeader) => TeselEvent,
  header: Omit<EventHeader, 'seq'>,
): Promise<OwnEvent> {
  /** The event of the last try to store it, which may go out unstored. */
  const tried: { event: OwnEvent | null } = { event: null };
  try {
    return await withRoom(async () => {
      const { event, stored } = await numberEvent(db, groupId, build, header);
      tried.event = event;
      await stored;
      return event;
    });
  } catch (error) {
    const event = tried.event;
    if (event === null || !isLifeSafety(peekType(event.bytes))) throw error;
    storageRefusals.note(error);
    take(db, groupId, event.bytes);
    hold(db, [{ groupId, bytes: event.bytes, outbox: true, own: true }]);
    return { ...event, stored: false };
  }
}

/**
 * Moves this device's next sequence number in a group past `seq`: one an event under this device's
 * name took there, written by someone else or held in memory before. Returns whether this device
 * had not used `seq` yet, as when someone writes under its name ahead of it. With no room to store
 * it, the number is kept from use while the app runs.
 */
export async function skipSequence(db: AppDb, groupId: string, seq: number): Promise<boolean> {
  const taking = taken.get(db)?.next.get(groupId) ?? 1;
  takeNumber(db, groupId, seq + 1, 0);
  try {
    const tx = db.transaction('sequence', 'readwrite');
    const next = await nextInGroup(tx.store, groupId);
    const skip = next <= seq ? tx.store.put(seq + 1, sequenceKey(groupId)) : undefined;
    await Promise.all([skip, tx.done]);
    return seq >= Math.max(next, taking);
  } catch (error) {
    storageRefusals.note(error);
    return seq >= taking;
  }
}

/**
 * Takes the next number and time and issues the writes of the event in one transaction. `stored`
 * says how they went: the event exists from here on, stored or not.
 */
async function numberEvent(
  db: AppDb,
  groupId: string,
  build: (header: EventHeader) => TeselEvent,
  header: Omit<EventHeader, 'seq'>,
): Promise<{ event: OwnEvent; stored: Promise<unknown> }> {
  const tx = db.transaction(['sequence', 'events', 'outbox'], 'readwrite');
  const sequence = tx.objectStore('sequence');
  const [next, last = 0] = await Promise.all([
    nextInGroup(sequence, groupId),
    sequence.get('lastTime'),
  ]);
  const memory = taken.get(db);
  const seq = Math.max(next, memory?.next.get(groupId) ?? 1);
  if (seq > MAX_SEQ) throw new RangeError('this device has used every sequence number');
  const time = stampTime(header.time, Math.max(last, memory?.lastTime ?? 0));
  const encoded = encodeEvent(build({ ...header, time, seq }));
  if (!encoded.ok) {
    tx.abort();
    await tx.done.catch(() => undefined); // The abort itself rejects `done`.
    throw new UnencodableEvent(`cannot encode event: ${encoded.error.detail}`);
  }
  const entry: OutboxEntry = { groupId, origin: header.origin, seq };
  const event = { entry, bytes: encoded.value, stored: true };
  try {
    const stored = Promise.all([
      sequence.put(seq + 1, sequenceKey(groupId)),
      sequence.put(time, 'lastTime'),
      tx.objectStore('events').put({ ...entry, bytes: encoded.value }),
      tx.objectStore('outbox').put(entry),
      tx.done,
    ]);
    return { event, stored };
  } catch (error) {
    // A write refused at once, as one with no room may be: the event exists all the same.
    return {
      event,
      stored: Promise.reject(error instanceof Error ? error : new Error(String(error))),
    };
  }
}

/**
 * The time to stamp: the clock's, or the previous event's while the clock is behind it by an hour
 * at most, so that a clock put back does not make an event older than the one before (protocol
 * §3.1). A previous time further ahead was stamped by a clock that ran ahead and has been set
 * right since: keeping to it would hold every later event at that wrong time.
 */
function stampTime(clock: number, previous: number): number {
  return previous > clock && previous - clock <= KEEP_TO_PREVIOUS_S ? previous : clock;
}

/**
 * The next number of a group as stored. Before version 8 of the database one counter, under
 * `next`, numbered every group; it is no longer moved, and each group's own counter starts at it,
 * above every number this device used before (ADR-0111).
 */
async function nextInGroup(
  sequence: { get(key: 'next' | GroupSequenceKey): Promise<number | undefined> },
  groupId: string,
): Promise<number> {
  const [own, shared] = await Promise.all([
    sequence.get(sequenceKey(groupId)),
    sequence.get('next'),
  ]);
  return Math.max(own ?? 1, shared ?? 1);
}

/** Keeps the number and time of an event that went out unstored from being used again. */
function take(db: AppDb, groupId: string, bytes: Uint8Array): void {
  const header = peekHeader(bytes);
  if (header.ok) takeNumber(db, groupId, header.value.seq + 1, header.value.time);
}

function takeNumber(db: AppDb, groupId: string, next: number, time: number): void {
  const known = taken.get(db) ?? { next: new Map<string, number>(), lastTime: 0 };
  known.next.set(groupId, Math.max(next, known.next.get(groupId) ?? 1));
  known.lastTime = Math.max(time, known.lastTime);
  taken.set(db, known);
}
