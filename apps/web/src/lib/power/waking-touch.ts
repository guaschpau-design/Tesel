// The touch that wakes the black screen (ADR-0097), kept from what is under it. The screen wakes
// as the finger lifts, while it is still there to take the lift; what follows is kept to itself
// too: the mouse events and the click a browser makes of a touch where it lifted, by then over
// the map or whatever else was under the screen.

/**
 * What a touch brings after the finger lands. The touch events too: the map, under the black screen
 * in the page, would see the finger land and never lift, and take the next tap for a second finger.
 */
const REST_OF_TOUCH = [
  'pointerdown',
  'pointerup',
  'pointercancel',
  'touchstart',
  'touchmove',
  'touchend',
  'touchcancel',
  'mousedown',
  'mouseup',
  'click',
  'dblclick',
  'contextmenu',
] as const;
/** The click comes this long after the finger lifts, at most. */
const CLICK_AFTER_LIFT_MS = 500;
/** A finger held down longer wakes the screen all the same. */
const HELD_AT_MOST_MS = 3000;

export class WakingTouch {
  readonly #wake: () => void;
  /** No touch being kept, a finger down on the black screen, or one that has lifted from it. */
  #state: 'none' | 'down' | 'lifted' = 'none';
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(wake: () => void) {
    this.#wake = wake;
  }

  /** Listens until the returned function is called; does nothing until a touch `begin`s. */
  listen(): () => void {
    for (const type of REST_OF_TOUCH) {
      window.addEventListener(type, this.#take, { capture: true, passive: false });
    }
    return () => {
      this.#end();
      for (const type of REST_OF_TOUCH) {
        window.removeEventListener(type, this.#take, { capture: true });
      }
    };
  }

  /** A finger has landed on the black screen. */
  begin(): void {
    this.#state = 'down';
    clearTimeout(this.#timer);
    this.#timer = setTimeout(this.#lift, HELD_AT_MOST_MS);
  }

  readonly #take = (event: Event): void => {
    if (this.#state === 'none') return;
    // A new touch once this one has lifted is the user's.
    if (this.#state === 'lifted' && event.type === 'pointerdown') {
      this.#end();
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === 'pointerup' || event.type === 'pointercancel') this.#lift();
  };

  readonly #lift = (): void => {
    if (this.#state !== 'down') return;
    this.#state = 'lifted';
    this.#wake();
    clearTimeout(this.#timer);
    this.#timer = setTimeout(this.#end, CLICK_AFTER_LIFT_MS);
  };

  readonly #end = (): void => {
    clearTimeout(this.#timer);
    this.#state = 'none';
  };
}
