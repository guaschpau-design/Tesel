import { describe, expect, it } from 'vitest';

import { groundExaggeration } from './ground.svelte.ts';

describe('how high the ground is raised', () => {
  it('raises it twice its height from afar and nearer its own up close', () => {
    expect(groundExaggeration(5)).toBe(2);
    expect(groundExaggeration(9)).toBe(2);
    expect(groundExaggeration(12)).toBeCloseTo(1.65);
    expect(groundExaggeration(15)).toBeCloseTo(1.3);
    expect(groundExaggeration(19)).toBeCloseTo(1.3);
  });
});
