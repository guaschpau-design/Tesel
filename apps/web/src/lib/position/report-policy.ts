// When to publish this device's position over the internet, and what. LoRa has its own, much
// stricter thinning in the airtime scheduler (ARCHITECTURE.md §4.2). A device standing still is
// published where it was, however the GPS wanders (movement.ts, ADR-0092).

import { isMove, type Placed } from './movement.ts';

/** Never more often than this, however fast the device moves. */
const MIN_INTERVAL_S = 5;
/** Without a move, the place last published is published again after this long, so others can
 * tell the position is still live. */
const HEARTBEAT_S = 60;

/** What was last published: where, how sure, and when, in seconds since the epoch. */
export interface Report extends Placed {
  readonly time: number;
}

/**
 * What to publish when the GPS gives `fix` at `time`: the fix (`'fix'`) if it is the first, a move,
 * or a much sharper idea of where the device is; the place last published (`'again'`), after a
 * minute without either; or nothing.
 */
export function nextReport(last: Report | null, fix: Placed, time: number): 'fix' | 'again' | null {
  if (last === null) return 'fix';
  const elapsed = time - last.time;
  if (elapsed < MIN_INTERVAL_S) return null;
  if (isMove(last, fix) || isSharper(fix, last)) return 'fix';
  return elapsed >= HEARTBEAT_S ? 'again' : null;
}

/** A fix at least twice as sure as the one published: the GPS has settled, or the sky opened. */
function isSharper(fix: Placed, last: Placed): boolean {
  return fix.accuracy !== null && last.accuracy !== null && fix.accuracy * 2 <= last.accuracy;
}
