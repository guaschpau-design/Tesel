// This device's own SOS calls that repeat on the air until someone answers them (protocol §3.8,
// ADR-0043), even after the radio changes group (ADR-0104).

import { LIMITS } from './lora-limits.ts';

/** An own SOS call that repeats: its reference, and the group it was made in, if the caller says. */
interface OpenCall {
  readonly reference: string;
  readonly group: string | undefined;
}

/**
 * Own SOS calls still waiting for an acknowledgement or a cancellation. Each group numbers this
 * device's events on its own (protocol §3.1, ADR-0111), so a call is answered only by what is
 * heard in its own group.
 */
export class SosRepeats {
  /** By rival key (rivals.ts). */
  readonly #open = new Map<string, OpenCall>();

  /** An own SOS was queued: it repeats until a call under `reference` in `group` is answered. */
  open(key: string, reference: string, group: string | undefined): void {
    this.#open.set(key, { reference, group });
  }

  isOpen(key: string): boolean {
    return this.#open.has(key);
  }

  /**
   * A call under `reference` was answered or cancelled in `group`: returns the keys that stop
   * repeating.
   */
  close(reference: string, group: string | undefined): string[] {
    const closed: string[] = [];
    for (const [key, call] of this.#open) {
      if (call.reference !== reference || call.group !== group) continue;
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
