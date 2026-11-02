// The airtime a radio has used, to keep within the EU duty cycle (ARCHITECTURE.md §4.2). How long
// one packet takes depends on the kind of radio and its settings, so the radio's link estimates it
// (`RadioLink.airtimeMs` in `packages/radio`) and the scheduler is given that estimate.

/** The airtime a radio has used in a rolling window: what the duty cycle limits. */
export class AirtimeWindow {
  readonly #windowMs: number;
  readonly #sent: { readonly at: number; readonly ms: number }[] = [];

  constructor(windowMs: number) {
    this.#windowMs = windowMs;
  }

  /** Notes `ms` of airtime used at `now`. */
  add(now: number, ms: number): void {
    this.#sent.push({ at: now, ms });
  }

  /** The airtime used in the window that ends at `now`, in milliseconds. */
  usedMs(now: number): number {
    const start = now - this.#windowMs;
    while (this.#sent[0] !== undefined && this.#sent[0].at < start) this.#sent.shift();
    return this.#sent.reduce((total, entry) => total + entry.ms, 0);
  }
}
