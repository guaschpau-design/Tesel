// What to send over LoRa, and when (ARCHITECTURE.md §4.2–4.3, protocol §3.8).
//
// LoRa is slow and EU law allows a transmitter at most 10 % airtime in the 869.4–869.65 MHz
// sub-band. The scheduler queues events, sends the most urgent first, keeps a rolling one-hour
// airtime budget, thins positions, repeats an own SOS until someone acknowledges or cancels it,
// even after the radio changes group (ADR-0104), and applies the bridging rules to events that
// came from the server (ADR-0015, ADR-0043). It is pure: time and randomness are passed in, and
// the caller does the sending: it takes one packet with `next`, then reports `sent` or `retry`.

import { eventRefKey } from '@tesel/protocol';

import { AirNews } from './air-news.ts';
import { AirtimeWindow, type AirtimeUse } from './airtime.ts';
import { LIMITS, URGENT, type LoraEvent, type LoraPacket, type LoraSource } from './lora-limits.ts';
import { rivalKey } from './rivals.ts';
import { repeatWaitMs, SosRepeats } from './sos-repeats.ts';
import { urgencyOf } from './urgency.ts';

interface Pending<Packet extends LoraPacket> {
  readonly key: string;
  readonly packet: Packet;
  readonly source: LoraSource;
  readonly dueAt: number;
  /** For an own SOS: how many times it has been sent. */
  readonly sends: number;
}

/**
 * `Packet` is what the caller queues: a packet with whatever else it needs to send it, such as the
 * channel it goes out on, since an own SOS outlives a change of group.
 */
