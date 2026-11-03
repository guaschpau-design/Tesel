import type { NodeId, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { LIMITS, type LoraPacket } from './lora-limits.ts';
import { LoraScheduler } from './lora-scheduler.ts';

const ME = 'a1b2c3d4' as NodeId;
const OTHER = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;
const VALENCIA = { lat: 39.4699, lon: -0.3763 };

let seq = 0;
function packet(event: Omit<TeselEvent, 'seq' | 'time'> & Partial<TeselEvent>): LoraPacket {
  seq++;
  return { event: { seq, time: T0, ...event } as TeselEvent, bytes: new Uint8Array(40) };
}

const chat = (origin = ME) => packet({ type: 'chat', origin, text: 'hola' });
const position = (at = VALENCIA, origin = ME) =>
  packet({ type: 'position', origin, ...at, accuracy: 5, heading: null, speed: null });
const sos = () =>
  packet({ type: 'sos', origin: ME, kind: 'medical', ...VALENCIA, accuracy: 5, text: '' });

/** A scheduler where every packet costs 1 s of airtime and randomness is fixed. */
const scheduler = (random = 0) =>
  new LoraScheduler({ random: () => random, airtimeMs: () => 1000 });

/** Sends with `next` and `sent` until nothing is left, collecting the event types sent. */
function drain(lora: LoraScheduler, now: number): (string | null)[] {
  const sent: (string | null)[] = [];
  for (let packet = lora.next(now); packet !== null; packet = lora.next(now)) {
    lora.sent(now);
    sent.push(packet.event.type);
  }
  return sent;
}

describe('LoRa scheduler', () => {
  it('sends the most urgent event first', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    lora.offer(chat(), 'own', 0);
    lora.offer(packet({ type: 'alert', origin: ME, level: 'critical', text: 'Evacuad' }), 'own', 0);
    lora.offer(packet({ type: 'position-hidden', origin: OTHER }), 'own', 0);
    expect(drain(lora, 0)).toEqual(['alert', 'position-hidden', 'chat', 'position']);
  });

  it('never sends the same event twice, nor one already heard on the air', () => {
    const lora = scheduler();
    const message = chat();
    lora.offer(message, 'own', 0);
    lora.offer(message, 'own', 0);
    expect(drain(lora, 0)).toEqual(['chat']);
    lora.offer(message, 'own', 1);
    expect(drain(lora, 1)).toEqual([]);

    const heard = chat(OTHER);
    lora.heard(heard.event, 2);
    lora.offer(heard, 'bridged', 2);
    expect(drain(lora, 20_000)).toEqual([]);
  });

  it('keeps ordinary traffic within half of the legal duty cycle, urgent traffic within all of it', () => {
    const lora = scheduler();
    const normalSlots = LIMITS.normalBudgetMs / 1000;
    for (let i = 0; i < normalSlots + 5; i++) lora.offer(chat(), 'own', 0);
    expect(drain(lora, 0)).toHaveLength(normalSlots);
    lora.offer(packet({ type: 'alert', origin: ME, level: 'warning', text: '!' }), 'own', 0);
    expect(drain(lora, 0)).toEqual(['alert']);
    // An hour later the budget is free again.
    expect(drain(lora, LIMITS.windowMs + 1)).toHaveLength(5);
  });

  it('lets nothing less urgent go before a message that waits for room in the budget', () => {
    // Positions cost 1 s and a long chat message 3 s: the budget is spent but for 2 s.
    const lora = new LoraScheduler({
      random: () => 0,
      airtimeMs: (bytes) => (bytes > 100 ? 3000 : 1000),
    });
    const normalSlots = LIMITS.normalBudgetMs / 1000;
    for (let i = 0; i < normalSlots - 2; i++) lora.offer(chat(), 'own', 0);
    expect(drain(lora, 0)).toHaveLength(normalSlots - 2);
    const long = { ...chat(), bytes: new Uint8Array(160) };
    lora.offer(long, 'own', 1);
    lora.offer(position(), 'own', 1);
    // The position would fit, but the message came first in urgency: both wait.
    expect(drain(lora, 1)).toEqual([]);
    expect(drain(lora, LIMITS.windowMs + 1)).toEqual(['chat', 'position']);
  });

  it('thins own positions to one every 2 minutes, and only after moving 50 m or 10 minutes', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    expect(drain(lora, 0)).toEqual(['position']);

    const nearby = { lat: VALENCIA.lat + 0.0002, lon: VALENCIA.lon }; // about 22 m
    const far = { lat: VALENCIA.lat + 0.001, lon: VALENCIA.lon }; // about 111 m
    lora.offer(position(far), 'own', 60_000);
    expect(drain(lora, 60_000)).toEqual([]); // too soon
    expect(drain(lora, 2 * 60_000)).toEqual(['position']);

    lora.offer(position(nearby), 'own', 3 * 60_000);
    lora.offer(position(far), 'own', 3 * 60_000); // replaces the queued one
    expect(drain(lora, 5 * 60_000)).toEqual([]); // has not moved 50 m from the last sent
    expect(drain(lora, 12 * 60_000)).toEqual(['position']);
  });

  it('drops a queued position when the member hides it', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    drain(lora, 0);
    lora.offer(position({ lat: 40, lon: -3 }), 'own', 1000);
    lora.offer(packet({ type: 'position-hidden', origin: ME }), 'own', 1000);
    expect(drain(lora, 10 * 60_000)).toEqual(['position-hidden']);
  });

  it('delays bridged events and skips them if another bridge sends them first', () => {
    const lora = scheduler(0.5);
    const fromServer = chat(OTHER);
    lora.offer(fromServer, 'bridged', 0);
    expect(drain(lora, 4_999)).toEqual([]);
    lora.heard(fromServer.event, 4_000);
    expect(drain(lora, 20_000)).toEqual([]);

    lora.offer(chat(OTHER), 'bridged', 0);
    expect(drain(lora, 5_000)).toEqual(['chat']);
  });

  it('does not bridge history: events from the server older than 10 minutes', () => {
    const lora = scheduler();
    const old = chat(OTHER); // sent at T0
    lora.offer(old, 'bridged', (T0 + 11 * 60) * 1000);
    expect(drain(lora, (T0 + 12 * 60) * 1000)).toEqual([]);
    lora.offer(chat(OTHER), 'bridged', (T0 + 9 * 60) * 1000);
    expect(drain(lora, (T0 + 10 * 60) * 1000)).toEqual(['chat']);
  });

  it('bridges what still calls for action however old: an open SOS, alerts, roll calls', () => {
    const lora = scheduler();
    const later = (T0 + 60 * 60) * 1000;
    const open = packet({
      type: 'sos',
      origin: OTHER,
      kind: 'trapped',
      ...VALENCIA,
      accuracy: 9,
      text: '',
    });
    lora.offer(open, 'bridged', later);
    lora.offer(
      packet({ type: 'alert', origin: OTHER, level: 'critical', text: '!' }),
      'bridged',
      later,
    );
    lora.offer(packet({ type: 'roll-call', origin: OTHER, text: '' }), 'bridged', later);
    expect(drain(lora, later + 10_000).sort()).toEqual(['alert', 'roll-call', 'sos']);

    const cancelled = packet({
      type: 'sos',
      origin: OTHER,
      kind: 'trapped',
      ...VALENCIA,
      accuracy: 9,
      text: '',
    });
    lora.observe({ type: 'sos-cancel', origin: OTHER, seq: 500, time: T0, sos: cancelled.event });
    lora.offer(cancelled, 'bridged', later);
    expect(drain(lora, later + 20_000)).toEqual([]);
  });

  it('drops bridged news that waited in the queue until it became history', () => {
    const lora = scheduler();
    const now = (T0 + 9 * 60) * 1000;
    lora.offer(chat(OTHER), 'bridged', now);
    expect(drain(lora, now + 2 * 60_000)).toEqual([]);
  });

  it('sends bridged positions of a member at most every 5 minutes', () => {
    const lora = scheduler();
    lora.offer(position(VALENCIA, OTHER), 'bridged', 0);
    expect(drain(lora, 0)).toEqual(['position']);
    lora.offer(position({ lat: 40, lon: -3 }, OTHER), 'bridged', 60_000);
    expect(drain(lora, 60_000)).toEqual([]);
    expect(drain(lora, 5 * 60_000)).toEqual(['position']);
  });

  it('repeats an own SOS with growing pauses until someone acknowledges it', () => {
    const lora = scheduler();
    const call = sos();
    lora.offer(call, 'own', 0);
    expect(drain(lora, 0)).toEqual(['sos']);
    expect(drain(lora, 29_999)).toEqual([]);
    expect(drain(lora, 30_000)).toEqual(['sos']);
    expect(drain(lora, 30_000 + 59_999)).toEqual([]);
    expect(drain(lora, 90_000)).toEqual(['sos']);

    lora.observe({ type: 'ack', origin: OTHER, seq: 99, time: T0, target: call.event });
    expect(drain(lora, 60 * 60_000)).toEqual([]);
  });

  it('keeps repeating an own SOS every 5 minutes for as long as nobody answers it', () => {
    const lora = scheduler();
    lora.offer(sos(), 'own', 0);
    let sends = 0;
    for (let now = 0; now <= 3 * 60 * 60_000; now += 60_000) sends += drain(lora, now).length;
    // 30 s, 1, 2 and 4 minutes, then every 5 minutes for three hours.
    expect(sends).toBeGreaterThan(30);
  });

  it('keeps repeating an own SOS that another bridge put on the air', () => {
    const lora = scheduler();
    const call = sos();
    lora.offer(call, 'own', 0);
    drain(lora, 0);
    lora.heard(call.event, 10_000);
    expect(drain(lora, 30_000)).toEqual(['sos']);
  });

  it('stops repeating a cancelled SOS', () => {
    const lora = scheduler();
    const call = sos();
    lora.offer(call, 'own', 0);
    drain(lora, 0);
    lora.offer(packet({ type: 'sos-cancel', origin: ME, sos: call.event }), 'own', 1000);
    expect(drain(lora, 60 * 60_000)).toEqual(['sos-cancel']);
  });

  it('waits 2–30 s before acknowledging, and stays quiet if someone else acknowledges first', () => {
    const lora = scheduler(0.5);
    const target = { origin: OTHER, seq: 5 };
    lora.offer(packet({ type: 'ack', origin: ME, target }), 'own', 0);
    expect(drain(lora, 15_999)).toEqual([]);
    lora.heard({ type: 'ack', origin: '630dcd29' as NodeId, seq: 1, time: T0, target }, 10_000);
    expect(drain(lora, 60_000)).toEqual([]);
  });

  it('sends no acknowledgement, own or bridged, of an event someone already acknowledged on the air', () => {
    const lora = scheduler(0.5);
    const target = { origin: OTHER, seq: 6 };
    lora.heard({ type: 'ack', origin: '630dcd29' as NodeId, seq: 1, time: T0, target }, 0);
    lora.offer(packet({ type: 'ack', origin: ME, target }), 'own', 1000);
    lora.offer(packet({ type: 'ack', origin: '4a5b6c7d' as NodeId, target }), 'bridged', 1000);
    expect(drain(lora, 60_000)).toEqual([]);
  });

  it('answers a roll call even after hearing someone else answer it', () => {
    const lora = scheduler(0.5);
    const call = { type: 'roll-call', origin: OTHER, seq: 7, time: T0, text: '' } as const;
    lora.heard(call, 0);
    const target = { origin: OTHER, seq: 7 };
    lora.offer(packet({ type: 'ack', origin: ME, target }), 'own', 0);
    lora.heard({ type: 'ack', origin: '630dcd29' as NodeId, seq: 1, time: T0, target }, 10_000);
    expect(drain(lora, 60_000)).toEqual(['ack']);
  });

  it('acknowledges an SOS within the urgent budget when ordinary traffic has spent its own', () => {
    const lora = scheduler();
    for (let i = 0; i < LIMITS.normalBudgetMs / 1000; i++) lora.offer(chat(), 'own', 0);
    drain(lora, 0);
    const call = {
      type: 'sos',
      origin: OTHER,
      seq: 9,
      time: T0,
      kind: 'fire',
      ...VALENCIA,
      accuracy: null,
      text: '',
    } as const;
    lora.heard(call, 0);
    lora.offer(packet({ type: 'ack', origin: ME, target: call }), 'own', 0);
    expect(drain(lora, 60_000)).toEqual(['ack']);
  });

  it('keeps its queue bounded, dropping the least urgent bridged traffic first', () => {
    const lora = scheduler();
    lora.offer(sos(), 'own', 0);
    for (let i = 0; i < LIMITS.maxPending + 50; i++)
      lora.offer(chat(OTHER), 'bridged', (T0 + 60) * 1000);
    expect(lora.next((T0 + 60) * 1000)?.event.type).toBe('sos');
  });

  it('retries a packet the radio refused, without charging its airtime', () => {
    const lora = scheduler();
    lora.offer(chat(), 'own', 0);
    expect(lora.next(0)?.event.type).toBe('chat');
    lora.retry(0);
    expect(lora.spentMs(0)).toBe(0);
    expect(drain(lora, LIMITS.retryMs - 1)).toEqual([]);
    expect(drain(lora, LIMITS.retryMs)).toEqual(['chat']);
  });

  it('judges the next own position against the last one that went on the air, not a refused one', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    expect(lora.next(0)?.event.type).toBe('position');
    lora.retry(0);
    expect(drain(lora, LIMITS.retryMs)).toEqual(['position']);
  });

  it('keeps repeating an own SOS after the radio refuses one repeat', () => {
    const lora = scheduler();
    lora.offer(sos(), 'own', 0);
    expect(drain(lora, 0)).toEqual(['sos']);
    expect(lora.next(30_000)?.event.type).toBe('sos');
    lora.retry(30_000);
    expect(drain(lora, 30_000 + LIMITS.retryMs)).toEqual(['sos']);
  });

  it('does not put back a refused position once a newer one or a hiding is queued', () => {
    const lora = scheduler();
    lora.offer(position(), 'own', 0);
    expect(lora.next(0)?.event.type).toBe('position');
    const newer = position({ lat: 39.48, lon: -0.3763 });
    lora.offer(newer, 'own', 1);
    lora.retry(2);
    const sent: number[] = [];
    for (let now = 2; now < 30 * 60_000; now += 5_000) {
      const next = lora.next(now);
      if (next === null) continue;
      lora.sent(now);
      sent.push(next.event.seq);
    }
    expect(sent).toEqual([newer.event.seq]);

    const hiding = scheduler();
    hiding.offer(position(), 'own', 0);
    expect(hiding.next(0)?.event.type).toBe('position');
    hiding.offer(packet({ type: 'position-hidden', origin: ME }), 'own', 1);
    hiding.retry(2);
    expect([...drain(hiding, 2), ...drain(hiding, 30 * 60_000)]).toEqual(['position-hidden']);
  });

  it('never sends a position older than one already sent or heard', () => {
    const lora = scheduler();
    const older = position(VALENCIA, OTHER);
    const newer = position({ lat: 39.48, lon: -0.3763 }, OTHER);
    lora.heard(newer.event, 0);
    lora.offer(older, 'bridged', T0 * 1000);
    expect(drain(lora, T0 * 1000 + LIMITS.bridgeDelayMs)).toEqual([]);
  });

  it('hands out one packet at a time until told how sending went', () => {
    const lora = scheduler();
    lora.offer(chat(), 'own', 0);
    lora.offer(chat(), 'own', 0);
    expect(lora.next(0)).not.toBeNull();
    expect(lora.next(0)).toBeNull();
    lora.sent(0);
    expect(lora.next(0)).not.toBeNull();
  });

  it('drops what is queued for a group when the radio changes group, but keeps the airtime spent', () => {
    const lora = scheduler();
    lora.offer(packet({ type: 'alert', origin: ME, level: 'critical', text: 'Evacuad' }), 'own', 0);
    expect(drain(lora, 0)).toEqual(['alert']);
    lora.offer(chat(), 'own', 0);
    lora.changeGroup();
    expect(drain(lora, 60 * 60_000 - 1)).toEqual([]);
    expect(lora.spentMs(1)).toBe(1000);
  });

  it('keeps repeating an own SOS still open after the radio changes group, until it is answered', () => {
    const lora = scheduler();
    const call = sos();
    lora.offer(call, 'own', 0);
    lora.offer(chat(), 'own', 0);
    expect(drain(lora, 0)).toEqual(['sos', 'chat']);
    lora.changeGroup();
    expect(drain(lora, LIMITS.sosFirstRepeatMs)).toEqual(['sos']);
    // In flight across another change of group: it still counts as sent, and repeats.
    expect(lora.next(3 * LIMITS.sosFirstRepeatMs)?.event.type).toBe('sos');
    lora.changeGroup();
    lora.sent(3 * LIMITS.sosFirstRepeatMs);
    expect(drain(lora, 7 * LIMITS.sosFirstRepeatMs)).toEqual(['sos']);
    lora.observe({ type: 'ack', origin: OTHER, seq: 900, time: T0, target: call.event });
    expect(drain(lora, 60 * 60_000)).toEqual([]);
  });

  it('forgets what is queued for a group that was left, own SOS calls included', () => {
    const lora = scheduler();
    lora.offer(sos(), 'own', 0);
    expect(drain(lora, 0)).toEqual(['sos']);
    lora.changeGroup();
    lora.forget((queued) => queued.event.type === 'sos');
    expect(drain(lora, 60 * 60_000)).toEqual([]);
  });

  it('charges a packet in flight when the group changes, but does not put it back', () => {
    const lora = scheduler();
    lora.offer(chat(), 'own', 0);
    expect(lora.next(0)).not.toBeNull();
    lora.changeGroup();
    lora.sent(0);
    expect(lora.spentMs(0)).toBe(1000);

    lora.offer(chat(), 'own', 0);
    expect(lora.next(0)).not.toBeNull();
    lora.changeGroup();
    lora.retry(0);
    expect(drain(lora, LIMITS.retryMs)).toEqual([]);
  });

  it('carries events of types it does not know, after every known one', () => {
    const lora = scheduler();
    lora.offer(
      { event: { type: null, origin: OTHER, seq: 77, time: T0 }, bytes: new Uint8Array(30) },
      'own',
      0,
    );
    lora.offer(position(), 'own', 0);
    expect(drain(lora, 0)).toEqual(['position', null]);
  });
});
