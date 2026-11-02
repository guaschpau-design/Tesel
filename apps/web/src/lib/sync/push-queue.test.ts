import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PushQueue } from './push-queue.ts';

const key = (n: number) => new Uint8Array(16).fill(n);
const env = new Uint8Array(50);

function setup() {
  const sent: number[] = [];
  const queue = new PushQueue((pushed) => sent.push(pushed[0] ?? -1), Date.now);
  return { queue, sent };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('push queue', () => {
  it('sends a burst at once, then paces the rest below the server limit', async () => {
    const { queue, sent } = setup();
    for (let n = 1; n <= 30; n++) queue.add(key(n), env, 'position');
    expect(sent).toHaveLength(20);
    await vi.advanceTimersByTimeAsync(1000);
    expect(sent.length).toBeGreaterThan(20);
    expect(sent.length).toBeLessThanOrEqual(22);
    await vi.advanceTimersByTimeAsync(5000);
    expect(sent).toHaveLength(30);
  });

  it('puts an SOS ahead of a backlog of positions', () => {
    const { queue, sent } = setup();
    for (let n = 1; n <= 25; n++) queue.add(key(n), env, 'position');
    queue.add(key(99), env, 'sos');
    sent.length = 0;
    vi.advanceTimersByTime(500);
    expect(sent[0]).toBe(99);
  });

  it('sends again later what the server refused for going too fast, but not what it stored', async () => {
    const { queue, sent } = setup();
    queue.add(key(1), env, 'chat');
    queue.add(key(2), env, 'chat');
    queue.stored(key(1));
    queue.tryLater(key(2));
    expect(sent).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(4999);
    expect(sent).toEqual([1, 2]);
    await vi.advanceTimersByTimeAsync(1);
    expect(sent).toEqual([1, 2, 2]);
  });

  it('ignores a push it already has, and forgets everything when the connection goes', async () => {
    const { queue, sent } = setup();
    queue.add(key(1), env, 'chat');
    queue.add(key(1), env, 'chat');
    expect(sent).toEqual([1]);
    queue.tryLater(key(1));
    queue.clear();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(sent).toEqual([1]);
  });

  it('pushes every envelope under one key, and matches the replies to them in order', () => {
    const { queue, sent } = setup();
    const forged = new Uint8Array(50).fill(1);
    const genuine = new Uint8Array(50).fill(2);
    queue.add(key(7), forged, 'sos');
    queue.add(key(7), genuine, 'sos');
    queue.add(key(7), genuine, 'sos');
    expect(sent).toEqual([7, 7]);
    expect(queue.stored(key(7))).toEqual(forged);
    expect(queue.stored(key(7))).toEqual(genuine);
    expect(queue.stored(key(7))).toBeNull();
  });
});
