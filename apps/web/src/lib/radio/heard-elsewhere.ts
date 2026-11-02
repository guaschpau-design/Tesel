// What an event heard by radio on the channel of a group that is not open still means here: an
// acknowledgement or a cancellation ends an own SOS that keeps repeating there (ADR-0104).

import { decodeEvent, type AckEvent, type SosCancelEvent, type SosEvent } from '@tesel/protocol';

/** The event in `bytes`, if it is an SOS, its cancellation or an acknowledgement. */
export function sosNewsIn(bytes: Uint8Array): SosEvent | SosCancelEvent | AckEvent | null {
  const decoded = decodeEvent(bytes);
  if (!decoded.ok) return null;
  const event = decoded.value;
  return event.type === 'sos' || event.type === 'sos-cancel' || event.type === 'ack' ? event : null;
}
