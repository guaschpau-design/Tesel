import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { appearance, resolveTheme, type ThemeChoice } from './appearance.svelte.ts';

describe('resolveTheme', () => {
  it('follows this device until light or dark is chosen', () => {
    expect(resolveTheme('auto', false)).toBe('light');
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('light', true)).toBe('light');
  });
});

describe('appearance', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes the look in use on the page, and follows the choice and the device', () => {
    const listeners: ((event: { matches: boolean }) => void)[] = [];
    const root = { dataset: {} as Record<string, string> };
    vi.stubGlobal('document', { documentElement: root });
    vi.stubGlobal('window', {
      matchMedia: () => ({
        matches: false,
        addEventListener: (_: string, listener: (event: { matches: boolean }) => void) =>
          listeners.push(listener),
        removeEventListener: () => undefined,
      }),
    });
    let choice: ThemeChoice = $state('auto');
    const stop = appearance.follow(() => choice);
    expect(root.dataset['theme']).toBe('light');

    // The phone turns dark: so does the app, while nothing is chosen.
    for (const listener of listeners) listener({ matches: true });
    flushSync();
    expect(root.dataset['theme']).toBe('dark');

    // Light chosen in Settings: the phone's look no longer counts.
    choice = 'light';
    flushSync();
    expect(appearance.theme).toBe('light');
    expect(root.dataset['theme']).toBe('light');
    stop();
  });
});
