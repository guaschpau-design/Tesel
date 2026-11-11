import { flushSync } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { translator } from '../i18n/index.ts';
import { keepRunningWhile } from './keep-running.svelte.ts';

/** Lets the calls in flight end. */
const settle = () => new Promise((done) => setTimeout(done, 0));

describe('keeping the Android app running when Android refuses it at first', () => {
  const t = translator('es');

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('asks again once the app is back on screen, and only until Android agrees', async () => {
    const page = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    vi.stubGlobal('document', page);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // Android refuses to start it while the app is not on screen.
    let refuse = true;
    const asked: boolean[] = [];
    const device = {
      keepRunning: (options: { on: boolean }) => {
        asked.push(options.on);
        return refuse ? Promise.reject(new Error('refused')) : Promise.resolve();
      },
    };
    keepRunningWhile(
      device,
      () => ({ located: true, linked: false }),
      () => t,
    );
    flushSync();
    await settle();
    expect(asked).toEqual([true]);

    refuse = false;
    page.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(asked).toEqual([true, true]);
    page.dispatchEvent(new Event('visibilitychange'));
    expect(asked).toEqual([true, true]);
  });
});
