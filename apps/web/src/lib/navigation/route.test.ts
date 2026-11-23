import { offsetMeters } from '@tesel/core';
import { describe, expect, it } from 'vitest';

import { RouteTracker } from './route.ts';

const START = { lat: 42.5, lon: 1.5 };
/** A point `north` and `east` metres from the start. */
const at = (north: number, east: number) => offsetMeters(START, north, east);

describe('following a route', () => {
  // East 400 m, then north 400 m.
  const route = [START, at(0, 400), at(400, 400)];

  it('leads to the start first, then along the route point by point', () => {
    const tracker = new RouteTracker(route);
    const away = tracker.update(at(-300, 0), 5);
    expect(away.stage).toBe('to-start');
    expect(away.stage === 'to-start' && away.leg.bearing).toBeCloseTo(0, 0);

    const onIt = tracker.update(at(5, 100), 5);
    expect(onIt.stage).toBe('on-route');
    if (onIt.stage !== 'on-route') return;
    expect(onIt.next).toBe(1);
    expect(onIt.remaining).toBeCloseTo(700, -1);
    expect(onIt.leg.bearing).toBeCloseTo(91, 0);

    // The corner, cut by a few metres: on to the next point.
    const turned = tracker.update(at(10, 392), 5);
    expect(turned.stage === 'on-route' && turned.next).toBe(2);
    expect(turned.stage === 'on-route' && turned.leg.bearing).toBeCloseTo(0, -1);
  });

  it('warns when this device strays, and leads back to the route ahead', () => {
    const tracker = new RouteTracker(route);
    tracker.update(at(0, 50), 5);
    const strayed = tracker.update(at(-120, 200), 5);
    expect(strayed.stage).toBe('off-route');
    if (strayed.stage !== 'off-route') return;
    expect(strayed.leg.metres).toBeCloseTo(120, 0);
    expect(strayed.leg.bearing).toBeCloseTo(0, 0);
    // A poor fix that cannot tell is not straying.
    expect(tracker.update(at(-40, 200), 5).stage).toBe('on-route');
  });

  it('reaches the end once, and stays there', () => {
    const tracker = new RouteTracker(route);
    tracker.update(at(0, 10), 5);
    tracker.update(at(0, 400), 5);
    expect(tracker.update(at(395, 400), 5)).toEqual({ stage: 'arrived' });
    expect(tracker.update(at(200, 400), 5)).toEqual({ stage: 'arrived' });
  });

  it('goes out and back the same way without skipping to the end', () => {
    const outAndBack = [START, at(0, 500), START];
    const tracker = new RouteTracker(outAndBack);
    const out = tracker.update(at(0, 100), 5);
    expect(out.stage === 'on-route' && out.next).toBe(1);
    expect(out.stage === 'on-route' && out.remaining).toBeCloseTo(900, -1);
    tracker.update(at(0, 499), 5);
    const back = tracker.update(at(0, 300), 5);
    expect(back.stage === 'on-route' && back.next).toBe(2);
    expect(back.stage === 'on-route' && back.remaining).toBeCloseTo(300, -1);
  });

  it('takes a route up wherever the position is on it, when asked to', () => {
    const tracker = new RouteTracker(route, 'anywhere');
    expect(tracker.update(at(200, 600), 5).stage).toBe('to-start');
    const halfway = tracker.update(at(200, 405), 5);
    expect(halfway.stage === 'on-route' && halfway.next).toBe(2);
    expect(halfway.stage === 'on-route' && halfway.remaining).toBeCloseTo(200, -1);
  });

  it('takes a loop up at its start, not at its end, which is the same place', () => {
    const loop = [START, at(0, 300), at(300, 300), START];
    const tracker = new RouteTracker(loop, 'anywhere');
    const first = tracker.update(at(2, 2), 5);
    expect(first.stage === 'on-route' && first.remaining).toBeCloseTo(1024, -1);
  });
});
