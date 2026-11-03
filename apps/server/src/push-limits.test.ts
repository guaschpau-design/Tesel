import { describe, expect, it } from 'vitest';

import { PushLimiter, type Pusher } from './push-limits.ts';
import { DEFAULT_LIMITS, type RelayLimits } from './relay-limits.ts';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rate limits too high to matter, for tests of the others. */
const UNLIMITED = 1_000_000;

function pusher(
  limiter: PushLimiter,
  address: string,
  group: string,
  groupSince = -2 * DAY_MS,
): Pusher {
  return { bucket: limiter.connectionBucket(0), address, group, groupSince };
}

/** Pushes and stores an envelope of the largest size if every limit allows it. */
function push(limiter: PushLimiter, from: Pusher, now: number): boolean {
  if (!limiter.allows(from, 193, now)) return false;
  limiter.stored(from, 193, now);
  return true;
}

/**
 * Five addresses, each within every limit of its own (4 groups of their own, 9 connections in
 * each), push as fast as they may for a minute; an honest member of another group pushes once a
 * second through the second half. Returns how many of the honest pushes got through, of 31.
 */
function flood(honestGroupSince: number, limits: RelayLimits = DEFAULT_LIMITS): number {
  const limiter = new PushLimiter(limits, 0);
  const attackers = ['a1', 'a2', 'a3', 'a4', 'a5'].flatMap((address) =>
    Array.from({ length: 36 }, (_, n) =>
      pusher(limiter, address, `${address}-g${String(n % 4)}`, 0),
    ),
  );
  const honest = pusher(limiter, 'honest', 'honest-group', honestGroupSince);
  let through = 0;
  for (let now = 0; now <= 60_000; now += 10) {
    for (const attacker of attackers) push(limiter, attacker, now);
    if (now >= 30_000 && now % 1000 === 0 && push(limiter, honest, now)) through += 1;
  }
  return through;
}

describe('push limits', () => {
  it('keeps an honest member of a group with a history pushing while five addresses flood', () => {
    // Before, the five took all of the server's pushes, and none of the 31 got through.
    expect(flood(-2 * DAY_MS)).toBe(31);
  });

  it('keeps an honest member of a new group pushing while five addresses flood', () => {
    expect(flood(25_000)).toBe(31);
  });

  it('keeps an honest member pushing while the floods come from groups with a history', () => {
    const limiter = new PushLimiter(DEFAULT_LIMITS, 0);
    const attackers = Array.from({ length: 10 }, (_, a) =>
      Array.from({ length: 36 }, (_, n) =>
        pusher(limiter, `a${String(a)}`, `a${String(a)}-g${String(n % 4)}`),
      ),
    ).flat();
    const honest = pusher(limiter, 'honest', 'honest-group');
    let through = 0;
    let all = 0;
    for (let now = 0; now <= 60_000; now += 10) {
      for (const attacker of attackers) if (push(limiter, attacker, now)) all += 1;
      if (now >= 30_000 && now % 1000 === 0 && push(limiter, honest, now)) through += 1;
    }
    expect(through).toBe(31);
    // The server's capacity stays what it is: 500 a second, ten seconds' worth at once.
    expect(all + through).toBeLessThanOrEqual(500 * 60 + 5000);
  });

  it('gives groups in their first day at most half of the server’s pushes', () => {
    const limiter = new PushLimiter(DEFAULT_LIMITS, 0);
    const pushers = Array.from({ length: 400 }, (_, n) =>
      pusher(limiter, `a${String(n % 20)}`, `g${String(n)}`, 0),
    );
    let all = 0;
    for (let now = 0; now <= 60_000; now += 10) {
      for (const from of pushers) if (push(limiter, from, now)) all += 1;
    }
    expect(all).toBeLessThanOrEqual(250 * 60 + 2500);
    expect(all).toBeGreaterThan(200 * 60);
  });

  it('counts a push against no limit unless every limit lets it through', () => {
    const limiter = new PushLimiter(
      {
        ...DEFAULT_LIMITS,
        connectionPerSecond: UNLIMITED,
        groupPerSecond: 0.1,
        addressPerSecond: 0.2,
      },
      0,
    );
    const busy = pusher(limiter, 'a', 'busy');
    expect(push(limiter, busy, 0)).toBe(true);
    // The group has no more; the address keeps what these would have taken.
    for (let n = 0; n < 5; n++) expect(push(limiter, busy, 0)).toBe(false);
    expect(push(limiter, pusher(limiter, 'a', 'quiet'), 0)).toBe(true);
  });

  it('limits what one address stores in a day, counting only envelopes that were new', () => {
    const limits = {
      ...DEFAULT_LIMITS,
      connectionPerSecond: UNLIMITED,
      groupPerSecond: UNLIMITED,
      addressPerSecond: UNLIMITED,
      serverPerSecond: UNLIMITED,
      megabytesPerAddressPerDay: 1,
    };
    const limiter = new PushLimiter(limits, 0);
    const from = pusher(limiter, 'a', 'g');
    // Pushes of envelopes the group already had are let through but not stored, so not counted.
    for (let n = 0; n < 5000; n++) expect(limiter.allows(from, 193, 0)).toBe(true);
    // 1 MB at 443 bytes a stored envelope: its 193, and what is stored beside it.
    for (let n = 0; n < 2366; n++) expect(push(limiter, from, 0)).toBe(true);
    expect(push(limiter, pusher(limiter, 'a', 'other'), 0)).toBe(false);
    expect(push(limiter, pusher(limiter, 'b', 'g'), 0)).toBe(true);
    expect(push(limiter, from, DAY_MS / 2)).toBe(true);
  });

  it('limits what a group stores in its first day only', () => {
    const limits = {
      ...DEFAULT_LIMITS,
      connectionPerSecond: UNLIMITED,
      groupPerSecond: UNLIMITED,
      addressPerSecond: UNLIMITED,
      serverPerSecond: UNLIMITED,
      megabytesPerGroupFirstDay: 1,
    };
    const limiter = new PushLimiter(limits, 0);
    const pushers = Array.from({ length: 10 }, (_, n) =>
      pusher(limiter, `a${String(n)}`, 'new', 0),
    );
    let stored = 0;
    for (const from of pushers)
      for (let n = 0; n < 300; n++) if (push(limiter, from, 0)) stored += 1;
    expect(stored).toBe(2366);
    // A day on, the group has a history and stores what its members may.
    expect(push(limiter, pusher(limiter, 'a0', 'new', 0), DAY_MS)).toBe(true);
  });
});
