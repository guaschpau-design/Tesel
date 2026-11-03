import { describe, expect, it } from 'vitest';

import { AirtimeWindow } from './airtime.ts';

describe('an airtime window', () => {
  it('counts what was sent within the window, and forgets what slid out of it', () => {
    const window = new AirtimeWindow(60_000);
    window.add(0, 300);
    window.add(30_000, 200);
    expect(window.usedMs(30_000)).toBe(500);
    expect(window.usedMs(60_000)).toBe(500);
    expect(window.usedMs(60_001)).toBe(200);
    expect(window.usedMs(90_001)).toBe(0);
  });

  it('counts the airtime of a window read before, as after a restart of the app', () => {
    const before = new AirtimeWindow(60_000);
    before.add(0, 300);
    before.add(30_000, 200);
    const after = new AirtimeWindow(60_000);
    after.add(40_000, 100);
    after.restore(before.uses(40_000), 40_000);
    expect(after.usedMs(40_000)).toBe(600);
    expect(after.usedMs(60_001)).toBe(300);
  });

  it('counts a use restored twice once', () => {
    const window = new AirtimeWindow(60_000);
    window.add(10_000, 300);
    window.restore(window.uses(20_000), 20_000);
    window.restore([{ at: 10_000, ms: 300 }], 20_000);
    expect(window.usedMs(20_000)).toBe(300);
  });

  it('forgets a restored use stamped by a clock far ahead, which would hold the budget for good', () => {
    const window = new AirtimeWindow(60_000);
    window.restore(
      [
        { at: 70_000, ms: 300 },
        { at: 10_000_000, ms: 900 },
      ],
      20_000,
    );
    expect(window.usedMs(20_000)).toBe(300);
  });
});