export class LoraScheduler<Packet extends LoraPacket = LoraPacket> {
  readonly #random: () => number;
  readonly #airtimeMs: (bytes: number) => number;
  /**
   * Queued packets, by rival key (rivals.ts): an SOS, a cancellation or an acknowledgement forged
   * under the `(origin, seq)` of another is aired as well as the genuine one, not instead of it.
   */
  readonly #pending = new Map<string, Pending<Packet>>();
  /** Rival keys sent by us or heard on LoRa in the last hour, with when: not put on the air again. */
  readonly #onAir = new Map<string, number>();
  readonly #sos = new SosRepeats();
  readonly #news = new AirNews();
  /** Roll calls seen: each member answers them, so their ACKs are never dropped (§3.12). */
  readonly #rollCalls = new Set<string>();
  /** SOS calls, critical alerts and roll calls seen: their acknowledgements are urgent too. */
  readonly #urgentTargets = new Set<string>();
  /**
   * Events another member acknowledged on the air (roll calls aside): the sender heard that, so a
   * later ACK of them, own or bridged, would only add noise.
   */
  readonly #ackedOnAir = new Set<string>();
  readonly #airtime = new AirtimeWindow(LIMITS.windowMs);
  /** Counts group changes, so a packet in flight across one is not put back on the new group. */
  #group = 0;
  /** The packet handed out by `next`, until the caller reports how sending it went. */
  #inFlight: {
    readonly pending: Pending<Packet>;
    readonly cost: number;
    readonly group: number;
  } | null = null;

  /**
   * `airtimeMs` says how long an event of so many bytes keeps the air busy with the radio in use:
   * it is asked each time a packet is weighed, so a radio linked later counts at its own rate.
   */
  constructor(options: { random: () => number; airtimeMs: (bytes: number) => number }) {
    this.#random = options.random;
    this.#airtimeMs = options.airtimeMs;
  }

  /** Queues an event for LoRa. Repeated offers of the same event change nothing. */
  offer(packet: Packet, source: LoraSource, now: number): void {
    const { event } = packet;
    const key = rivalKey(event);
    this.observe(event);
    if (this.#onAir.has(key) || this.#pending.has(key)) return;
    if (event.type === 'ack' && this.#ackedOnAir.has(eventRefKey(event.target))) return;
    if (source === 'bridged' && this.#news.isHistory(event, now)) return;
    if (this.#news.superseded(event)) return;
    for (const [otherKey, other] of this.#pending) {
      if (this.#news.superseded(other.packet.event)) this.#pending.delete(otherKey);
    }
    if (event.type === 'sos' && source === 'own') this.#sos.open(key, eventRefKey(event));
    this.#pending.set(key, {
      key,
      packet,
      source,
      dueAt: now + this.#delay(event, source),
      sends: 0,
    });
    this.#keepWithinLimit();
  }

  /**
   * An event arrived over LoRa: it is on the air already, so it is not sent again. An own SOS
   * heard back from another bridge still repeats until someone answers it.
   */
  heard(event: LoraEvent, now: number): void {
    const key = rivalKey(event);
    this.#onAir.set(key, now);
    if (!this.#sos.isOpen(key)) this.#pending.delete(key);
    this.observe(event);
    if (event.type === 'ack' && !this.#rollCalls.has(eventRefKey(event.target))) {
      // Another member acknowledged, and the sender heard it as we did: our own ACK for the same
      // event, or one we bridge, would only add noise.
      const target = eventRefKey(event.target);
      this.#ackedOnAir.add(target);
      for (const [pendingKey, pending] of this.#pending) {
        const queued = pending.packet.event;
        if (queued.type === 'ack' && eventRefKey(queued.target) === target) {
          this.#pending.delete(pendingKey);
        }
      }
    }
  }

  /** An event arrived over any transport: acknowledgements and cancellations end SOS repeats. */
  observe(event: LoraEvent): void {
    const key = eventRefKey(event);
    this.#news.observe(event);
    if (event.type === 'ack') this.#closeSos(eventRefKey(event.target));
    if (event.type === 'sos-cancel') this.#closeSos(eventRefKey(event.sos));
    if (event.type === 'roll-call') this.#rollCalls.add(key);
    if (
      event.type === 'sos' ||
      event.type === 'roll-call' ||
      (event.type === 'alert' && event.level === 'critical')
    ) {
      this.#urgentTargets.add(key);
    }
  }

  /**
   * Forgets the traffic of the group the radio carried until now, when it changes to another
   * group's channel: nothing queued for one group may go out on another's. Own SOS calls still
   * open are kept: they repeat on their own group's channel until answered (ADR-0104), and the
   * caller tells the acknowledgements and cancellations it hears for them (`observe`). The airtime
   * spent stays, since the budget belongs to the radio, and so does that of a packet in flight.
   */
  changeGroup(): void {
    this.#group += 1;
    for (const key of this.#pending.keys()) {
      if (!this.#sos.isOpen(key)) this.#pending.delete(key);
    }
    this.#onAir.clear();
    this.#rollCalls.clear();
    this.#urgentTargets.clear();
    this.#ackedOnAir.clear();
    this.#news.clear();
  }

  /**
   * The next packet to send now, if any fits the airtime budget. One packet at a time: the
   * caller reports `sent` or `retry` before asking again.
   */
  next(now: number): Packet | null {
    if (this.#inFlight !== null) return null;
    this.#forgetOnAirBefore(now - LIMITS.windowMs);
    // What waited in the queue for the budget may have become history, or been superseded by a
    // newer position heard meanwhile.
    for (const [key, pending] of this.#pending) {
      const { event } = pending.packet;
      const history = pending.source === 'bridged' && this.#news.isHistory(event, now);
      if (history || this.#news.superseded(event)) this.#pending.delete(key);
    }
    const due = [...this.#pending.values()]
      .filter(
        (pending) =>
          pending.dueAt <= now && this.#news.eligible(pending.packet.event, pending.source, now),
      )
      .sort((a, b) => this.#urgency(a) - this.#urgency(b) || a.dueAt - b.dueAt);
    const spent = this.#airtime.usedMs(now);
    // Once a packet does not fit its budget, nothing less urgent on that budget goes before it:
    // otherwise a stream of small positions could hold back a long message for good.
    const waiting = new Set<number>();
    for (const pending of due) {
      const cost = this.#airtimeMs(pending.packet.bytes.length);
      const budget =
        this.#urgency(pending) <= URGENT ? LIMITS.urgentBudgetMs : LIMITS.normalBudgetMs;
      if (waiting.has(budget)) continue;
      if (spent + cost > budget) {
        waiting.add(budget);
        continue;
      }
      this.#pending.delete(pending.key);
      this.#inFlight = { pending, cost, group: this.#group };
      return pending.packet;
    }
    return null;
  }

  /** The packet from `next` went on the air. */
  sent(now: number): void {
    const inFlight = this.#inFlight;
    if (inFlight === null) return;
    this.#inFlight = null;
    this.#airtime.add(now, inFlight.cost);
    if (this.#stillQueued(inFlight)) this.#markSent(inFlight.pending, now);
  }

  /** The radio refused the packet from `next`: try it again a little later. */
  retry(now: number): void {
    const inFlight = this.#inFlight;
    if (inFlight === null) return;
    this.#inFlight = null;
    const { pending } = inFlight;
    if (!this.#stillQueued(inFlight) || this.#pending.has(pending.key)) return;
    // Heard from someone else meanwhile, or superseded by a newer position: let it go. An own SOS
    // still open was on the air before, and keeps repeating until it is answered.
    const open = this.#sos.isOpen(pending.key);
    const gone = this.#onAir.has(pending.key) || this.#news.superseded(pending.packet.event);
    if (!open && gone) return;
    this.#pending.set(pending.key, { ...pending, dueAt: now + LIMITS.retryMs });
  }

  /** Drops the queued packets that `matches`, and their repeats: those of a group left. */
  forget(matches: (packet: Packet) => boolean): void {
    for (const [key, pending] of this.#pending) {
      if (!matches(pending.packet)) continue;
      this.#pending.delete(key);
      this.#sos.drop(key);
    }
    const inFlight = this.#inFlight?.pending;
    if (inFlight !== undefined && matches(inFlight.packet)) this.#sos.drop(inFlight.key);
  }

  /** Airtime used in the current window, in milliseconds. */
  spentMs(now: number): number {
    return this.#airtime.usedMs(now);
  }

  /** The airtime used in the current window, each send on its own: what the caller keeps. */
  airtimeUses(now: number): AirtimeUse[] {
    return this.#airtime.uses(now);
  }

  /**
   * Counts airtime used before, kept by the caller (`airtimeUses`): the budget belongs to the
   * radio, and a restart of the app must not give it a fresh one.
   */
  restoreAirtime(uses: readonly AirtimeUse[], now: number): void {
    this.#airtime.restore(uses, now);
  }

  /**
   * How urgent a queued packet is: its type's urgency, except that an acknowledgement of an SOS,
   * a critical alert or a roll call is as urgent as an alert.
   */
  #urgency(pending: Pending<Packet>): number {
    const { event } = pending.packet;
    if (event.type === 'ack' && this.#urgentTargets.has(eventRefKey(event.target))) return URGENT;
    return urgencyOf(event.type);
  }

  /** Drops the least urgent queued packets beyond the limit, bridged before own, oldest first. */
  #keepWithinLimit(): void {
    const excess = this.#pending.size - LIMITS.maxPending;
    if (excess <= 0) return;
    const leastNeeded = [...this.#pending.values()].sort(
      (a, b) =>
        this.#urgency(b) - this.#urgency(a) ||
        Number(b.source === 'bridged') - Number(a.source === 'bridged') ||
        a.dueAt - b.dueAt,
    );
    for (const pending of leastNeeded.slice(0, excess)) this.#pending.delete(pending.key);
  }

  #delay(event: LoraEvent, source: LoraSource): number {
    if (source === 'bridged') return this.#random() * LIMITS.bridgeDelayMs;
    if (event.type === 'ack') {
      return LIMITS.ackDelayMinMs + this.#random() * (LIMITS.ackDelayMaxMs - LIMITS.ackDelayMinMs);
    }
    return 0;
  }

  /** Whether a packet in flight still belongs in the queue: of the group now, or an open own SOS. */
  #stillQueued(inFlight: { readonly pending: Pending<Packet>; readonly group: number }): boolean {
    return inFlight.group === this.#group || this.#sos.isOpen(inFlight.pending.key);
  }

  #markSent(pending: Pending<Packet>, now: number): void {
    this.#onAir.set(pending.key, now);
    this.#news.sent(pending.packet.event, pending.source, now);
    const sends = pending.sends + 1;
    if (this.#sos.isOpen(pending.key)) {
      // Repeats are byte-identical, so receivers de-duplicate them (protocol §3.8).
      this.#pending.set(pending.key, { ...pending, dueAt: now + repeatWaitMs(sends), sends });
    }
  }

  /** An own SOS was answered or cancelled: every call under its reference stops repeating. */
  #closeSos(reference: string): void {
    for (const key of this.#sos.close(reference)) {
      const pending = this.#pending.get(key);
      if (pending !== undefined && pending.sends > 0) this.#pending.delete(key);
    }
  }

  #forgetOnAirBefore(time: number): void {
    for (const [key, at] of this.#onAir) if (at < time) this.#onAir.delete(key);
  }
}
