// What an event heard by radio on the channel of a group that is not open still means here: an
// acknowledgement or a cancellation ends an own SOS that keeps repeating there (ADR-0104), and an
// SOS or its cancellation is for the alarm (incidents/sos-elsewhere.svelte.ts).

import { decodeEvent, type AckEvent, type SosCancelEvent, type SosEvent } from '@tesel/protocol';

/** An SOS call or its cancellation, heard for a group of this device that is not open. */
export interface SosElsewhere {
  readonly groupId: string;
  readonly event: SosEvent | SosCancelEvent;
}

/** The event in `bytes`, if it is an SOS, its cancellation or an acknowledgement. */
export function sosNewsIn(bytes: Uint8Array): SosEvent | SosCancelEvent | AckEvent | null {
  const decoded = decodeEvent(bytes);
  if (!decoded.ok) return null;
  const event = decoded.value;
  return event.type === 'sos' || event.type === 'sos-cancel' || event.type === 'ack' ? event : null;
}
