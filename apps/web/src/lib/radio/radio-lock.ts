// One window of Tesel at a time drives the radio (ADR-0111). Two windows linked to one radio would
// each keep a budget of airtime of their own, spending the duty cycle twice, and each take the
// other's answers for its own. A window holds a lock of the browser while its radio is connected;
// another window that asks for the radio meanwhile is told it is in use.

/** The lock's name, the same in every window of the app's origin. */
const RADIO_LOCK = 'tesel-radio';

/** Lets the radio go for other windows. */
export type RadioRelease = () => void;

/**
 * Takes the radio for this window: returns how to let it go, or null if another window holds it.
 * A browser without locks has one window that can use a radio at most, so it is always given.
 */
export async function claimRadio(): Promise<RadioRelease | null> {
  if (!('locks' in navigator)) return () => undefined;
  const { locks } = navigator;
  return new Promise((resolve) => {
    void locks.request(RADIO_LOCK, { ifAvailable: true }, (lock) => {
      if (lock === null) {
        resolve(null);
        return undefined;
      }
      // The lock is held until the promise the callback returns settles.
      return new Promise<void>((release) => {
        resolve(() => {
          release();
        });
      });
    });
  });
}
