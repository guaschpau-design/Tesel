// What the LoRa scheduler handles, and the limits it keeps to (ARCHITECTURE.md §4.2–4.3, ADR-0015,
// ADR-0043).

import type { EventHeader, TeselEvent } from '@tesel/protocol';

import { URGENCY } from './urgency.ts';

/** Where an event came from: this device, or the server (this device is bridging it). */
export type LoraSource = 'own' | 'bridged';

/**
 * An event of a type this version does not know: only its header can be read. Bridges still
 * carry it, de-duplicated by the header (protocol §3.1).
 */
export interface OpaqueEvent extends EventHeader {
  readonly type: null;
}

export type LoraEvent = TeselEvent | OpaqueEvent;

export interface LoraPacket {
  readonly event: LoraEvent;
  /**
   * The bytes to put on the air, whose length the airtime budget weighs: in the app, the event
   * sealed for the radio (protocol §5.2).
   */
  readonly bytes: Uint8Array;
}

const MINUTE = 60_000;

export const LIMITS = {
  /** The duty-cycle window. */
  windowMs: 60 * MINUTE,
  /** Tesel uses half the legal 10 %, leaving room for repeaters and other traffic... */
  normalBudgetMs: 0.05 * 60 * MINUTE,
  /** ...except for the most urgent events, which may use all of it. */
  urgentBudgetMs: 0.1 * 60 * MINUTE,
  /** Own positions: at most one every 2 minutes, and only after moving 50 m or 10 minutes. */
  ownPositionMinMs: 2 * MINUTE,
  ownPositionMinMeters: 50,
  ownPositionMaxMs: 10 * MINUTE,
  /** Positions from the server: at most one every 5 minutes per member. */
  bridgedPositionMs: 5 * MINUTE,
  /**
   * Events from the server older than this are history, not news: they are not bridged, unless
   * they still call for action (`stillNews` in air-news.ts).
   */
  bridgeMaxAgeMs: 10 * MINUTE,
  /** Bridged events wait up to this long, so several bridges do not all repeat them. */
  bridgeDelayMs: 10_000,
  /** An ACK over LoRa waits 2–30 s and is dropped if another member's ACK is heard first. */
  ackDelayMinMs: 2_000,
  ackDelayMaxMs: 30_000,
  /**
   * Own SOS repeats: first after 30 s, doubling up to every 5 minutes, until someone acknowledges
   * or cancels it. At 5 minutes an SOS takes under 1 % of the airtime.
   */
  sosFirstRepeatMs: 30_000,
  sosMaxRepeatMs: 5 * MINUTE,
  /** A send the radio refused is retried after this long. */
  retryMs: 10_000,
  /** Queued packets at most; beyond it the least urgent go, bridged ones first. */
  maxPending: 500,
} as const;

/** Events urgent enough to use the full legal budget. */
export const URGENT = URGENCY.alert;
