import type { NodeId, PositionEvent, TeselEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_STATE,
  isOutlived,
  outlivedEvents,
  reduce,
  reduceAll,
  stateOf,
  type GroupState,
} from '../reducer.ts';
import { TRAIL_POINTS } from './trails.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BEA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;

const position = (seq: number, lat = 39.47 + seq / 10_000, origin = ANA): PositionEvent => ({
  type: 'position',
  origin,
  seq,
  time: T0 + 10 * seq,
  lat,
  lon: -0.37,
  accuracy: 5,
  heading: null,
  speed: null,
});

const hidden = (seq: number, origin = ANA): TeselEvent => ({
  type: 'position-hidden',
  origin,
  seq,
  time: T0 + 10 * seq,
});

const seqsOf = (events: readonly TeselEvent[]) =>
  stateOf(events)
    .trails.get(ANA)
    ?.points.map((point) => point.seq);

describe('trails', () => {
  it('keeps each member’s positions in order, whatever order they arrive in', () => {
    expect(seqsOf([position(3), position(1), position(2), position(1)])).toEqual([1, 2, 3]);
  });

  it('keeps the same newest positions on every device, however they arrive', () => {
    const events = Array.from({ length: TRAIL_POINTS + 40 }, (_, i) => position(i + 1));
    const newest = events.slice(-TRAIL_POINTS).map((event) => event.seq);
    expect(seqsOf(events)).toEqual(newest);
    expect(seqsOf([...events].reverse())).toEqual(newest);
    const once = stateOf(events);
    expect(reduce(once, position(1))).toBe(once);
  });

  it('drops the trail up to the moment a member hides, even positions that arrive late', () => {
    expect(seqsOf([position(1), position(2), hidden(3), position(4)])).toEqual([4]);
    expect(seqsOf([hidden(3), position(4), position(2), position(1)])).toEqual([4]);
  });
});

describe('trails from a batch', () => {
  it('are those that applying its positions and hidings one by one gives, in any order', () => {
    const random = seededRandom(11);
    const events: TeselEvent[] = [
      ...Array.from({ length: TRAIL_POINTS + 60 }, (_, i) => position(i + 1)),
      ...Array.from({ length: 30 }, (_, i) => position(i + 1, 39.5, BEA)),
      hidden(TRAIL_POINTS + 20),
      hidden(12, BEA),
      position(5),
    ];
    for (let round = 0; round < 10; round++) {
      const shuffled = [...events].sort(() => random() - 0.5);
      const split = Math.floor(random() * shuffled.length);
      const before = shuffled.slice(0, split).reduce(reduce, EMPTY_STATE);
      const rest = shuffled.slice(split);
      expect(reduceAll(before, rest).trails).toEqual(rest.reduce(reduce, before).trails);
    }
  });

  it('leave the state as it is when nothing in the batch changes a trail', () => {
    const events = Array.from({ length: TRAIL_POINTS + 5 }, (_, i) => position(i + 1));
    const full = stateOf(events);
    expect(reduceAll(full, [position(1), position(2), events[10] ?? position(11)])).toBe(full);
  });
});

describe('outlived positions', () => {
  it('are those older than a full trail, and those up to the last hiding', () => {
    const full = stateOf(Array.from({ length: TRAIL_POINTS + 1 }, (_, i) => position(i + 2)));
    expect(isOutlived(full, position(1))).toBe(true);
    expect(isOutlived(full, position(2))).toBe(true);
    expect(isOutlived(full, position(3))).toBe(false);
    const hiding = stateOf([position(1), hidden(5), position(6)]);
    expect(isOutlived(hiding, position(4))).toBe(true);
    expect(isOutlived(hiding, position(7))).toBe(false);
    expect(isOutlived(EMPTY_STATE, position(1))).toBe(false);
  });

  it('can be forgotten without changing the state, whatever arrives later and in any order', () => {
    const random = seededRandom(7);
    const events = [ANA, BEA].flatMap((origin) =>
      Array.from({ length: 2 * TRAIL_POINTS }, (_, i) =>
        random() < 0.01 ? hidden(i + 1, origin) : position(i + 1, 39.47, origin),
      ),
    );
    const shuffled = [...events].sort(() => random() - 0.5);

    // A device that forgets what it can after every batch, and drops what it has outlived.
    let state: GroupState = EMPTY_STATE;
    const kept = new Map<string, TeselEvent>();
    const forgotten: TeselEvent[] = [];
    for (let start = 0; start < shuffled.length;) {
      const size = 1 + Math.floor(random() * 40);
      const batch = shuffled
        .slice(start, (start += size))
        .filter((event) => !isOutlived(state, event));
      const next = reduceAll(state, batch);
      for (const event of batch) kept.set(`${event.origin}:${String(event.seq)}`, event);
      for (const event of outlivedEvents(state, next, batch)) {
        kept.delete(`${event.origin}:${String(event.seq)}`);
        forgotten.push(event);
      }
      state = next;
    }

    expect(forgotten.length).toBeGreaterThan(TRAIL_POINTS / 2);
    expect(kept.size).toBeLessThanOrEqual(events.length - forgotten.length);
    expect(state).toEqual(stateOf(events));
    expect(stateOf(kept.values())).toEqual(stateOf(events));
    // A copy of a forgotten position, arriving again, is known and changes nothing.
    for (const event of forgotten) {
      expect(isOutlived(state, event)).toBe(true);
      expect(reduce(state, event)).toBe(state);
    }
  });
});

/** A repeatable sequence of numbers in [0, 1), so a failing case can be replayed. */
function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1_103_515_245 + 12_345) % 2 ** 31;
    return value / 2 ** 31;
  };
}
