// Keeps the screen on while `wanted` says so, where the browser can (Screen Wake Lock API). The
// browser drops the lock whenever the app is hidden, so it is asked for again on return. Safari
// (on an iPhone, any browser) grants it the first time only right after a touch: a lock refused or
// let go is asked for again at the next touch or key. Call it while a component initialises.

export const screenWakeSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator;

/** The events after which the browser lets a page ask for the lock: a touch, a click, a key. */
const GESTURES = ['touchend', 'click', 'keydown'] as const;

export function keepScreenAwake(wanted: () => boolean): void {
  $effect(() => {
    if (!screenWakeSupported || !wanted()) return;
    return holdScreenAwake();
  });
}

/** Holds the screen on until the returned function is called. */
export function holdScreenAwake(): () => void {
  let lock: WakeLockSentinel | null = null;
  // Aborted when the screen no longer needs to stay on; a lock granted after that is let go.
  const done = new AbortController();
  const held = () => lock !== null && !lock.released;
  const request = async () => {
    if (document.visibilityState !== 'visible' || held()) return;
    try {
      // Asked at once, within the touch: Safari checks for it before anything is awaited.
      const granted = await navigator.wakeLock.request('screen');
      // Another request, after a touch while this one was in flight, may have been granted first.
      if (done.signal.aborted || held()) await granted.release();
      else lock = granted;
    } catch {
      // Refused: on an iPhone, until the next touch; on low battery, the screen turns off as usual.
    }
  };
  const again = () => {
    void request();
  };
  void request();
  document.addEventListener('visibilitychange', again, { signal: done.signal });
  for (const gesture of GESTURES) {
    window.addEventListener(gesture, again, { capture: true, passive: true, signal: done.signal });
  }
  return () => {
    done.abort();
    void lock?.release();
  };
}
