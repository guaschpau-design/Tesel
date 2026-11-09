import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { holdScreenAwake } from './screen-awake.svelte.ts';

/** A wake lock as Safari's: granted only within a touch, until it is first granted. */
class SafariWakeLock {
  touching = false;
  authorised = false;
  readonly held: { released: boolean; release: () => Promise<void> }[] = [];

  request(): Promise<unknown> {
    if (!this.touching && !this.authorised) return Promise.reject(new Error('NotAllowedError'));
    this.authorised = true;
    const sentinel = {
      released: false,
      release: () => {
        sentinel.released = true;
        return Promise.resolve();
      },
    };
    this.held.push(sentinel);
    return Promise.resolve(sentinel);
  }

  get holding(): number {
    return this.held.filter((sentinel) => !sentinel.released).length;
  }
}

/** Lets the requests and releases in flight end. */
const settle = () => new Promise((done) => setTimeout(done, 0));

describe('keeping the screen on', () => {
  const page = new EventTarget();
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  let wakeLock: SafariWakeLock;

  beforeEach(() => {
    wakeLock = new SafariWakeLock();
    vi.stubGlobal('window', page);
    vi.stubGlobal('document', doc);
    vi.stubGlobal('navigator', { wakeLock });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function touch(): Promise<void> {
    wakeLock.touching = true;
    page.dispatchEvent(new Event('touchend'));
    page.dispatchEvent(new Event('click'));
    wakeLock.touching = false;
    await settle();
  }

  it('asks again at the first touch when Safari refuses it without one, and holds one lock', async () => {
    const stop = holdScreenAwake();
    await settle();
    expect(wakeLock.holding).toBe(0);
    await touch();
    expect(wakeLock.holding).toBe(1);
    await touch();
    expect(wakeLock.holding).toBe(1);
    stop();
    await settle();
    expect(wakeLock.holding).toBe(0);
  });

  it('asks again on returning to the app, once Safari has granted it', async () => {
    const stop = holdScreenAwake();
    await touch();
    for (const sentinel of wakeLock.held) await sentinel.release();
    doc.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(wakeLock.holding).toBe(1);
    stop();
  });
});
