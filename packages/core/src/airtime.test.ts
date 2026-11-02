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
});
