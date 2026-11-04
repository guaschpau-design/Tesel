// Light or dark (ADR-0114): the look chosen in Settings, or this device's own until one is chosen.
// The look in use is written on the root element as `data-theme`, which app.css reads; the map
// follows it with a style of its own for each, the street map turning into the tactical map.

import type { MapTheme } from './theme.ts';

/** What can be chosen: this device's look (the starting point), light or dark. */
export const THEME_CHOICES = ['auto', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

/** The look in use for a choice, given whether this device is in dark mode. */
export function resolveTheme(choice: ThemeChoice, deviceDark: boolean): MapTheme {
  if (choice === 'auto') return deviceDark ? 'dark' : 'light';
  return choice;
}

class Appearance {
  #deviceDark = $state(false);
  /** Where the choice is read; this device's look until `follow` says. */
  #choice: () => ThemeChoice = $state.raw(() => 'auto');

  #theme: MapTheme = $derived(resolveTheme(this.#choice(), this.#deviceDark));
  #following = false;

  /**
   * The look in use. Reading it first brings the page's colours up to date, so that whatever reads
   * app.css's colours for this look, such as the map's style (ui/theme.ts), gets this look's.
   */
  get theme(): MapTheme {
    if (this.#following) this.#write();
    return this.#theme;
  }

  /** Writes the look in use on the page, for app.css. */
  #write(): void {
    document.documentElement.dataset['theme'] = this.#theme;
  }

  /**
   * Follows this device's look and the choice `choice` reads, writing the look in use on the page,
   * until the returned function is called.
   */
  follow(choice: () => ThemeChoice): () => void {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => {
      this.#deviceDark = event.matches;
    };
    this.#deviceDark = query.matches;
    this.#choice = choice;
    query.addEventListener('change', onChange);
    this.#following = true;
    // Written at once and on every change, even when nothing else reads it.
    this.#write();
    const stop = $effect.root(() => {
      $effect(() => {
        this.#write();
      });
    });
    return () => {
      query.removeEventListener('change', onChange);
      stop();
      this.#following = false;
    };
  }
}

/** The app's look, which the page, the map and the settings share. */
export const appearance = new Appearance();
