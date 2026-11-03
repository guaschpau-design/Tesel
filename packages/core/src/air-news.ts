// Whether an event is still worth its airtime (ARCHITECTURE.md §4.2–4.3, ADR-0015, ADR-0043):
// positions thinned, older positions dropped once a newer one is known, and bridged events left
// off the air once they are history rather than news.

import { eventRefKey, type LatLon, type NodeId } from '@tesel/protocol';

import { distanceMeters } from './geo.ts';
import { LIMITS, type LoraEvent, type LoraSource } from './lora-limits.ts';

/** What the scheduler has learnt about the group's traffic that decides what is still news. */
export class AirNews {
  #lastOwnPosition: { readonly at: LatLon; readonly time: number } | null = null;
  readonly #lastBridgedPosition = new Map<NodeId, number>();
  /** Each member's newest position or hiding seen: older positions are no longer worth sending. */
  readonly #newestLocation = new Map<NodeId, number>();
  /** SOS calls seen cancelled: no longer worth bridging, however recent. */
  readonly #cancelledSos = new Set<string>();

  /** An event arrived or was offered over any transport. */
  observe(event: LoraEvent): void {
    if (event.type === 'sos-cancel') this.#cancelledSos.add(eventRefKey(event.sos));
    if (event.type === 'position' || event.type === 'position-hidden') {
      const newest = this.#newestLocation.get(event.origin) ?? -1;
      if (event.seq > newest) this.#newestLocation.set(event.origin, event.seq);
    }
  }

  /**
   * Whether an event from the server is too old to bridge. Age is the sender's clock against
   * ours, so a wrong clock can only hold back what is not urgent: an SOS not cancelled, a
   * cancellation, an alert and a roll call are bridged however old, since they still call for
   * action.
   */
  isHistory(event: LoraEvent, now: number): boolean {
    if (stillNews(event, this.#cancelledSos)) return false;
    return now - event.time * 1000 > LIMITS.bridgeMaxAgeMs;
  }

  /** A position older than the member's newest position or hiding. */
  superseded(event: LoraEvent): boolean {
    if (event.type !== 'position') return false;
    return (this.#newestLocation.get(event.origin) ?? -1) > event.seq;
  }

  /** Whether a position may go now, thinned to the pace its source is allowed. */
  eligible(event: LoraEvent, source: LoraSource, now: number): boolean {
    if (event.type !== 'position') return true;
    if (source === 'bridged') {
      const last = this.#lastBridgedPosition.get(event.origin);
      return last === undefined || now - last >= LIMITS.bridgedPositionMs;
    }
    const last = this.#lastOwnPosition;
    if (last === null) return true;
    const elapsed = now - last.time;
    if (elapsed < LIMITS.ownPositionMinMs) return false;
    return (
      elapsed >= LIMITS.ownPositionMaxMs ||
      distanceMeters(last.at, event) >= LIMITS.ownPositionMinMeters
    );
  }

  /** An event went on the air: the next position of its source is judged against it. */
  sent(event: LoraEvent, source: LoraSource, now: number): void {
    if (event.type !== 'position') return;
    if (source === 'own') this.#lastOwnPosition = { at: event, time: now };
    else this.#lastBridgedPosition.set(event.origin, now);
  }

  /** Forgets everything learnt: the radio carries another group now. */
  clear(): void {
    this.#lastOwnPosition = null;
    this.#lastBridgedPosition.clear();
    this.#newestLocation.clear();
    this.#cancelledSos.clear();
  }
}

/** Events that call for action however long ago they were sent. */
function stillNews(event: LoraEvent, cancelledSos: ReadonlySet<string>): boolean {
  if (event.type === 'sos') return !cancelledSos.has(eventRefKey(event));
  return event.type === 'sos-cancel' || event.type === 'alert' || event.type === 'roll-call';
}
