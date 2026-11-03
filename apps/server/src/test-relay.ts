// A relay for tests over real WebSockets, listening on a random local port, with its clients;
// `stopRelay` closes the last one started and its clients.

import type { FastifyInstance } from 'fastify';

import type { EnvelopeStore } from './envelope-store.ts';
import type { RelayOptions } from './relay.ts';
import { TestClient } from './test-client.ts';
import { listen, testServer } from './test-server.ts';

export const GROUP = new Uint8Array(16).fill(7);
export const OTHER_GROUP = new Uint8Array(16).fill(8);
/** A distinct key and envelope for every n. */
export const key = (n: number): Uint8Array => numbered(16, n);
export const env = (n: number): Uint8Array => numbered(60, n);

export function numbered(size: number, n: number): Uint8Array {
  const bytes = new Uint8Array(size);
  new DataView(bytes.buffer).setUint32(0, n);
  return bytes;
}

/** Reads a client's backlog up to synced; returns the cursors it was sent. */
export async function untilSynced(client: TestClient): Promise<number[]> {
  const cursors: number[] = [];
  for (;;) {
    const message = await client.next(10_000);
    if (message.t === 'synced') return cursors;
    if (message.t === 'env') cursors.push(message.cursor);
  }
}

export interface TestRelay {
  readonly store: EnvelopeStore;
  readonly app: FastifyInstance;
  /** The relay's WebSocket URL. */
  readonly url: string;
  readonly connect: (headers?: Record<string, string>) => Promise<TestClient>;
  readonly join: (after?: number, group?: Uint8Array) => Promise<TestClient>;
}

let running: FastifyInstance | null = null;
const clients: TestClient[] = [];

export async function startRelay(
  options: RelayOptions = {},
  trustedProxies: readonly string[] = [],
): Promise<TestRelay> {
  const server = await testServer({ relay: options, app: { trustedProxies } });
  running = server.app;
  const url = `${(await listen(server)).replace('http', 'ws')}/v1/ws`;
  const connect = async (headers: Record<string, string> = {}) => {
    const client = await TestClient.connect(url, headers);
    clients.push(client);
    return client;
  };
  const join = async (after = 0, group: Uint8Array = GROUP) => {
    const client = await connect();
    client.send({ t: 'join', group, after });
    return client;
  };
  return { store: server.store, app: server.app, url, connect, join };
}

export async function stopRelay(): Promise<void> {
  for (const client of clients.splice(0)) client.close();
  await running?.close();
  running = null;
}
