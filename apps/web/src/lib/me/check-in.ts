// The safety check-in on this device (protocol §3.17): after a while without the member moving or
// touching it, the device asks whether they are well; with no answer in time, it calls for help.
// Time with the app off screen does not count: a browser cannot tell what the member did meanwhile.
// A call that could not be sent is tried again, less and less often, until it goes out.

import { isMove, type Placed } from '../position/movement.ts';

/** After how many minutes without a tap or a move whoever coordinates has members asked. */
export const CHECK_IN_MINUTES = 30;

/** How long the member has to answer, in milliseconds. */
export const ANSWER_MS = 2 * 60_000;

/** How long after a call that could not be sent it is tried again the first time, in milliseconds. */
export const RETRY_FIRST_MS = 5_000;

/** The longest wait between two tries of a call that could not be sent, in milliseconds. */
export const RETRY_MAX_MS = 60_000;

/** Moving this far, in metres, counts as being up and about. */
const MOVED_M = 25;

/**
 * Whether the device has moved from one place to another: more than MOVED_M, and more than the
 * two fixes could be off together, so that a fix wandering in the same spot is not a move.
 */
export function hasMoved(from: Placed, to: Placed): boolean {
  return isMove(from, to, MOVED_M);
}

/**
 * Nothing to say; asking; calling for help, with the call on its way; a call that could not be
 * sent, waiting to be tried again; or help called for, with the call sent.
 */
export type CheckInStep = 'quiet' | 'asking' | 'calling' | 'failed' | 'called';

export class CheckIn {
  /** When the member last moved or touched the device, in milliseconds. */
  #since: number;
  #asked = 0;
  /** While a call waits to be tried again, when, in milliseconds. */
  #retryAt = 0;
  /** How many tries of the call in a row could not be sent. */
  #failures = 0;
  #step: CheckInStep = 'quiet';
  /** Whether the app is off screen. */
  #away = false;

  constructor(now: number) {
    this.#since = now;
  }

  get step(): CheckInStep {
    return this.#step;
  }

  /** While asking, when the answer is due; while a call waits, when it is tried again. */
  get deadline(): number | null {
    switch (this.#step) {
      case 'asking':
        return this.#asked + ANSWER_MS;
      case 'failed':
        return this.#retryAt;
      case 'quiet':
      case 'calling':
      case 'called':
        return null;
    }
  }

  /** The member moved or touched the device: all is well, and the wait starts again. */
  activity(now: number): void {
    this.#since = now;
    this.#step = 'quiet';
    this.#failures = 0;
  }

  /** The call for help went out. Nothing changes if the member answered meanwhile. */
  sent(): void {
    if (this.#step !== 'calling') return;
    this.#step = 'called';
    this.#failures = 0;
  }

  /**
   * The call for help could not be sent at `now`: it is tried again after RETRY_FIRST_MS, then
   * after twice as long each time, up to RETRY_MAX_MS. Nothing changes if the member answered
   * meanwhile.
   */
  failed(now: number): void {
    if (this.#step !== 'calling') return;
    this.#step = 'failed';
    this.#retryAt = now + Math.min(RETRY_FIRST_MS * 2 ** this.#failures, RETRY_MAX_MS);
    this.#failures += 1;
  }

  /** The app went off screen: nothing is due until it is back. */
  away(): void {
    this.#away = true;
  }

  /** The app is on screen again: the member is there, and the wait starts again. */
  back(now: number): void {
    this.#away = false;
    this.activity(now);
  }

  /**
   * What is due at `now`, after `limitMs` of quiet: to ask, to call for help, or nothing. A call
   * that could not be sent is due again even off screen: help was already found to be needed.
   */
  tick(now: number, limitMs: number): 'ask' | 'call' | null {
    if (this.#step === 'failed' && now >= this.#retryAt) {
      this.#step = 'calling';
      return 'call';
    }
    if (this.#away) return null;
    if (this.#step === 'quiet' && now - this.#since >= limitMs) {
      this.#step = 'asking';
      this.#asked = now;
      return 'ask';
    }
    if (this.#step === 'asking' && now - this.#asked >= ANSWER_MS) {
      this.#step = 'calling';
      return 'call';
    }
    return null;
  }
}
