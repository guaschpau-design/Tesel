// What went wrong with the radio, in words the user can act on (ADR-0090). Some depend on the kind
// of radio: each kind's own app is where its channels are freed, and its firmware is checked.

import { RadioError, type RadioFamily } from '@tesel/radio';

import type { MessageKey } from '../i18n/index.ts';

export type RadioProblem =
  'unsupported' | 'no-free-channel' | 'no-answer' | 'not-paired' | 'other-window' | 'failed';

export function problemOf(error: unknown): RadioProblem {
  if (error instanceof RadioError) {
    if (error.code === 'no-free-channel') return 'no-free-channel';
    if (error.code === 'timeout') return 'no-answer';
    if (error.code === 'not-paired') return 'not-paired';
  }
  return 'failed';
}

/** The message that explains `problem` with a radio of `family`. */
export function problemMessage(problem: RadioProblem, family: RadioFamily | null): MessageKey {
  const meshtastic = family === 'meshtastic';
  switch (problem) {
    case 'unsupported':
      return 'radioUnsupported';
    case 'no-free-channel':
      return meshtastic ? 'radioNoFreeChannelMeshtastic' : 'radioNoFreeChannel';
    case 'no-answer':
      return meshtastic ? 'radioNoAnswerMeshtastic' : 'radioNoAnswer';
    case 'not-paired':
      return 'radioNotPaired';
    case 'other-window':
      return 'radioOtherWindow';
    case 'failed':
      return 'radioFailed';
  }
}
