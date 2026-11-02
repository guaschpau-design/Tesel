// Encoded events as the radio scheduler sees them (packages/core lora-scheduler): decoded when
// this version knows their type, or only their header otherwise, so they can still be bridged;
// and what a radio is given when it connects.

import {
  openSosCalls,
  type GroupState,
  type LoraEvent,
  type LoraPacket,
  type LoraSource,
} from '@tesel/core';
import {
  decodeEvent,
  encodeEvent,
  eventRefKey,
  peekHeader,
  type EventType,
  type NodeId,
  type TeselEvent,
} from '@tesel/protocol';

import type { OutboxEntry } from '../storage/app-db.ts';

/** Where a group feed hands events for the radio: the LoRa scheduler of a connected radio. */
export interface LoraSink {
  /**
   * Offers an event for the air, `packet.bytes` encoded as stored. The radio seals it into a
   * frame for the scheduler (protocol §5.2), and keeps off the air one too large for a frame.
   */
  offer(packet: LoraPacket, source: LoraSource): void;
  heard(event: LoraEvent): void;
  observe(event: LoraEvent): void;
}

/**
 * An encoded event as the radio sees it: decoded, or only its header if its type is unknown; null
 * if it is damaged, as a damaged copy says nothing of the event it claims to be.
 */
export function loraEventOf(bytes: Uint8Array): LoraEvent | null {
  const event = decodeEvent(bytes);
  if (event.ok) return event.value;
  if (event.error.code !== 'unknown-type') return null;
  const header = peekHeader(bytes);
  if (!header.ok) return null;
  const { origin, seq, time } = header.value;
  return { type: null, origin, seq, time };
}

/** The type of an encoded event, or null if this version does not know it. */
export function peekType(bytes: Uint8Array): EventType | null {
  return loraEventOf(bytes)?.type ?? null;
}

/**
 * What a radio that has just connected learns of the group before anything is queued: the SOS
 * calls and their cancellations. Acknowledgements of an SOS are urgent, and a cancelled SOS is no
 * longer bridged.
 */
export function standingEvents(state: GroupState): TeselEvent[] {
  return [...[...state.sos.values()].flat(), ...state.sosCancels.values()];
}

/**
 * What a radio that has just connected is given of this device's own (ADR-0043): its
 * announcement, as members who only hear the radio learn its alias from it; its SOS calls still
 * open and not answered, which repeat until answered; and its events still waiting for the server
 * that have not been on the air.
 */
export function catchUpPackets(
  state: GroupState,
  self: NodeId,
  pending: readonly { readonly entry: OutboxEntry; readonly bytes: Uint8Array }[],
): LoraPacket[] {
  const due: TeselEvent[] = [];
  const announcement = state.members.get(self);
  if (announcement !== undefined) due.push(announcement);
  for (const [, call] of openSosCalls(state)) {
    const acks = state.acks.get(eventRefKey(call));
    const answered = [...(acks?.keys() ?? [])].some((member) => member !== self);
    if (call.origin === self && !answered) due.push(call);
  }
  const packets = due.flatMap((event): LoraPacket[] => {
    const bytes = encodeEvent(event);
    return bytes.ok ? [{ event, bytes: bytes.value }] : [];
  });
  for (const { entry, bytes } of pending) {
    const event = loraEventOf(bytes);
    if (entry.origin === self && entry.aired !== true && event !== null) {
      packets.push({ event, bytes });
    }
  }
  return packets;
}
