import type { NodeId, PositionEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { confirmMove, isMove, travelled } from './movement.ts';

const ANA = 'a1b2c3d4' as NodeId;
/** About 11 m of latitude. */
const STEP = 0.0001;

function at(seq: number, lat: number, accuracy: number | null, lon = -0.3763): PositionEvent {
  const fix = { type: 'position', origin: ANA, seq, time: 1000 + seq * 5, lon } as const;
  return { ...fix, lat, accuracy, heading: null, speed: null };
}

const place = (lat: number, time: number, lon = -0.3763) => ({
  at: { lat, lon },
  accuracy: 5,
  time,
});

describe('moves and the GPS wandering', () => {
  it('counts a change as a move only beyond both fixes’ uncertainty, and never under 10 m', () => {
    const here = { at: { lat: 39.47, lon: -0.3763 }, accuracy: 3 };
    expect(isMove(here, { at: { lat: 39.47 + STEP, lon: -0.3763 }, accuracy: 3 })).toBe(true);
    expect(isMove(here, { at: { lat: 39.47 + STEP / 2, lon: -0.3763 }, accuracy: 1 })).toBe(false);
    expect(isMove(here, { at: { lat: 39.47 + 2 * STEP, lon: -0.3763 }, accuracy: 25 })).toBe(false);
  });

  it('keeps of a trail where the member went: no poor fixes, no wandering within the error', () => {
    const trail = [
      at(1, 39.47, 8),
      at(2, 39.47 + STEP, 20), // within 8 + 20 m of the first: wandering
      at(3, 39.47 - STEP, 60), // poor: indoors
      at(4, 39.47 + 4 * STEP, 8), // 44 m on: a move
      at(5, 39.47 + 8 * STEP, null), // accuracy unknown: judged by distance alone
      at(6, 39.47 + 12 * STEP, 8),
    ];
    // The newest waits for what comes after it to bear it out.
    expect(travelled(trail).map((point) => point.seq)).toEqual([1, 4, 5]);
  });

  it('takes a change for a move when the device goes on the same way, or stays away a minute', () => {
    const start = place(39.47, 0);
    const away = place(39.47 + 3 * STEP, 5);
    expect(confirmMove(start, away, [])).toBe('unsure');
    expect(confirmMove(start, away, [place(39.47 + 6 * STEP, 10)])).toBe('move');
    expect(confirmMove(start, away, [place(39.47 + 3.2 * STEP, 30)])).toBe('unsure');
    expect(
      confirmMove(start, away, [place(39.47 + 3.2 * STEP, 30), place(39.47 + 3 * STEP, 65)]),
    ).toBe('move');
  });

  it('takes jumps that come back, or go another way, for the GPS wandering', () => {
    const start = place(39.47, 0);
    const away = place(39.47 + 3 * STEP, 5);
    expect(confirmMove(start, away, [place(39.47 + 0.5 * STEP, 10)])).toBe('wandering');
    expect(confirmMove(start, away, [place(39.47 - 3 * STEP, 10)])).toBe('wandering');
    expect(confirmMove(start, away, [place(39.47, 10, -0.3763 + 4 * STEP)])).toBe('wandering');
  });

  it('draws a phone left indoors as a point, however far its fixes jump', () => {
    // Fixes that claim 10 m but jump 30 to 45 m, every way, and come back.
    const jumps: [number, number][] = [
      [0, 0],
      [3, 1],
      [0, 0],
      [-2, 3],
      [0, 0],
      [1, -4],
      [4, 0],
      [0, 0],
      [-3, -2],
      [0, 0],
    ];
    const trail = jumps.map(([north, east], index) =>
      at(index + 1, 39.47 + north * STEP, 10, -0.3763 + east * STEP * 1.3),
    );
    expect(travelled(trail).map((point) => point.seq)).toEqual([1]);
  });

  it('draws a walk, its newest step waiting for the next', () => {
    const trail = Array.from({ length: 10 }, (_, index) =>
      at(index + 1, 39.47 + index * 2 * STEP, 6),
    );
    expect(travelled(trail).map((point) => point.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});
