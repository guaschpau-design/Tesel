// The notices that stay on the map while something about this device needs the user: the radio
// reconnecting, a clock that is wrong, or a location the browser refuses or cannot find.

import type { Translate } from '../i18n/index.ts';
import { deviceLocation } from '../position/device-location.svelte.ts';
import { radio } from '../radio/radio.svelte.ts';
import { deviceClock } from '../sync/device-clock.svelte.ts';
import { useStandingNotice } from '../ui/notices.svelte.ts';

/**
 * Shows each of them while it is so, in the language `translator` gives at the time. Call it while
 * a component initialises.
 */
export function useDeviceNotices(translator: () => Translate): void {
  useStandingNotice(() => {
    if (!radio.reconnecting) return null;
    const t = translator();
    return { text: t('radioReconnecting') };
  });

  useStandingNotice(() => {
    const minutes = deviceClock.wrongByMinutes;
    if (minutes === null) return null;
    const t = translator();
    return { text: t(minutes > 0 ? 'clockAhead' : 'clockBehind', { minutes: Math.abs(minutes) }) };
  });

  useStandingNotice(() => {
    if (deviceLocation.problem === null) return null;
    const t = translator();
    return {
      text: deviceLocation.problem === 'denied' ? t('locationDenied') : t('locationUnavailable'),
    };
  });
}
