import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Activity } from './activity.svelte.ts';

describe('how long the device has been left untouched', () => {
  const target = new EventTarget();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', target);
    vi.stubGlobal('document', { activeElement: null });
    // Nothing is focused: any class stands in for the elements a focus would be checked against.
    for (const name of ['HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement']) {
      vi.stubGlobal(name, EventTarget);
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('goes into pocket mode after a minute, deeper after ten, and a touch does not bring it back', () => {
    const activity = new Activity();
    const stop = activity.follow(
      () => false,
      () => true,
    );
    vi.advanceTimersByTime(55_000);
    expect(activity.rest).toBe('awake');
    vi.advanceTimersByTime(10_000);
    expect(activity.rest).toBe('resting');
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('keydown'));
    expect(activity.nudges).toBe(2);
    vi.advanceTimersByTime(9 * 60_000);
    expect(activity.rest).toBe('deep');
    activity.wake();
    expect(activity.rest).toBe('awake');
    stop();
  });

  it('goes into pocket mode when asked, even if not by itself', () => {
    const activity = new Activity();
    const stop = activity.follow(
      () => false,
      () => false,
    );
    vi.advanceTimersByTime(5 * 60_000);
    expect(activity.rest).toBe('awake');
    activity.pocket();
    expect(activity.rest).toBe('resting');
    vi.advanceTimersByTime(9 * 60_000 + 5000);
    expect(activity.rest).toBe('deep');
    stop();
    expect(activity.rest).toBe('awake');
  });

  it('counts a touch while awake as being there', () => {
    const activity = new Activity();
    const stop = activity.follow(
      () => false,
      () => true,
    );
    vi.advanceTimersByTime(50_000);
    target.dispatchEvent(new Event('pointerdown'));
    vi.advanceTimersByTime(50_000);
    expect(activity.rest).toBe('awake');
    expect(activity.nudges).toBe(0);
    stop();
  });

  it('does not rest while something holds it off', () => {
    const activity = new Activity();
    let held = true;
    const stop = activity.follow(
      () => held,
      () => true,
    );
    vi.advanceTimersByTime(5 * 60_000);
    expect(activity.rest).toBe('awake');
    held = false;
    vi.advanceTimersByTime(65_000);
    expect(activity.rest).toBe('resting');
    stop();
    expect(activity.rest).toBe('awake');
  });
});
