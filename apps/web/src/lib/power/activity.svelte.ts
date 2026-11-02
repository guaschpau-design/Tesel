// How long this device has been left untouched, which saving energy goes by (ADR-0097): awake, at
// rest after a minute (the screen goes dark) and deep at rest after ten (the GPS runs at
// intervals). A touch, a key or a wheel wakes it; so does anything important that arrives.

export type Rest = 'awake' | 'resting' | 'deep';

const RESTING_AFTER_MS = 60_000;
const DEEP_AFTER_MS = 10 * 60_000;
/** How often how long it has been untouched is looked at. */
const TICK_MS = 5000;
const TOUCHES = ['pointerdown', 'keydown', 'wheel'] as const;

export class Activity {
  rest: Rest = $state('awake');
  #touched = Date.now();

  /** The user is back, or something they must see arrived. */
  wake(): void {
    this.#touched = Date.now();
    this.rest = 'awake';
  }

  /**
   * Follows the user's touches until the returned function is called. While `held` says so, or
   * something is being typed, the device counts as touched: no rest in the middle of a task.
   */
  follow(held: () => boolean): () => void {
    const touched = () => {
      this.wake();
    };
    for (const type of TOUCHES) {
      window.addEventListener(type, touched, { capture: true, passive: true });
    }
    const timer = setInterval(() => {
      if (held() || isTyping()) this.#touched = Date.now();
      const idle = Date.now() - this.#touched;
      this.rest = idle >= DEEP_AFTER_MS ? 'deep' : idle >= RESTING_AFTER_MS ? 'resting' : 'awake';
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      for (const type of TOUCHES) window.removeEventListener(type, touched, { capture: true });
      this.wake();
    };
  }
}

/** This device's activity, which the rest screen, the GPS and what wakes it share. */
export const activity = new Activity();

function isTyping(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && active.type !== 'checkbox' && active.type !== 'radio') ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}
