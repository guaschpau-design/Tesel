// Making sure an SOS is noticed: the phone vibrates (not on the iPhone, whose browsers have no
// vibration), a tone sounds, and, while the app is not on screen, the system shows a notification
// the user can tap to come back (ui/system-notifications.ts).

import { notifyAway, type SystemNotice } from '../ui/system-notifications.ts';

/**
 * The tag of an SOS call's notification: its event's key within its group, as each member numbers
 * its events in each group on its own (ADR-0111).
 */
export function sosTag(groupId: string, eventKey: string): string {
  return `${groupId}/${eventKey}`;
}

export interface AlarmChoices {
  readonly sound: boolean;
  readonly notifications: boolean;
}

/** Two-tone beeps, three times: short enough not to annoy, hard to miss. */
const TONES_HZ = [880, 660] as const;
const BEEP_S = 0.18;
const REPEATS = 3;
const VIBRATION_MS = [300, 150, 300, 150, 300];

let audio: AudioContext | null = null;

/**
 * Browsers play sound only after the user has touched the page. Call this once at start: the
 * first touch prepares the audio, so that a later alarm can sound with no touch.
 */
export function prepareAlarmSound(): () => void {
  const prepare = () => {
    audio ??= new AudioContext();
    void audio.resume();
  };
  window.addEventListener('pointerdown', prepare, { once: true, capture: true });
  return () => {
    window.removeEventListener('pointerdown', prepare, { capture: true });
  };
}

/**
 * Raises one alarm for calls that arrived together: the phone vibrates and the tone sounds once,
 * and each call has its own notification.
 */
export function raiseAlarm(messages: readonly SystemNotice[], choices: AlarmChoices): void {
  if ('vibrate' in navigator) navigator.vibrate(VIBRATION_MS);
  if (choices.sound) soundAlarm();
  if (choices.notifications) for (const message of messages) void notifyAway(message, true);
}

/** The alarm's tone, three times over. */
function soundAlarm(): void {
  play((context) => {
    playTone(context, REPEATS * TONES_HZ.length);
  });
}

/** One short two-tone beep: something to look at, less than an SOS (power/attention.ts). */
export function chime(): void {
  play((context) => {
    playTone(context, TONES_HZ.length);
  });
}

/** Plays a sound; audio the system suspended meanwhile (the phone locked, a call) resumes first. */
function play(sound: (context: AudioContext) => void): void {
  const context = audio;
  if (context === null) return;
  if (context.state === 'running') {
    sound(context);
    return;
  }
  context
    .resume()
    .then(() => {
      if (context.state === 'running') sound(context);
    })
    .catch((error: unknown) => {
      console.warn('A sound could not play', error);
    });
}

function playTone(context: AudioContext, beeps: number): void {
  const start = context.currentTime;
  for (let index = 0; index < beeps; index++) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.value = TONES_HZ[index % TONES_HZ.length] ?? TONES_HZ[0];
    const at = start + index * BEEP_S * 1.2;
    gain.gain.setValueAtTime(0.25, at);
    gain.gain.setValueAtTime(0, at + BEEP_S);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(at);
    oscillator.stop(at + BEEP_S);
  }
}
