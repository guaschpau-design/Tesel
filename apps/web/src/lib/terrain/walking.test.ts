import { describe, expect, it } from 'vitest';

import { roundedMinutes, walkingMinutes } from './walking.ts';

describe('the time a way takes on foot', () => {
  it('walks the flat at 4 km an hour', () => {
    expect(walkingMinutes(4000, { up: 0, down: 0 })).toBe(60);
  });

  it('takes the longer of walking and climbing, and half the shorter', () => {
    // 4 km is an hour; 400 m up is another: the longer, an hour, and half the other.
    expect(walkingMinutes(4000, { up: 400, down: 0 })).toBe(90);
    // A steep climb: 800 m up is two hours, the 2 km half an hour, half of which is added.
    expect(walkingMinutes(2000, { up: 800, down: 0 })).toBe(135);
  });

  it('descends faster than it climbs', () => {
    expect(walkingMinutes(0, { up: 0, down: 600 })).toBe(60);
  });

  it('is told to five minutes, never less than five', () => {
    expect(roundedMinutes(127)).toBe(125);
    expect(roundedMinutes(1)).toBe(5);
  });
});
