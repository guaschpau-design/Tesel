// A simulated device: its own identity and its own connection to the relay, as a phone has, so
// that the relay's per-connection limits treat it like one (protocol §8).

import {
  encodeEvent,
  encodeRelayMessage,
  eventKey,
  generateIdentity,
  parseServerMessage,
  relayUrl,
  sealEnvelope,
  toBase64url,
  type EventRef,
  type GroupKeys,
  type Identity,
  type NodeId,
} from '@tesel/protocol';
import type { EventDraft } from '@tesel/scenario';
import WebSocket from 'ws';

/** How long to wait before pushing again an envelope the relay refused for going too fast. */
const RATE_LIMIT_RETRY_MS = 500;

export class SimulatedDevice {
  readonly identity: Identity;
  readonly #socket: WebSocket;
  readonly #keys: GroupKeys;
  /** Pushes waiting for the relay's `stored`, by event key. */
  readonly #waiting = new Map<
    string,
    { resolve: () => void; retry: () => void; reject: (error: Error) => void }
  >();
  #seq = 0;

  private constructor(socket: WebSocket, keys: GroupKeys, identity: Identity) {
    this.#socket = socket;
    this.#keys = keys;
    this.identity = identity;
    socket.on('message', (data: WebSocket.RawData) => {
      // The relay sends text frames, which `ws` hands over as a single buffer.
      if (!Buffer.isBuffer(data)) return;
      const message = parseServerMessage(data.toString('utf8'));
      if (message === null || (message.t !== 'stored' && message.t !== 'error')) return;
      if (message.key === null) {
        // Refused without saying which push: none of them can be counted on.
        if (message.t === 'error') this.#failAll(new Error(`the relay refused: ${message.code}`));
        return;
      }
      const waiting = this.#waiting.get(toBase64url(message.key));
      if (message.t === 'stored') waiting?.resolve();
      else if (message.code === 'rate-limited') waiting?.retry();
      else waiting?.reject(new Error(`the relay refused the event: ${message.code}`));
    });
    socket.on('close', () => {
      this.#failAll(new Error('the relay closed the connection'));
    });
  }

  /** Every push still waiting fails: the relay will not store it. */
  #failAll(error: Error): void {
    for (const waiting of [...this.#waiting.values()]) waiting.reject(error);
  }

  /** Connects a new device, with a new identity, to the group on `server`. */
  static async connect(server: string, keys: GroupKeys): Promise<SimulatedDevice> {
    const socket = new WebSocket(relayUrl(server));
    await new Promise<void>((resolve, reject) => {
      socket.once('open', () => {
        resolve();
      });
      socket.once('error', reject);
    });
    // A device has to join before it pushes. The relay then sends the group's backlog, which a
    // simulated device ignores: it only speaks.
    socket.send(encodeRelayMessage({ t: 'join', group: keys.groupId, after: 0 }));
    return new SimulatedDevice(socket, keys, generateIdentity());
  }

  get nodeId(): NodeId {
    return this.identity.nodeId;
  }

  /** Sends one event and resolves once the relay has stored it, with the event's reference. */
  async publish(draft: EventDraft, time: number): Promise<EventRef> {
    this.#seq += 1;
    const event = draft({ origin: this.nodeId, seq: this.#seq, time });
    const bytes = encodeEvent(event);
    if (!bytes.ok) throw new Error(`cannot encode ${event.type}: ${bytes.error.detail}`);
    const key = eventKey(this.#keys, event);
    const push = encodeRelayMessage({ t: 'push', key, env: sealEnvelope(this.#keys, bytes.value) });
    await new Promise<void>((resolve, reject) => {
      const id = toBase64url(key);
      this.#waiting.set(id, {
        resolve: () => {
          this.#waiting.delete(id);
          resolve();
        },
        reject: (error) => {
          this.#waiting.delete(id);
          reject(error);
        },
        retry: () => {
          setTimeout(() => {
            this.#socket.send(push);
          }, RATE_LIMIT_RETRY_MS);
        },
      });
      this.#socket.send(push);
    });
    return { origin: event.origin, seq: event.seq };
  }

  close(): void {
    this.#socket.close();
  }
}
