import { describe, expect, it } from 'vitest';

import { ANSWER_MS, CheckIn, hasMoved, RETRY_FIRST_MS, RETRY_MAX_MS } from './check-in.ts';

const MINUTE = 60_000;
const LIMIT = 30 * MINUTE;

describe('the safety check-in', () => {
  it('asks after the quiet time, and calls for help with no answer in time', () => {
    const check = new CheckIn(0);
    expect(check.tick(LIMIT - 1, LIMIT)).toBeNull();
    expect(check.tick(LIMIT, LIMIT)).toBe('ask');
    expect(check.deadline).toBe(LIMIT + ANSWER_MS);
    expect(check.tick(LIMIT + ANSWER_MS - 1, LIMIT)).toBeNull();
    expect(check.tick(LIMIT + ANSWER_MS, LIMIT)).toBe('call');
    expect(check.step).toBe('calling');
    check.sent();
    expect(check.step).toBe('called');
    expect(check.tick(LIMIT * 3, LIMIT)).toBeNull();
  });

  it('says help was called for only once the call went out', () => {
    const check = new CheckIn(0);
    check.tick(LIMIT, LIMIT);
    check.tick(LIMIT + ANSWER_MS, LIMIT);
    expect(check.step).toBe('calling');
    expect(check.tick(LIMIT * 3, LIMIT)).toBeNull();
    expect(check.step).toBe('calling');
  });

  it('tries a call that could not be sent again, less and less often, until it goes out', () => {
    const check = new CheckIn(0);
    check.tick(LIMIT, LIMIT);
    let now = LIMIT + ANSWER_MS;
    expect(check.tick(now, LIMIT)).toBe('call');
    const waits: number[] = [];
    for (let attempt = 0; attempt < 6; attempt++) {
      check.failed(now);
      expect(check.step).toBe('failed');
      const retry = check.deadline ?? 0;
      waits.push(retry - now);
      expect(check.tick(retry - 1, LIMIT)).toBeNull();
      expect(check.tick(retry, LIMIT)).toBe('call');
      now = retry;
    }
    expect(waits).toEqual([
      RETRY_FIRST_MS,
      RETRY_FIRST_MS * 2,
      RETRY_FIRST_MS * 4,
      RETRY_FIRST_MS * 8,
      RETRY_MAX_MS,
      RETRY_MAX_MS,
    ]);
    check.sent();
    expect(check.step).toBe('called');
  });

  it('tries a failed call again even with the app off screen', () => {
    const check = new CheckIn(0);
    check.tick(LIMIT, LIMIT);
    check.tick(LIMIT + ANSWER_MS, LIMIT);
    check.failed(LIMIT + ANSWER_MS);
    check.away();
    expect(check.tick(LIMIT + ANSWER_MS + RETRY_FIRST_MS, LIMIT)).toBe('call');
  });

  it('stops calling when the member answers, and starts the waits again from the first', () => {
    const check = new CheckIn(0);
    const callAt = (now: number) => {
      check.tick(now, LIMIT);
      check.tick(now + ANSWER_MS, LIMIT);
      return now + ANSWER_MS;
    };
    let now = callAt(LIMIT);
    check.failed(now);
    now += RETRY_FIRST_MS;
    check.tick(now, LIMIT);
    check.failed(now);
    check.activity(now + 1);
    expect(check.step).toBe('quiet');
    expect(check.tick(now + RETRY_MAX_MS, LIMIT)).toBeNull();
    now = callAt(now + 1 + LIMIT);
    check.failed(now);
    expect(check.deadline).toBe(now + RETRY_FIRST_MS);
  });

  it('ignores the outcome of a call the member answered while it was on its way', () => {
    const check = new CheckIn(0);
    check.tick(LIMIT, LIMIT);
    check.tick(LIMIT + ANSWER_MS, LIMIT);
    check.activity(LIMIT + ANSWER_MS + 1);
    check.failed(LIMIT + ANSWER_MS + 2);
    expect(check.step).toBe('quiet');
    check.sent();
    expect(check.step).toBe('quiet');
  });

  it('starts waiting again whenever the member moves or answers', () => {
    const check = new CheckIn(0);
    check.activity(20 * MINUTE);
    expect(check.tick(LIMIT, LIMIT)).toBeNull();
    expect(check.tick(50 * MINUTE, LIMIT)).toBe('ask');
    check.activity(51 * MINUTE);
    expect(check.step).toBe('quiet');
    expect(check.tick(51 * MINUTE + ANSWER_MS, LIMIT)).toBeNull();
  });

  it('does not count time with the app off screen, and starts again when it is back', () => {
    const check = new CheckIn(0);
    check.away();
    expect(check.tick(LIMIT * 4, LIMIT)).toBeNull();
    check.back(LIMIT * 4);
    expect(check.tick(LIMIT * 5 - 1, LIMIT)).toBeNull();
    expect(check.tick(LIMIT * 5, LIMIT)).toBe('ask');
    check.away();
    expect(check.tick(LIMIT * 5 + ANSWER_MS, LIMIT)).toBeNull();
  });

  it('takes as a move only what a wandering fix could not explain', () => {
    const here = { lat: 39.47, lon: -0.37 };
    const north = (metres: number) => ({ lat: here.lat + metres / 111_195, lon: here.lon });
    expect(hasMoved({ at: here, accuracy: 5 }, { at: north(30), accuracy: 5 })).toBe(true);
    expect(hasMoved({ at: here, accuracy: 5 }, { at: north(20), accuracy: 5 })).toBe(false);
    expect(hasMoved({ at: here, accuracy: 40 }, { at: north(60), accuracy: 30 })).toBe(false);
    expect(hasMoved({ at: here, accuracy: 40 }, { at: north(80), accuracy: 30 })).toBe(true);
    expect(hasMoved({ at: here, accuracy: null }, { at: north(30), accuracy: null })).toBe(true);
  });
});
