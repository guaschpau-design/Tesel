// The airtime a radio has used, to keep within the EU duty cycle (ARCHITECTURE.md §4.2). How long
// one packet takes depends on the kind of radio and its settings, so the radio's link estimates it
// (`RadioLink.airtimeMs` in `packages/radio`) and the scheduler is given that estimate.

/** Airtime used at one time: `ms` milliseconds on the air from `at`, both in milliseconds. */
export interface AirtimeUse {
  readonly at: number;
  readonly ms: number;
}

/**
 * The airtime a radio has used in a rolling window: what the duty cycle limits. What it holds can
 * be read and restored, so that a restart of the app does not give the radio a fresh budget.
 */
export class AirtimeWindow {
  readonly #windowMs: number;
  #sent: AirtimeUse[] = [];

  constructor(windowMs: number) {
    this.#windowMs = windowMs;
  }

  /** Notes `ms` of airtime used at `now`. */
  add(now: number, ms: number): void {
    this.#sent.push({ at: now, ms });
  }

  /** The airtime used in the window that ends at `now`, in milliseconds. */
  usedMs(now: number): number {
    this.#forgetBefore(now - this.#windowMs);
    return this.#sent.reduce((total, entry) => total + entry.ms, 0);
  }

  /** What was used in the window that ends at `now`, oldest first. */
  uses(now: number): AirtimeUse[] {
    this.#forgetBefore(now - this.#windowMs);
    return [...this.#sent];
  }

  /**
   * Adds what was used before, as `uses` read it, to what this window holds: the same use, at the
   * same time and for as long, counts once. A use stamped more than a window ahead of `now` was
   * stamped by a clock that ran ahead: kept, it would hold the budget until that time came.
   */
  restore(uses: readonly AirtimeUse[], now: number): void {
    const known = new Set(this.#sent.map(useKey));
    const restored = uses.filter(
      (use) => use.at <= now + this.#windowMs && !known.has(useKey(use)),
    );
    this.#sent = [...this.#sent, ...restored].sort((a, b) => a.at - b.at);
  }

  #forgetBefore(start: number): void {
    while (this.#sent[0] !== undefined && this.#sent[0].at < start) this.#sent.shift();
  }
}

function useKey({ at, ms }: AirtimeUse): string {
  return `${at}/${ms}`;
}
