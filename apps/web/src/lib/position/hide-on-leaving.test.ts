import type { EventRef, NodeId } from '@tesel/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { hideOnLeaving } from './hide-on-leaving.ts';

const REF: EventRef = { origin: 'a1b2c3d4' as NodeId, seq: 7 };

function feed(shown: boolean) {
  const undelivered = new Set<string>();
  const fake = {
    showsOwnPosition: shown,
    undelivered,
    hidden: 0,
    hidePosition: () => {
      fake.hidden++;
      undelivered.add('a1b2c3d4:7');
      return Promise.resolve(REF);
    },
  };
  return fake;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('leaving a group', () => {
  it('hides the position the group sees, and waits until it is sent', async () => {
    vi.useFakeTimers();
    const group = feed(true);
    let left = false;
    const leaving = hideOnLeaving(group as unknown as GroupFeed).then(() => (left = true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(group.hidden).toBe(1);
    expect(left).toBe(false);
    group.undelivered.clear();
    await vi.advanceTimersByTimeAsync(200);
    await leaving;
    expect(left).toBe(true);
  });

  it('goes anyway when it cannot be sent in time', async () => {
    vi.useFakeTimers();
    const group = feed(true);
    const leaving = hideOnLeaving(group as unknown as GroupFeed, 1000);
    await vi.advanceTimersByTimeAsync(1200);
    await expect(leaving).resolves.toBeUndefined();
  });

  it('publishes nothing when the group sees no position', async () => {
    const group = feed(false);
    await hideOnLeaving(group as unknown as GroupFeed);
    expect(group.hidden).toBe(0);
  });
});
