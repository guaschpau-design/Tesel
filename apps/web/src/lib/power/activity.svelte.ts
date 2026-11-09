// How long this device has been left untouched, and pocket mode (ADR-0097, ADR-0127): awake; in
// pocket mode, when the user asks or, if they let it, after a minute untouched; deep in it after ten
// minutes untouched (the GPS runs at intervals). In pocket mode a touch does nothing: only sliding
// its handle out of it brings the app back (PocketScreen.svelte), or anything important that
// arrives (attention.ts).

export type Rest = 'awake' | 'resting' | 'deep';

const RESTING_AFTER_MS = 60_000;
const DEEP_AFTER_MS = 10 * 60_000;
/** How often how long it has been untouched is looked at. */
const TICK_MS = 5000;
const TOUCHES = ['pointerdown', 'keydown', 'wheel'] as const;

export class Activity {
  rest: Rest = $state('awake');
  /** Counts the touches pocket mode took in, so that it can say how to leave it. */
  nudges = $state(0);
  #touched = Date.now();

  /** The user is back, or something they must see arrived. */
  wake(): void {
    this.#touched = Date.now();
    this.rest = 'awake';
  }

  /** Pocket mode at once, as the user asked: as if a minute had passed untouched. */
  pocket(): void {
    this.#touched = Date.now() - RESTING_AFTER_MS;
    this.rest = 'resting';
  }

  /**
   * Follows the user's touches until the returned function is called. While `held` says so, or
   * something is being typed, the device counts as touched: no rest in the middle of a task. Pocket
   * mode comes by itself only while `automatic` says so.
   */
  follow(held: () => boolean, automatic: () => boolean): () => void {
    const touched = () => {
      if (this.rest === 'awake') this.#touched = Date.now();
      else this.nudges++;
    };
    for (const type of TOUCHES) {
      window.addEventListener(type, touched, { capture: true, passive: true });
    }
    const timer = setInterval(() => {
      if (this.rest === 'awake' && (held() || isTyping())) this.#touched = Date.now();
      const idle = Date.now() - this.#touched;
      if (this.rest === 'awake' && (!automatic() || idle < RESTING_AFTER_MS)) return;
      this.rest = idle >= DEEP_AFTER_MS ? 'deep' : 'resting';
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      for (const type of TOUCHES) window.removeEventListener(type, touched, { capture: true });
      this.wake();
    };
  }
}

/** This device's activity, which pocket mode, the GPS and what wakes it share. */
export const activity = new Activity();

function isTyping(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && active.type !== 'checkbox' && active.type !== 'radio') ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}
