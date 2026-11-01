import type { NodeId, PositionEvent } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { isMove, travelled } from './movement.ts';

const ANA = 'a1b2c3d4' as NodeId;
/** About 11 m of latitude. */
const STEP = 0.0001;

function at(seq: number, lat: number, accuracy: number | null): PositionEvent {
  const fix = { type: 'position', origin: ANA, seq, time: 1000 + seq, lon: -0.3763 } as const;
  return { ...fix, lat, accuracy, heading: null, speed: null };
}

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
    ];
    expect(travelled(trail).map((point) => point.seq)).toEqual([1, 4, 5]);
  });
});
