// Text messages of other apps on the radio network that the radio heard (see RadioText). Kept on
// the device so they are not lost while Tesel holds the radio.

import type { RadioText } from '@tesel/radio';

export interface StoredRadioText extends RadioText {
  /** When this device received it, in milliseconds since the epoch. */
  readonly receivedAt: number;
}

/** Only the newest messages are kept. */
export const MAX_RADIO_TEXTS = 500;
