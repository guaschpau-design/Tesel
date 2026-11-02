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

  it('rests after a minute, rests deeply after ten and wakes at a touch', () => {
    const activity = new Activity();
    const stop = activity.follow(() => false);
    vi.advanceTimersByTime(55_000);
    expect(activity.rest).toBe('awake');
    vi.advanceTimersByTime(10_000);
    expect(activity.rest).toBe('resting');
    vi.advanceTimersByTime(9 * 60_000);
    expect(activity.rest).toBe('deep');
    target.dispatchEvent(new Event('pointerdown'));
    target.dispatchEvent(new Event('pointerup'));
    expect(activity.rest).toBe('awake');
    stop();
  });

  it('keeps the touch that wakes the screen from what is under it', () => {
    const activity = new Activity();
    const stop = activity.follow(() => false);
    const under = vi.fn();
    for (const type of ['pointerdown', 'pointerup', 'click']) target.addEventListener(type, under);
    vi.advanceTimersByTime(65_000);
    expect(activity.rest).toBe('resting');

    // The screen stays while the finger is down, to take its lift, and goes as it lifts.
    target.dispatchEvent(new Event('pointerdown', { cancelable: true }));
    expect(activity.rest).toBe('resting');
    target.dispatchEvent(new Event('pointerup', { cancelable: true }));
    expect(activity.rest).toBe('awake');
    vi.advanceTimersByTime(300);
    target.dispatchEvent(new Event('click', { cancelable: true }));
    expect(under).not.toHaveBeenCalled();

    // The next touch is the user's as ever, however soon it comes.
    target.dispatchEvent(new Event('pointerdown', { cancelable: true }));
    target.dispatchEvent(new Event('click', { cancelable: true }));
    expect(under).toHaveBeenCalledTimes(2);
    stop();
  });

  it('does not rest while something holds it off', () => {
    const activity = new Activity();
    let held = true;
    const stop = activity.follow(() => held);
    vi.advanceTimersByTime(5 * 60_000);
    expect(activity.rest).toBe('awake');
    held = false;
    vi.advanceTimersByTime(65_000);
    expect(activity.rest).toBe('resting');
    stop();
    expect(activity.rest).toBe('awake');
  });
});
