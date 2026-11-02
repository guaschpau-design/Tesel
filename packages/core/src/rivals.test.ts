import {
  compareBytes,
  encodeEvent,
  type NodeId,
  type SosEvent,
  type TeselEvent,
} from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { LoraScheduler } from './lora-scheduler.ts';
import { EMPTY_STATE, reduce, stateOf } from './reducer.ts';
import { keptRivals, rivalKey } from './rivals.ts';
import { openSosCalls } from './state/sos.ts';

const VICTIM = 'a1b2c3d4' as NodeId;
const OTHER = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;

const encoded = (event: TeselEvent): Uint8Array => {
  const bytes = encodeEvent(event);
  if (!bytes.ok) throw new Error(bytes.error.detail);
  return bytes.value;
};
const chat = (text: string, time = T0): TeselEvent => ({
  type: 'chat',
  origin: VICTIM,
  seq: 42,
  time,
  text,
});
const sos = (text: string, time = T0): SosEvent => ({
  type: 'sos',
  origin: VICTIM,
  seq: 42,
  time,
  kind: 'medical',
  lat: 39.47,
  lon: -0.37,
  accuracy: 5,
  text,
});
const ack: TeselEvent = {
  type: 'ack',
  origin: VICTIM,
  seq: 42,
  time: T0,
  target: { origin: OTHER, seq: 1 },
};

/** Every order of a few items. */
function orders<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, index) =>
    orders(items.filter((_, other) => other !== index)).map((rest) => [item, ...rest]),
  );
}

describe('rivals under one (origin, seq)', () => {
  it('keeps one of two ordinary events, the same whatever order they come in', () => {
    const one = encoded(chat('one'));
    const two = encoded(chat('two'));
    expect(keptRivals([one, two])).toEqual([one]);
    expect(keptRivals([two, one])).toEqual([one]);
    expect(keptRivals([one, one])).toEqual([one]);
  });

  it('keeps an SOS over an ordinary event, however its bytes compare', () => {
    // A time of 0 makes the forged chat sort first by its bytes.
    const forged = encoded(chat('x', 0));
    const call = encoded(sos('help'));
    expect(keptRivals([forged, call])).toEqual([call]);
    expect(keptRivals([call, forged])).toEqual([call]);
  });

  it('keeps every SOS, cancellation and acknowledgement among rivals, so none hides another', () => {
    const forged = encoded(sos('', 0));
    const real = encoded(sos('help'));
    const acknowledgement = encoded(ack);
    for (const order of orders([forged, real, acknowledgement, encoded(chat('x'))])) {
      expect(keptRivals(order)).toEqual([forged, real, acknowledgement].sort(compareBytes));
    }
  });

  it('tells apart the rivals of an SOS, and of nothing else', () => {
    expect(rivalKey(sos('a'))).not.toBe(rivalKey(sos('b')));
    expect(rivalKey(sos('a'))).toBe(rivalKey(sos('a')));
    expect(rivalKey(chat('a'))).toBe(rivalKey(chat('b')));
  });

  it('shows every SOS under one reference, in the same order on every device', () => {
    const calls = [sos('forged', T0), sos('help', T0 + 5), sos('also forged', T0)];
    const seen = orders(calls).map((order) =>
      [...openSosCalls(stateOf(order))].map(([key, call]) => `${key} ${call.text}`),
    );
    for (const view of seen) expect(view).toEqual(seen[0]);
    expect(seen[0]).toHaveLength(3);
    expect(new Set(seen[0]?.map((line) => line.split(' ')[0])).size).toBe(3);
  });

  it('cancels every call under the reference a cancellation points to', () => {
    const cancel: TeselEvent = {
      type: 'sos-cancel',
      origin: OTHER,
      seq: 2,
      time: T0 + 9,
      sos: { origin: VICTIM, seq: 42 },
    };
    expect([...openSosCalls(stateOf([sos('a'), sos('b'), cancel]))]).toEqual([]);
  });

  it('keeps the same diary of rivals whatever order they come in', () => {
    const events = [sos('a'), sos('b'), ack];
    const diaries = orders(events).map((order) => stateOf(order).journal);
    for (const diary of diaries) expect(diary).toEqual(diaries[0]);
    expect(diaries[0]).toHaveLength(3);
    // One by one, as live events arrive, gives the same as all at once.
    expect(events.reduce(reduce, EMPTY_STATE).journal).toEqual(diaries[0]);
  });

  it('puts on the air an SOS forged under the reference of one already heard', () => {
    const lora = new LoraScheduler({ random: () => 0, airtimeMs: () => 1000 });
    const forged = sos('forged');
    const real = sos('help');
    lora.heard(forged, 0);
    lora.offer({ event: real, bytes: encoded(real) }, 'bridged', 0);
    expect(lora.next(10_000)?.event).toBe(real);
  });
});
