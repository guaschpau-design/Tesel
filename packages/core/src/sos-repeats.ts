// This device's own SOS calls that repeat on the air until someone answers them (protocol §3.8,
// ADR-0043), even after the radio changes group (ADR-0104).

import { LIMITS } from './lora-limits.ts';

/** Own SOS calls still waiting for an acknowledgement or a cancellation. */
export class SosRepeats {
  /** By rival key (rivals.ts), the reference key of the call. */
  readonly #open = new Map<string, string>();

  /** An own SOS was queued: it repeats until a call under `reference` is answered. */
  open(key: string, reference: string): void {
    this.#open.set(key, reference);
  }

  isOpen(key: string): boolean {
    return this.#open.has(key);
  }

  /** A call under `reference` was answered or cancelled: returns the keys that stop repeating. */
  close(reference: string): string[] {
    const closed: string[] = [];
    for (const [key, call] of this.#open) {
      if (call !== reference) continue;
      this.#open.delete(key);
      closed.push(key);
    }
    return closed;
  }

  /** Stops the repeats of one call: its group was left. */
  drop(key: string): void {
    this.#open.delete(key);
  }
}

/** How long an own SOS waits for its next repeat once sent `sends` times: 30 s, doubling to 5 min. */
export function repeatWaitMs(sends: number): number {
  return Math.min(LIMITS.sosFirstRepeatMs * 2 ** (sends - 1), LIMITS.sosMaxRepeatMs);
}
