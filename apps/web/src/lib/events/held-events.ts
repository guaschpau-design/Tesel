// Events this device could not store for lack of room (ADR-0103): SOS calls, their cancellations
// and acknowledgements, which must reach the picture and the group however full the storage is.
// The event log keeps them here, in memory, reads them with what it stores, and stores them as soon
// as there is room (`storeHeld` in event-log.ts). Nothing else is held: the rest waits for its
// sender, or the server, to send it again.

import { bytesEqual, peekHeader } from '@tesel/protocol';

import type { AppDb, GroupEventRef } from '../storage/app-db.ts';

export interface HeldEvent {
  readonly groupId: string;
  readonly bytes: Uint8Array;
  /** Waits for the server too, as the outbox would: own, or heard by radio and forwarded. */
  readonly outbox: boolean;
  /** Written by this device: its sequence number counts as used once it is stored. */
  readonly own: boolean;
}

/** By database, so that tests with a database each do not share what is held. */
const held = new WeakMap<AppDb, HeldEvent[]>();

/** Holds events until they can be stored; one held already only gains a wait for the server. */
export function hold(db: AppDb, events: readonly HeldEvent[]): void {
  let list = held.get(db) ?? [];
  for (const event of events) {
    const known = list.find((other) => sameEvent(other, event));
    if (known === undefined) list = [...list, event];
    else if (event.outbox && !known.outbox) {
      list = list.map((other) => (other === known ? { ...known, outbox: true } : other));
    }
  }
  held.set(db, list);
}

export function heldEvents(db: AppDb, groupId: string): readonly HeldEvent[] {
  return (held.get(db) ?? []).filter((event) => event.groupId === groupId);
}

/** Lets go of what the log now has, or has dropped for a rival: it no longer needs holding. */
export function release(db: AppDb, groupId: string, settled: readonly Uint8Array[]): void {
  const list = held.get(db);
  if (list === undefined) return;
  const left = list.filter(
    (event) => !settled.some((bytes) => sameEvent(event, { groupId, bytes })),
  );
  if (left.length < list.length) held.set(db, left);
}

/** The server has stored the event of a held outbox entry: it waits for nothing but room. */
export function heldSent(db: AppDb, entry: GroupEventRef): void {
  const list = held.get(db);
  if (list === undefined) return;
  held.set(
    db,
    list.map((event) =>
      event.outbox && isFor(event, entry) ? { ...event, outbox: false } : event,
    ),
  );
}

/** Whether a held event is the one of an entry, by its group and reference. */
function isFor(event: HeldEvent, entry: GroupEventRef): boolean {
  const header = peekHeader(event.bytes);
  return (
    event.groupId === entry.groupId &&
    header.ok &&
    header.value.origin === entry.origin &&
    header.value.seq === entry.seq
  );
}

function sameEvent(
  a: Pick<HeldEvent, 'groupId' | 'bytes'>,
  b: Pick<HeldEvent, 'groupId' | 'bytes'>,
): boolean {
  return a.groupId === b.groupId && bytesEqual(a.bytes, b.bytes);
}
