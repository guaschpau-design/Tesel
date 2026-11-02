import { RadioError } from '@tesel/radio';
import { describe, expect, it } from 'vitest';

import { problemMessage, problemOf } from './radio-problem.ts';

describe('radio problems', () => {
  it('tells a missing pairing, silence and a full radio apart from any other failure', () => {
    expect(problemOf(new RadioError('not-paired', 'no PIN'))).toBe('not-paired');
    expect(problemOf(new RadioError('timeout', 'silent'))).toBe('no-answer');
    expect(problemOf(new RadioError('no-free-channel', 'full'))).toBe('no-free-channel');
    expect(problemOf(new Error('anything else'))).toBe('failed');
  });

  it('sends the user to the app of the radio’s own kind', () => {
    expect(problemMessage('no-free-channel', 'meshcore')).toBe('radioNoFreeChannel');
    expect(problemMessage('no-free-channel', 'meshtastic')).toBe('radioNoFreeChannelMeshtastic');
    expect(problemMessage('no-answer', 'meshtastic')).toBe('radioNoAnswerMeshtastic');
    expect(problemMessage('not-paired', 'meshtastic')).toBe('radioNotPaired');
  });
});
