// Pushes waiting for a relay (protocol §8): the most urgent first, and paced below the server's
// per-connection rate limit, so catching up after hours offline neither gets refused nor holds
// an SOS behind a backlog of positions. A push the server refuses for going too fast goes again
// a little later; the outbox keeps everything until the server confirms it. A key may carry more
// than one envelope, when someone wrote under another's name (protocol §3.1): each is pushed, and
// the server answers pushes in order, so a reply under a key is for the first of them sent.

import { TokenBucket, urgencyOf } from '@tesel/core';
import { toBase64url, type EventType } from '@tesel/protocol';

/** Below the server's 30 pushes at once and 3 per second (apps/server/src/relay.ts). */
const PUSH_BURST = 20;
const PUSHES_PER_SECOND = 2;
/** When nothing may go now, look again this much later. */
const PACE_MS = 500;
/** Wait after the server refuses a push for now: for going too fast, or having no room. */
const REFUSED_WAIT_MS = 5000;

interface Push {
  /** The event key, which the server's replies name. */
  readonly id: string;
  /** The envelope, which tells apart pushes under one key. */
  readonly envelope: string;
  readonly key: Uint8Array;
  readonly env: Uint8Array;
  readonly urgency: number;
}

export class PushQueue {
  readonly #send: (key: Uint8Array, env: Uint8Array) => void;
  readonly #now: () => number;
  readonly #bucket: TokenBucket;
  /** Not sent yet, most urgent first and in arrival order within the same urgency. */
  #waiting: Push[] = [];
  /** Sent, until the server stores or refuses them, in the order they were sent. */
  #sent: Push[] = [];
  /** Pushes refused for going too fast, waiting to queue again. */
  readonly #retries = new Set<ReturnType<typeof setTimeout>>();
  #paceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(send: (key: Uint8Array, env: Uint8Array) => void, now: () => number = Date.now) {
    this.#send = send;
    this.#now = now;
    this.#bucket = new TokenBucket(PUSH_BURST, PUSHES_PER_SECOND, now());
  }

  add(key: Uint8Array, env: Uint8Array, type: EventType | null): void {
    const push = { id: toBase64url(key), envelope: toBase64url(env), key, env };
    const same = (other: Push) => other.id === push.id && other.envelope === push.envelope;
    if (this.#sent.some(same) || this.#waiting.some(same)) return;
    this.#insert({ ...push, urgency: urgencyOf(type) });
    this.#drain();
  }

  /** The server stored a push under `key`: returns its envelope, or null if none was sent. */
  stored(key: Uint8Array): Uint8Array | null {
    return this.#answered(key)?.env ?? null;
  }

  /** The server could not take a push now (too fast, or no room): it goes again a little later. */
  tryLater(key: Uint8Array): void {
    const push = this.#answered(key);
    if (push === undefined) return;
    const timer = setTimeout(() => {
      this.#retries.delete(timer);
      this.#insert(push);
      this.#drain();
    }, REFUSED_WAIT_MS);
    this.#retries.add(timer);
  }

  /** The connection is gone: what was not stored goes again from the outbox after the next sync. */
  clear(): void {
    this.#waiting = [];
    this.#sent = [];
    for (const timer of this.#retries) clearTimeout(timer);
    this.#retries.clear();
    if (this.#paceTimer !== null) clearTimeout(this.#paceTimer);
    this.#paceTimer = null;
  }

  /** Takes out of those sent the first push under `key`, which a reply of the server is for. */
  #answered(key: Uint8Array): Push | undefined {
    const id = toBase64url(key);
    const push = this.#sent.find((sent) => sent.id === id);
    if (push !== undefined) this.#sent = this.#sent.filter((sent) => sent !== push);
    return push;
  }

  #insert(push: Push): void {
    const at = this.#waiting.findIndex((other) => other.urgency > push.urgency);
    if (at === -1) this.#waiting.push(push);
    else this.#waiting.splice(at, 0, push);
  }

  #drain(): void {
    while (this.#waiting.length > 0 && this.#bucket.take(this.#now())) {
      const push = this.#waiting.shift();
      if (push === undefined) break;
      this.#sent.push(push);
      this.#send(push.key, push.env);
    }
    if (this.#waiting.length > 0 && this.#paceTimer === null) {
      this.#paceTimer = setTimeout(() => {
        this.#paceTimer = null;
        this.#drain();
      }, PACE_MS);
    }
  }
}
