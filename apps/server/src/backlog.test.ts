// Backlogs sent to joining clients, over real WebSockets: page by page, never holding up the
// server, and never more than a client may leave unread.

import { afterEach, describe, expect, it } from 'vitest';

import type { EnvelopeStore } from './envelope-store.ts';
import { DEFAULT_LIMITS } from './relay-limits.ts';
import { env, GROUP, key, numbered, startRelay, stopRelay, untilSynced } from './test-relay.ts';

afterEach(stopRelay);

/** Stores `count` envelopes of the largest size in the group. */
function fill(store: EnvelopeStore, count: number, group = GROUP): void {
  for (let n = 1; n <= count; n++) store.append(group, key(n), numbered(193, n), 0);
}

/** Watches the event loop: resolves with the longest a timer of 10 ms had to wait past its time. */
function watchTimers(): { stop: () => number } {
  let last = performance.now();
  let worst = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    worst = Math.max(worst, now - last - 10);
    last = now;
  }, 10);
  return {
    stop: () => {
      clearInterval(timer);
      return worst;
    },
  };
}

describe('backlog', () => {
  it('sends a long backlog a page at a time to a slow reader, losing nothing stored meanwhile', async () => {
    const { store, app, join } = await startRelay();
    // Envelopes of the largest size, so the backlog is more than the system's socket buffers
    // can take in for a reader that has stopped.
    const backlog = 60_000;
    fill(store, backlog);

    const slow = await join();
    slow.pause();
    const sockets = () => [...app.websocketServer.clients];
    // The socket buffers are full once the server holds something it cannot send yet.
    await expect
      .poll(() => sockets().some((socket) => socket.bufferedAmount > 0), { timeout: 10_000 })
      .toBe(true);
    // Only about a page waits in the server's memory, not the whole backlog.
    for (const socket of sockets()) expect(socket.bufferedAmount).toBeLessThan(1024 * 1024);
    // The server keeps serving others meanwhile, and what they store reaches the slow reader.
    const alice = await join(backlog);
    await alice.next();
    alice.send({ t: 'push', key: key(backlog + 1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(backlog + 1) });

    slow.resume();
    const cursors = await untilSynced(slow);
    expect(cursors).toEqual(Array.from({ length: backlog + 1 }, (_, i) => i + 1));
    alice.send({ t: 'push', key: key(backlog + 2), env: env(2) });
    expect(await slow.next()).toMatchObject({ t: 'env', cursor: backlog + 2 });
  }, 60_000);

  it('lets timers run while a fast reader takes a long backlog', async () => {
    const { store, join } = await startRelay();
    fill(store, 100_000);
    const timers = watchTimers();
    const reader = await join();
    expect(await untilSynced(reader)).toHaveLength(100_000);
    // Before, the whole backlog went in one stretch: some two seconds with nothing else run.
    expect(timers.stop()).toBeLessThan(250);
  }, 60_000);

  it('serves many joins with long backlogs at once, each in turn, without holding up timers', async () => {
    const { store, join } = await startRelay();
    fill(store, 20_000);
    const timers = watchTimers();
    const readers = await Promise.all(Array.from({ length: 12 }, () => join()));
    const backlogs = await Promise.all(readers.map(untilSynced));
    for (const cursors of backlogs) expect(cursors).toHaveLength(20_000);
    expect(timers.stop()).toBeLessThan(250);
  }, 60_000);

  it('sends a backlog in parts no larger than what each client may leave unread', async () => {
    // 8 KB a connection: a page of 250 envelopes would not fit.
    const limits = { ...DEFAULT_LIMITS, unreadMegabytes: 1, maxConnections: 128 };
    const { store, app, join } = await startRelay({ limits });
    // More than the system's socket buffers take in for a reader that has stopped.
    fill(store, 30_000);
    const others = await Promise.all(Array.from({ length: 127 }, () => join(30_000)));
    await Promise.all(others.map(untilSynced));
    const slow = await join();
    slow.pause();
    const sockets = () => [...app.websocketServer.clients];
    await expect
      .poll(() => sockets().some((socket) => socket.bufferedAmount > 0), { timeout: 10_000 })
      .toBe(true);
    for (const socket of sockets()) expect(socket.bufferedAmount).toBeLessThanOrEqual(8 * 1024);
    slow.resume();
    expect(await untilSynced(slow)).toHaveLength(30_000);
  }, 60_000);
});
