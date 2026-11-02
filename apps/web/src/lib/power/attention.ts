// What brings the user back while the screen rests (ADR-0097): something they must see now wakes
// the screen with a vibration and a tone; a chat line only vibrates, so that a busy chat does not
// keep the screen lit.

import { chime } from '../incidents/alarm.ts';
import { activity } from './activity.svelte.ts';

const ATTENTION_VIBRATION_MS = [250, 120, 250];
const CHAT_VIBRATION_MS = 150;

/** Wakes the screen for something important: an SOS, a task handed over, a danger, a check-in. */
export function callAttention(): void {
  if (activity.rest === 'awake') return;
  activity.wake();
  if ('vibrate' in navigator) navigator.vibrate(ATTENTION_VIBRATION_MS);
  chime();
}

/** A chat line arrived: a short vibration while the screen rests, nothing else. */
export function nudge(): void {
  if (activity.rest === 'awake') return;
  if ('vibrate' in navigator) navigator.vibrate(CHAT_VIBRATION_MS);
}
