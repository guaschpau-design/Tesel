// When to publish this device's position over the internet, and what. LoRa has its own, much
// stricter thinning in the airtime scheduler (ARCHITECTURE.md §4.2). A device standing still is
// published where it was, however the GPS wanders; a move is published once the fixes after it
// bear it out (movement.ts, ADR-0092, ADR-0119), and on foot less often than in a vehicle, so that
// the phone's modem gets to rest between two (ADR-0123).

import { distanceMeters } from '@tesel/core';

import { confirmMove, isMove, type Placed, type Timed } from './movement.ts';

/** Never more often than this, however fast the device moves. */
const MIN_INTERVAL_S = 5;
/** A move at walking pace is published at most this often: its trail is as good. */
const WALKING_INTERVAL_S = 15;
/** Faster than this, in metres per second (9 km/h), a move is published as often as any. */
const WALKING_M_S = 2.5;
/** Without a move, the place last published is published again after this long, so others can
 * tell the position is still live. */
const HEARTBEAT_S = 60;

/** What was last published: where, how sure, and when, in seconds since the epoch. */
export type Report = Timed;

/** The fixes of one stretch of sharing, and what of them to publish. */
export class ReportPolicy {
  #last: Report | null = null;
  /** The first fix away from the place last published, then those since: a move not yet borne out. */
  #away: Report[] = [];

  /** What was last published, if anything. */
  get last(): Report | null {
    return this.#last;
  }

  /**
   * What to publish when the GPS gives `fix` at `time`: the fix (`'fix'`) if it is the first, a
   * move the fixes since have borne out, or a much sharper idea of where the device is; the place
   * last published (`'again'`), after a minute without either; or nothing. What it answers is
   * taken as published.
   */
  next(fix: Placed, time: number): 'fix' | 'again' | null {
    const last = this.#last;
    const timed: Report = { ...fix, time };
    if (last === null) return this.#publish(timed);
    const due = time - last.time >= MIN_INTERVAL_S;
    if (isMove(last, fix)) {
      const [candidate, ...later] = this.#away;
      const answer = candidate ? confirmMove(last, candidate, [...later, timed]) : 'unsure';
      // A jump the other way starts a new wait, from this fix.
      this.#away = candidate && answer !== 'wandering' ? [...this.#away, timed] : [timed];
      if (answer === 'move' && time - last.time >= moveInterval(last, timed)) {
        return this.#publish(timed);
      }
    } else {
      this.#away = [];
      if (due && isSharper(fix, last)) return this.#publish(timed);
    }
    if (time - last.time < HEARTBEAT_S) return null;
    this.#last = { ...last, time };
    return 'again';
  }

  #publish(report: Report): 'fix' {
    this.#last = report;
    this.#away = [];
    return 'fix';
  }
}

/** How long after the place last published a move to `fix` may be: longer at walking pace. */
function moveInterval(last: Report, fix: Report): number {
  const elapsed = fix.time - last.time;
  const fast = elapsed > 0 && distanceMeters(last.at, fix.at) / elapsed > WALKING_M_S;
  return fast ? MIN_INTERVAL_S : WALKING_INTERVAL_S;
}

/** A fix at least twice as sure as the one published: the GPS has settled, or the sky opened. */
function isSharper(fix: Placed, last: Placed): boolean {
  return fix.accuracy !== null && last.accuracy !== null && fix.accuracy * 2 <= last.accuracy;
}
