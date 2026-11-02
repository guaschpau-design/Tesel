// What brings the user back while the screen rests (ADR-0097): something they must see now wakes
// the screen with a vibration and a tone; a chat line only vibrates, so that a busy chat does not
// keep the screen lit.

import { chime } from '../incidents/alarm.ts';
import { activity } from './activity.svelte.ts';

const ATTENTION_VIBRATION_MS = [250, 120, 250];
const CHAT_VIBRATION_MS = 150;

/**
 * Wakes the screen for something important: an SOS, a task handed over, a danger, a check-in.
 * It counts as a touch even when the screen is not at rest yet, so that it does not go dark over
 * what just arrived; the vibration and the tone are for a screen that was at rest.
 */
export function callAttention(): void {
  const resting = activity.rest !== 'awake';
  activity.wake();
  if (!resting) return;
  if ('vibrate' in navigator) navigator.vibrate(ATTENTION_VIBRATION_MS);
  chime();
}

/** A chat line arrived: a short vibration while the screen rests, nothing else. */
export function nudge(): void {
  if (activity.rest === 'awake') return;
  if ('vibrate' in navigator) navigator.vibrate(CHAT_VIBRATION_MS);
}
