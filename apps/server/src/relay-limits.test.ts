import { describe, expect, it } from 'vitest';

import { DEFAULT_LIMITS, Limiter } from './relay-limits.ts';

describe('relay limits', () => {
  it('shares out what clients may leave unread as more of them connect', () => {
    const limiter = new Limiter(DEFAULT_LIMITS, 0);
    limiter.opened('a');
    const alone = limiter.maxBufferedBytes();
    for (let n = 0; n < 2000; n++) limiter.opened(`b${String(n % 100)}`);
    const crowded = limiter.maxBufferedBytes();
    expect(crowded).toBeLessThan(alone);
    // Never less than a backlog page takes.
    expect(crowded).toBeGreaterThanOrEqual(256 * 1024);
  });
});
