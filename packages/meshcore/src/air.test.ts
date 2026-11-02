import { describe, expect, it } from 'vitest';

import { meshcoreAirtimeMs } from './air.ts';

describe('MeshCore airtime', () => {
  it('puts the largest Tesel event at well over a second on the narrow EU preset', () => {
    expect(meshcoreAirtimeMs(165)).toBeGreaterThan(1000);
    expect(meshcoreAirtimeMs(165)).toBeLessThan(2500);
    expect(meshcoreAirtimeMs(28)).toBeLessThan(meshcoreAirtimeMs(165));
  });
});
