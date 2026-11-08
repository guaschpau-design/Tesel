// The app over the whole screen, without the browser's bars (Fullscreen API), where a browser tab
// allows it: Chrome and the like on Android and on computers. Installed, the app already has the
// screen; Safari on the iPhone has no such API. A browser goes full screen only on a tap, and
// leaves it on a reload, a back gesture or Esc. The Android app has the screen already.

import { IN_ANDROID_APP } from '../platform.ts';

/** Whether this browser tab can show the app over the whole screen. */
export const fullscreenSupported =
  !IN_ANDROID_APP &&
  typeof document !== 'undefined' &&
  document.fullscreenEnabled &&
  window.matchMedia('(display-mode: browser)').matches;

class FullscreenView {
  /** The app is over the whole screen now. */
  active = $state(typeof document !== 'undefined' && document.fullscreenElement !== null);
}

export const fullscreenView = new FullscreenView();

if (fullscreenSupported) {
  document.addEventListener('fullscreenchange', () => {
    fullscreenView.active = document.fullscreenElement !== null;
  });
}

/** Called from a tap: the browser refuses otherwise, and then nothing changes. */
export function enterFullscreen(): void {
  document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
}

export function exitFullscreen(): void {
  if (document.fullscreenElement !== null) void document.exitFullscreen();
}

/**
 * Back to full screen at the first tap of a visit, for those who chose it, since a reload leaves
 * it. Leaving it later, with the back gesture or Esc, holds until the next visit. Returns what
 * stops waiting for that tap.
 */
export function fullscreenAtFirstTap(): () => void {
  const waiting = new AbortController();
  const enter = () => {
    waiting.abort();
    enterFullscreen();
  };
  // The end of a touch or a click, or a key: what a browser lets go full screen on.
  window.addEventListener('pointerup', enter, { capture: true, signal: waiting.signal });
  window.addEventListener('keydown', enter, { capture: true, signal: waiting.signal });
  return () => {
    waiting.abort();
  };
}
