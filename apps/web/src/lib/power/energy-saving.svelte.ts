// Saving energy while the app is open (ADR-0097): a minute untouched and the screen goes dark
// (RestScreen.svelte), ten and the GPS runs once a minute. Nothing rests while something needs the
// screen (drawing, a tool, an own SOS), and the GPS stays on while guiding or calling for help.
// Call it while the map's workspace initialises.

import { navigation } from '../navigation/navigation.svelte.ts';
import { deviceLocation } from '../position/device-location.svelte.ts';
import { activity } from './activity.svelte.ts';

/** Every how long the GPS takes a fix at deep rest. */
const GPS_EVERY_MS = 60_000;

export interface EnergySaving {
  /** The user turned saving energy on (Settings). */
  readonly enabled: () => boolean;
  /** Something on screen needs it: drawing, a tool in use, the SOS dialog. */
  readonly busy: () => boolean;
  /** This device's own SOS is open. */
  readonly calling: () => boolean;
}

export function useEnergySaving({ enabled, busy, calling }: EnergySaving): void {
  // Restarted only when the switch changes: what holds rest off is read at each look, untracked.
  $effect(() => {
    if (!enabled()) return;
    return activity.follow(() => busy() || calling());
  });

  $effect(() => {
    const deep = enabled() && activity.rest === 'deep';
    deviceLocation.pace(deep && !calling() && navigation.target === null ? GPS_EVERY_MS : null);
  });

  $effect(() => () => {
    deviceLocation.pace(null);
  });
}
