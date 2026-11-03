import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_LIMITS, Limiter } from './relay-limits.ts';
import {
  env,
  GROUP,
  key,
  OTHER_GROUP,
  startRelay as start,
  stopRelay,
  untilSynced,
} from './test-relay.ts';

afterEach(stopRelay);

describe('relay limits', () => {
  it('shares out what clients may leave unread, never more than the cap between them', () => {
    const limiter = new Limiter(DEFAULT_LIMITS);
    limiter.opened('a', 0);
    const alone = limiter.maxBufferedBytes();
    for (let n = 1; n < DEFAULT_LIMITS.maxConnections; n++)
      limiter.opened(`b${String(n % 100)}`, 0);
    const crowded = limiter.maxBufferedBytes();
    expect(crowded).toBeLessThan(alone);
    expect(crowded * DEFAULT_LIMITS.maxConnections).toBeLessThanOrEqual(limiter.unreadBytesInAll);
    // Enough for a few envelopes even then.
    expect(crowded).toBeGreaterThanOrEqual(8 * 1024);
  });

  it('takes a join and a new group only when the address has both left', () => {
    const limiter = new Limiter({
      ...DEFAULT_LIMITS,
      maxConnectionsPerAddress: 2,
      joinsPerAddressPerSecond: 0.001,
      newGroupsPerAddressPerHour: 1,
    });
    expect(limiter.allowsJoin('a', false, 0)).toBe(true);
    // No new group left: the join it would have taken stays.
    expect(limiter.allowsJoin('a', false, 0)).toBe(false);
    expect(limiter.allowsJoin('a', true, 0)).toBe(true);
    expect(limiter.allowsJoin('a', true, 0)).toBe(false);
    expect(limiter.allowsJoin('b', true, 0)).toBe(true);
  });
});

describe('relay limits over a connection', () => {
  it('rate-limits a connection that pushes too fast', async () => {
    const { join } = await start({ limits: { ...DEFAULT_LIMITS, connectionPerSecond: 0.2 } });
    const client = await join();
    await client.next();
    for (let n = 1; n <= 3; n++) client.send({ t: 'push', key: key(n), env: env(n) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(2) });
    expect(await client.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(3) });
  });

  it('rate-limits a group as a whole, across its connections and after they leave', async () => {
    const { join } = await start({ limits: { ...DEFAULT_LIMITS, groupPerSecond: 0.2 } });
    const alice = await join();
    const bob = await join();
    await alice.next();
    await bob.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    await bob.next();
    bob.send({ t: 'push', key: key(2), env: env(2) });
    expect(await bob.next()).toEqual({ t: 'stored', key: key(2) });
    await alice.next();
    alice.close();
    bob.close();

    const carol = await join();
    await untilSynced(carol);
    carol.send({ t: 'push', key: key(3), env: env(3) });
    expect(await carol.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(3) });
  });

  it('rate-limits one address across its connections and groups', async () => {
    const { join } = await start({ limits: { ...DEFAULT_LIMITS, addressPerSecond: 0.2 } });
    const alice = await join();
    const stranger = await join(0, OTHER_GROUP);
    await alice.next();
    await stranger.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    stranger.send({ t: 'push', key: key(2), env: env(2) });
    expect(await stranger.next()).toEqual({ t: 'stored', key: key(2) });
    alice.send({ t: 'push', key: key(3), env: env(3) });
    expect(await alice.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(3) });
  });

  it('rate-limits pushes to the whole server', async () => {
    const { store, join } = await start({ limits: { ...DEFAULT_LIMITS, serverPerSecond: 0.1 } });
    // Groups with a history: those in their first day have but half the server's pushes.
    store.append(GROUP, key(100), env(100), 0);
    store.append(OTHER_GROUP, key(100), env(100), 0);
    const alice = await join(1);
    const stranger = await join(1, OTHER_GROUP);
    await alice.next();
    await stranger.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    stranger.send({ t: 'push', key: key(2), env: env(2) });
    expect(await stranger.next()).toEqual({ t: 'error', code: 'rate-limited', key: key(2) });
  });

  it('refuses connections beyond its limit in all', async () => {
    const { connect } = await start({ limits: { ...DEFAULT_LIMITS, maxConnections: 2 } });
    await connect();
    await connect();
    await expect(connect()).rejects.toThrow(/503/);
  });

  it('refuses connections beyond its limit per address, until one closes', async () => {
    const { connect } = await start({ limits: { ...DEFAULT_LIMITS, maxConnectionsPerAddress: 1 } });
    const first = await connect();
    await expect(connect()).rejects.toThrow(/503/);
    first.close();
    await first.closed();
    await expect
      .poll(() =>
        connect().then(
          () => true,
          () => false,
        ),
      )
      .toBe(true);
  });

  it('counts the address a trusted proxy names, not the proxy', async () => {
    const limits = { ...DEFAULT_LIMITS, maxConnectionsPerAddress: 1 };
    const { connect } = await start({ limits }, ['loopback']);
    const from = (address: string) => connect({ 'X-Forwarded-For': address });
    await from('192.0.2.1');
    await from('192.0.2.2');
    await expect(from('192.0.2.1')).rejects.toThrow(/503/);
  });

  it('closes a connection that does not join in time', async () => {
    const { connect } = await start({ limits: { ...DEFAULT_LIMITS, joinTimeoutMs: 100 } });
    const client = await connect();
    expect(await client.closed()).toBe(1008);
  });

  it('limits the new groups one address may open, but not joining known ones', async () => {
    const { join } = await start({
      limits: { ...DEFAULT_LIMITS, newGroupsPerAddressPerHour: 1 },
    });
    const first = await join(0, GROUP);
    await first.next();
    const known = await join(0, GROUP);
    expect(await known.next()).toMatchObject({ t: 'synced' });
    const another = await join(0, OTHER_GROUP);
    expect(await another.next()).toEqual({ t: 'error', code: 'rate-limited', key: null });
    expect(await another.closed()).toBe(1013);
  });

  it('limits the joins one address may make, to known groups too', async () => {
    // As many joins at once as connections: one.
    const { join } = await start({
      limits: { ...DEFAULT_LIMITS, maxConnectionsPerAddress: 1, joinsPerAddressPerSecond: 0.01 },
    });
    const first = await join();
    expect(await first.next()).toMatchObject({ t: 'synced' });
    first.close();
    await first.closed();
    // The address may connect again once the server has seen the first connection close.
    await expect
      .poll(async () => (await join()).next())
      .toEqual({
        t: 'error',
        code: 'rate-limited',
        key: null,
      });
  });

  it('closes a connection that sends messages of any kind too fast', async () => {
    const { connect } = await start({ limits: { ...DEFAULT_LIMITS, messagesPerSecond: 0.5 } });
    const client = await connect();
    // Five seconds' worth at once.
    for (let n = 0; n < 6; n++) client.send({ t: 'ping' });
    for (let n = 0; n < 5; n++) expect(await client.next()).toEqual({ t: 'pong' });
    expect(await client.closed()).toBe(1008);
  });

  it('answers bad requests, but closes a connection that keeps sending them', async () => {
    const { join } = await start();
    const client = await join();
    await client.next();
    for (let n = 0; n < 11; n++) client.sendRaw('{"t":"push"}');
    for (let n = 0; n < 10; n++) {
      expect(await client.next()).toEqual({ t: 'error', code: 'bad-request', key: null });
    }
    expect(await client.closed()).toBe(1008);
  });
});
