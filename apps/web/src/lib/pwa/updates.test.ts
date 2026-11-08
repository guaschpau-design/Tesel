import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHECK_EVERY_MS, checkForUpdates } from './updates.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', '..');
const DYNAMIC_IMPORT = /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g;

/** What `import()` loads in a file: a package, or a module by its path. */
function dynamicImports(path: string): string[] {
  const text = readFileSync(path, 'utf8');
  return [...text.matchAll(DYNAMIC_IMPORT)].map(([, spec = '']) =>
    spec.startsWith('.') ? normalize(join(dirname(path), spec)) : spec,
  );
}

/** A page that is shown or hidden as the test says. */
class TestPage extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';

  show(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    this.dispatchEvent(new Event('visibilitychange'));
  }
}

describe('checking for a new version', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('asks every hour and whenever the app is shown again, until stopped', () => {
    const update = vi.fn(() => Promise.resolve());
    const page = new TestPage();
    const stop = checkForUpdates({ update }, page);
    vi.advanceTimersByTime(CHECK_EVERY_MS);
    expect(update).toHaveBeenCalledTimes(1);
    page.show('hidden');
    expect(update).toHaveBeenCalledTimes(1);
    page.show('visible');
    expect(update).toHaveBeenCalledTimes(2);
    stop();
    page.show('visible');
    vi.advanceTimersByTime(CHECK_EVERY_MS);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('goes on asking after a check that fails offline', async () => {
    const update = vi.fn(() => Promise.reject(new TypeError('offline')));
    const stop = checkForUpdates({ update }, new TestPage());
    vi.advanceTimersByTime(2 * CHECK_EVERY_MS);
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(2);
    stop();
  });
});

describe('the parts of the app loaded on first use', () => {
  it('are all loaded ahead by a window that waits for a new version', () => {
    const own = join(HERE, 'updates.ts');
    const elsewhere = new Set<string>();
    for (const entry of readdirSync(SOURCE, { recursive: true, withFileTypes: true })) {
      const name = entry.name;
      if (!entry.isFile() || !/\.(ts|svelte)$/.test(name) || name.includes('.test.')) continue;
      const path = join(entry.parentPath, name);
      // The Android app's native layer, which the web build leaves out and which has no updates
      // of its own to wait for (lib/native/install.ts).
      if (path === own || path === join(SOURCE, 'lib', 'native', 'install.ts')) continue;
      for (const spec of dynamicImports(path)) elsewhere.add(spec);
    }
    expect(elsewhere.size).toBeGreaterThan(0);
    expect(new Set(dynamicImports(own))).toEqual(elsewhere);
  });
});
