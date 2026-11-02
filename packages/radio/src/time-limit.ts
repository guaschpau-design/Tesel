// A time limit on whatever a radio is asked: a radio that stays silent becomes a failure the user
// is told about, instead of a wait without end (ADR-0090).

import { RadioError } from './radio-link.ts';

/** Waits for `promise` at most `ms`, then rejects as a radio that did not answer. */
export async function within<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RadioError('timeout', what));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
