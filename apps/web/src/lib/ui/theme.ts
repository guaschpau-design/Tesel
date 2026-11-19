// The map draws with MapLibre, which cannot read CSS. It asks here for the colours app.css defines,
// so that they stay defined in one place.

import type { ExpressionSpecification } from 'maplibre-gl';

/** Light or dark: the app's look (ui/appearance.svelte.ts). */
export type Look = 'light' | 'dark';

/**
 * The map's look, apart from the app's: its base map's (map/style/style.ts, ADR-0120): light, the
 * tactical map's coyote (ADR-0144), or the night map's red on black (ADR-0141).
 */
export type MapTheme = 'light' | 'coyote' | 'night';

/**
 * Sets the map's look on the page as `data-map-theme`, which app.css reads for the colours of
 * what is drawn on the map; `themeColor` then reads them for this look.
 */
export function lookOfMap(theme: MapTheme): void {
  document.documentElement.dataset['mapTheme'] = theme;
}

/** Families of colour for map symbols and shapes, each a `--tone-*` variable in app.css. */
export const TONES = ['slate', 'red', 'orange', 'amber', 'blue', 'green', 'teal', 'ink'] as const;
export type Tone = (typeof TONES)[number];

/** The current value of a colour variable of app.css, e.g. `themeColor('danger')`. */
export function themeColor(name: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  if (value === '') throw new Error(`app.css defines no --${name}`);
  return value;
}

export function toneColor(tone: Tone): string {
  return themeColor(`tone-${tone}`);
}

/** A map expression that colours a feature by its `tone` property; `fallback` without one. */
export function toneExpression(fallback = toneColor('slate')): ExpressionSpecification {
  const [first, ...rest] = TONES;
  const others = rest.flatMap((tone) => [tone, toneColor(tone)]);
  return ['match', ['get', 'tone'], first, toneColor(first), ...others, fallback];
}
