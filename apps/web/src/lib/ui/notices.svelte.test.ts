import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';

import { notices, useStandingNotice } from './notices.svelte.ts';

describe('standing notices', () => {
  it('shows a notice while its condition holds, without running itself in a loop', () => {
    let reconnecting = $state(true);
    const stop = $effect.root(() => {
      useStandingNotice(() => (reconnecting ? { text: 'Volviendo a conectar…' } : null));
    });
    flushSync();
    expect(notices.list.map((notice) => notice.text)).toEqual(['Volviendo a conectar…']);
    reconnecting = false;
    flushSync();
    expect(notices.list).toEqual([]);
    stop();
  });
});
