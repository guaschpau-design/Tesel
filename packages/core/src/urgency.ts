// How urgent each kind of event is, for every transport that has to choose what goes first: the
// LoRa scheduler, and the outbox when it catches up with a server (ARCHITECTURE.md §4.2); and which
// events nothing may keep from the group (ADR-0103).

import type { EventType } from '@tesel/protocol';

/** Lower is more urgent. `POSITION_HIDDEN` is high so hiding is never delayed by positions. */
export const URGENCY: Readonly<Record<EventType, number>> = {
  sos: 0,
  'sos-cancel': 1,
  alert: 2,
  'roll-call': 2,
  'position-hidden': 3,
  report: 3,
  'zone-crossing': 3,
  ack: 4,
  chat: 5,
  task: 5,
  marker: 6,
  shape: 6,
  'object-delete': 6,
  sweep: 6,
  team: 6,
  'check-in-timer': 6,
  'member-info': 7,
  'member-state': 7,
  position: 8,
};

/** Urgency of an event type this version may not know: after every known one. */
export function urgencyOf(type: EventType | null): number {
  return type === null ? 9 : URGENCY[type];
}

/**
 * Whether an event of this type is an SOS, its cancellation or an acknowledgement: what may save a
 * life, and must reach the group whatever else goes wrong. A full storage does not keep it from the
 * picture or the server, a backlog does not hold it back, and an event forged under its `(origin,
 * seq)` does not hide it (protocol §3.1, ADR-0103). Every acknowledgement counts, whatever it
 * answers: whether its target is an SOS may not be known yet where this is decided, and the app
 * acknowledges nothing else (ADR-0070).
 */
export function isLifeSafety(type: EventType | null): boolean {
  return type === 'sos' || type === 'sos-cancel' || type === 'ack';
}
