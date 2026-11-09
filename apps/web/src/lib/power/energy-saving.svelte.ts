// Saving energy while the app is open (ADR-0097, ADR-0127): pocket mode (PocketScreen.svelte) when
// the user asks, or by itself after a minute untouched if they let it; ten minutes untouched and
// the GPS runs once a minute. Nothing goes into pocket mode by itself while something needs the
// screen (drawing, a tool, an own SOS), and the GPS stays on while guiding or calling for help.
// Call it while the map's workspace initialises.

import { navigation } from '../navigation/navigation.svelte.ts';
import { deviceLocation } from '../position/device-location.svelte.ts';
import { activity } from './activity.svelte.ts';

/** Every how long the GPS takes a fix at deep rest. */
const GPS_EVERY_MS = 60_000;

export interface EnergySaving {
  /** The user lets pocket mode come by itself (Settings). */
  readonly automatic: () => boolean;
  /** Something on screen needs it: drawing, a tool in use, the SOS dialog. */
  readonly busy: () => boolean;
  /** This device's own SOS is open. */
  readonly calling: () => boolean;
}

export function useEnergySaving({ automatic, busy, calling }: EnergySaving): void {
  // Started once: the switch and what holds rest off are read at each look, untracked.
  $effect(() =>
    activity.follow(
      () => busy() || calling(),
      () => automatic(),
    ),
  );

  $effect(() => {
    const deep = activity.rest === 'deep';
    deviceLocation.pace(deep && !calling() && navigation.target === null ? GPS_EVERY_MS : null);
  });

  $effect(() => () => {
    deviceLocation.pace(null);
  });
}
