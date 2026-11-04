// The brand's colours are written in three places that cannot import each other: the logo's
// generator reads brand/colors.json, the app's tokens are CSS (app.css) and so are the site's
// (no build step, ADR-0017). This keeps the three in step, every family of map colour defined, and
// the pairs of the app's colours that must be read or found as far apart as WCAG 2.1 AA asks.

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { TONES } from './theme.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const BRAND = JSON.parse(read('../../../../../brand/colors.json')) as Record<string, string>;
const APP_CSS = read('../../app.css');
const SITE_CSS = read('../../../../site/styles.css');

/** The value a stylesheet gives a custom property in its first (light) definition. */
function token(css: string, name: string): string | undefined {
  return new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1]?.trim().toLowerCase();
}

/** The custom properties a block of CSS defines, by name. */
function definitions(block: string): Map<string, string> {
  return new Map(
    [...block.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(([, name = '', value = '']) => [
      name,
      value.trim().toLowerCase(),
    ]),
  );
}

/** The app's colours in a theme: the light ones, with the dark theme's changes over them. */
function theme(dark: boolean): (name: string) => string {
  const light = definitions(/^:root \{([^}]*)\}/m.exec(APP_CSS)?.[1] ?? '');
  const darkBlock = /:root\[data-theme='dark'\] \{([^}]*)\}/.exec(APP_CSS)?.[1];
  const tokens = new Map([...light, ...(dark ? definitions(darkBlock ?? '') : [])]);
  const resolve = (name: string): string => {
    const value = tokens.get(name);
    if (value === undefined) throw new Error(`app.css defines no --${name}`);
    const reference = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
    return reference === undefined ? value : resolve(reference);
  };
  return resolve;
}

/** WCAG 2.1 contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r = 0, g = 0, b = 0] = [1, 3, 5].map((at) => {
      const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** Text must stand 4.5:1 from what it is on; the edges of controls and focus rings 3:1. */
const TEXT = 4.5;
const GRAPHIC = 3;

const PAIRS: readonly (readonly [string, string, number])[] = [
  ['fg', 'surface', TEXT],
  ['muted', 'surface', TEXT],
  ['muted', 'bg', TEXT],
  ['danger', 'surface', TEXT],
  ['danger', 'bg', TEXT],
  ['on-danger', 'danger-fill', TEXT],
  ['link', 'surface', TEXT],
  ['link', 'bg', TEXT],
  ['chrome-fg', 'chrome-bg', TEXT],
  ['chrome-muted', 'chrome-bg', TEXT],
  ['on-accent', 'accent', TEXT],
  ['focus', 'surface', GRAPHIC],
  ['focus', 'bg', GRAPHIC],
  // The chrome's ring is lime (.chrome in app.css).
  ['signal', 'chrome-bg', GRAPHIC],
  ['control-line', 'surface', GRAPHIC],
  ['control-line', 'bg', GRAPHIC],
];

describe('palette', () => {
  it('gives the app the brand colours of brand/colors.json', () => {
    expect(token(APP_CSS, 'ink')).toBe(BRAND['ink']);
    expect(token(APP_CSS, 'pale')).toBe(BRAND['pale']);
    expect(token(APP_CSS, 'signal')).toBe(BRAND['signal']);
    expect(token(APP_CSS, 'signal-deep')).toBe(BRAND['signalDeep']);
  });

  it('gives the site the same brand colours', () => {
    expect(token(SITE_CSS, 'ink')).toBe(BRAND['ink']);
    expect(token(SITE_CSS, 'ink-text')).toBe(BRAND['pale']);
    expect(token(SITE_CSS, 'signal')).toBe(BRAND['signal']);
    expect(token(SITE_CSS, 'signal-deep')).toBe(BRAND['signalDeep']);
  });

  it('defines a colour for every family the map uses', () => {
    for (const tone of TONES) expect(token(APP_CSS, `tone-${tone}`)).toBeDefined();
  });

  it.each([false, true])('keeps text, control edges and focus apart enough (dark: %s)', (dark) => {
    const colour = theme(dark);
    for (const [front, back, least] of PAIRS) {
      const ratio = contrast(colour(front), colour(back));
      expect(ratio, `--${front} on --${back}: ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(least);
    }
  });
});
