// Rivals: different events under one `(origin, seq)` (protocol §3.1, ADR-0103). A member can write
// under another's name, and so take a number that member has not used yet; the server keeps every
// version (ADR-0045). Every device keeps the same of them, whatever order they arrive in, and never
// lets one hide an SOS, its cancellation or an acknowledgement.

import {
  compareBytes,
  decodeEvent,
  encodeEvent,
  eventRefKey,
  toBase64url,
  type EventType,
} from '@tesel/protocol';

import type { LoraEvent } from './lora-limits.ts';
import { isLifeSafety } from './urgency.ts';

/**
 * Of the versions of one event received, those a device keeps, in the order of their bytes: every
 * SOS, cancellation and acknowledgement among them, all of which reach the group since none can be
 * told genuine; or, if there is none, the one whose bytes come first. Either way the rule depends
 * on the set alone, so every device that sees the same versions keeps the same ones.
 */
export function keptRivals(versions: readonly Uint8Array[]): Uint8Array[] {
  const distinct: Uint8Array[] = [];
  for (const bytes of [...versions].sort(compareBytes)) {
    const last = distinct.at(-1);
    if (last === undefined || compareBytes(last, bytes) !== 0) distinct.push(bytes);
  }
  const lifeSafety = distinct.filter((bytes) => isLifeSafety(typeOf(bytes)));
  return lifeSafety.length > 0 ? lifeSafety : distinct.slice(0, 1);
}

/**
 * What tells an event apart from its rivals where several may be kept: its reference, and for an
 * SOS, a cancellation or an acknowledgement also its bytes. Other events have one version kept.
 */
export function rivalKey(event: LoraEvent): string {
  const reference = eventRefKey(event);
  if (event.type === null || !isLifeSafety(event.type)) return reference;
  const bytes = encodeEvent(event);
  return bytes.ok ? `${reference}/${toBase64url(bytes.value)}` : reference;
}

function typeOf(bytes: Uint8Array): EventType | null {
  const event = decodeEvent(bytes);
  return event.ok ? event.value.type : null;
}
