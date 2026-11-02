// Linking the active group to the radio until it holds (ADR-0104): each time the radio is ready,
// each time the group changes, and, after a failure, again by itself with growing pauses. A radio
// left ready but not linked would look fine and carry nothing.

/** How an attempt went: linked; nothing to do for now; or failed, to be tried again later. */
export type LinkAttempt = 'linked' | 'idle' | 'failed';

/** After a failure, the next attempt waits this long at first, doubling up to the cap. */
const RETRY_FIRST_MS = 1000;
const RETRY_MAX_MS = 30_000;

export class Relinker {
  readonly #attempt: () => Promise<LinkAttempt>;
  /** The attempts under way, until no more are asked for. */
  #running: Promise<void> | null = null;
  /** Asked for again while an attempt runs: it is made once that one ends. */
  #again = false;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;
  #retryDelayMs = RETRY_FIRST_MS;

  /** `attempt` links the group once; it reports failures as values and never throws. */
  constructor(attempt: () => Promise<LinkAttempt>) {
    this.#attempt = attempt;
  }

  /** Links now, or right after the attempt under way; resolves once no attempt is left to make. */
  link(): Promise<void> {
    this.#again = true;
    // `#run` awaits before it ends, so `#running` is set before it is cleared.
    this.#running ??= this.#run();
    return this.#running;
  }

  /** Resolves once the attempts under way, if any, are over. */
  settled(): Promise<void> {
    return this.#running ?? Promise.resolve();
  }

  async #run(): Promise<void> {
    try {
      while (this.#again) {
        this.#again = false;
        this.#stopRetry();
        const outcome = await this.#attempt();
        if (outcome === 'linked') this.#retryDelayMs = RETRY_FIRST_MS;
        if (outcome === 'failed') this.#retryLater();
      }
    } finally {
      this.#running = null;
    }
  }

  #retryLater(): void {
    const delayMs = this.#retryDelayMs;
    this.#retryDelayMs = Math.min(delayMs * 2, RETRY_MAX_MS);
    this.#retryTimer = setTimeout(() => {
      this.#retryTimer = null;
      void this.link();
    }, delayMs);
  }

  #stopRetry(): void {
    if (this.#retryTimer !== null) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
  }
}
