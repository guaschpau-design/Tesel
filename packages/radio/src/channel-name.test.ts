import { describe, expect, it } from 'vitest';

import { channelName } from './channel-name.ts';

describe('channel names', () => {
  it('cuts long group names to what the radio stores without splitting a character', () => {
    expect(channelName('Protección Civil de la Comunitat Valenciana', 31)).toBe(
      'Protección Civil de la Comunit',
    );
    expect(new TextEncoder().encode(channelName('ñ'.repeat(20), 31)).length).toBe(30);
    expect(channelName('Protección Civil', 11)).toBe('Protección');
  });
});
