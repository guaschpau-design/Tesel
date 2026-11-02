// How long this device has been left untouched, which saving energy goes by (ADR-0097): awake, at
// rest after a minute (the screen goes dark) and deep at rest after ten (the GPS runs at
// intervals). A touch, a key or a wheel wakes it; so does anything important that arrives. The
// touch that wakes the screen only wakes it: nothing under the black screen feels it.

import { WakingTouch } from './waking-touch.ts';

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
    const waking = new WakingTouch(() => {
      this.wake();
    });
    const unlisten = waking.listen();
    const touched = (event: Event) => {
      if (this.rest !== 'awake' && event.type !== 'wheel') {
        // A key or a touch that wakes the screen does nothing else.
        event.preventDefault();
        event.stopImmediatePropagation();
        // A finger wakes it as it lifts (waking-touch.ts).
        if (event.type === 'pointerdown') {
          waking.begin();
          return;
        }
      }
      this.wake();
    };
    for (const type of TOUCHES) {
      window.addEventListener(type, touched, { capture: true, passive: type === 'wheel' });
    }
    const timer = setInterval(() => {
      if (held() || isTyping()) this.#touched = Date.now();
      const idle = Date.now() - this.#touched;
      this.rest = idle >= DEEP_AFTER_MS ? 'deep' : idle >= RESTING_AFTER_MS ? 'resting' : 'awake';
    }, TICK_MS);
    return () => {
      clearInterval(timer);
      for (const type of TOUCHES) window.removeEventListener(type, touched, { capture: true });
      unlisten();
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
