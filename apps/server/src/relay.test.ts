// The relay over real WebSockets, with the server listening on a random local port.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  env,
  GROUP,
  key,
  OTHER_GROUP,
  startRelay as start,
  stopRelay,
  untilSynced,
} from './test-relay.ts';

afterEach(async () => {
  await stopRelay();
  vi.restoreAllMocks();
});

describe('relay', () => {
  it('stores a push and relays it to the other members of the group only', async () => {
    const { store, join } = await start();
    const alice = await join();
    const bob = await join();
    const stranger = await join(0, OTHER_GROUP);
    for (const client of [alice, bob, stranger]) {
      expect(await client.next()).toEqual({ t: 'synced', cursor: 0, store: store.id });
    }

    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(1) });
    expect(await alice.isQuiet()).toBe(true);
    expect(await stranger.isQuiet()).toBe(true);
  });

  it('answers a ping, before and after joining, so clients can tell a dead link', async () => {
    const { connect } = await start();
    const client = await connect();
    client.send({ t: 'ping' });
    expect(await client.next()).toEqual({ t: 'pong' });
    client.send({ t: 'join', group: GROUP, after: 0 });
    await client.next();
    client.send({ t: 'ping' });
    expect(await client.next()).toEqual({ t: 'pong' });
  });

  it('acknowledges a repeated push without relaying it again', async () => {
    const { join } = await start();
    const alice = await join();
    const bob = await join();
    await alice.next();
    await bob.next();

    alice.send({ t: 'push', key: key(1), env: env(1) });
    await alice.next();
    await bob.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.isQuiet()).toBe(true);
  });

  it('stores and relays a different envelope pushed under a known key', async () => {
    const { join } = await start();
    const mallory = await join();
    const bob = await join();
    await mallory.next();
    await bob.next();

    mallory.send({ t: 'push', key: key(1), env: env(66) });
    await mallory.next();
    expect(await bob.next()).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(66) });
    const alice = await join();
    await untilSynced(alice);
    alice.send({ t: 'push', key: key(1), env: env(1) });
    expect(await alice.next()).toEqual({ t: 'stored', key: key(1) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 2, key: key(1), env: env(1) });
  });

  it('sends a late joiner the backlog after its cursor, then synced', async () => {
    const { store, join } = await start();
    const alice = await join();
    await alice.next();
    for (let n = 1; n <= 3; n++) {
      alice.send({ t: 'push', key: key(n), env: env(n) });
      await alice.next();
    }

    const bob = await join(1);
    expect(await bob.next()).toEqual({ t: 'env', cursor: 2, key: key(2), env: env(2) });
    expect(await bob.next()).toEqual({ t: 'env', cursor: 3, key: key(3), env: env(3) });
    expect(await bob.next()).toEqual({ t: 'synced', cursor: 3, store: store.id });
  });

  it('sends everything to a client that remembers a cursor the server never reached', async () => {
    const { store, join } = await start();
    const alice = await join();
    await alice.next();
    alice.send({ t: 'push', key: key(1), env: env(1) });
    await alice.next();

    const bob = await join(50);
    expect(await bob.next()).toEqual({ t: 'env', cursor: 1, key: key(1), env: env(1) });
    expect(await bob.next()).toEqual({ t: 'synced', cursor: 1, store: store.id });
  });

  it('refuses pushes before joining and a second join', async () => {
    const { connect } = await start();
    const client = await connect();
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'error', code: 'not-joined', key: key(1) });
    client.send({ t: 'join', group: GROUP, after: 0 });
    await client.next();
    client.send({ t: 'join', group: OTHER_GROUP, after: 0 });
    expect(await client.next()).toEqual({ t: 'error', code: 'bad-request', key: null });
  });

  it('answers malformed and oversized frames with an error instead of closing', async () => {
    const { join } = await start();
    const client = await join();
    await client.next();
    client.sendRaw('{"t":"push"}');
    expect(await client.next()).toEqual({ t: 'error', code: 'bad-request', key: null });
    client.send({ t: 'push', key: key(1), env: new Uint8Array(194) });
    expect(await client.next()).toEqual({ t: 'error', code: 'too-large', key: key(1) });
  });
});

describe('relay failures', () => {
  it('answers unavailable when the store cannot take a push, and keeps serving', async () => {
    const { store, join } = await start();
    const client = await join();
    await client.next();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const append = vi.spyOn(store, 'append').mockImplementationOnce(() => {
      throw new Error('database or disk is full');
    });
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'error', code: 'unavailable', key: key(1) });
    expect(error).toHaveBeenCalled();
    append.mockRestore();
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'stored', key: key(1) });
  });

  it('answers unavailable while the disk is nearly full', async () => {
    const { join } = await start({ hasRoom: () => false });
    const client = await join();
    await client.next();
    client.send({ t: 'push', key: key(1), env: env(1) });
    expect(await client.next()).toEqual({ t: 'error', code: 'unavailable', key: key(1) });
  });

  it('closes a connection whose backlog cannot be read', async () => {
    const { store, join } = await start();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(store, 'after').mockImplementation(() => {
      throw new Error('disk I/O error');
    });
    const client = await join();
    expect(await client.closed()).toBe(1011);
  });
});
