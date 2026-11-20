// How long a way takes on foot (ADR-0156), as the signposts of Spain's footpaths reckon it: the
// time to walk its length on the flat and the time to climb and descend it are worked out apart,
// and the way takes the longer of the two and half the shorter. At a team's pace with packs: 4 km
// an hour on the flat, 400 m an hour up, 600 m an hour down.

import type { Translate } from '../i18n/index.ts';
import type { Climb } from './climb.ts';

const FLAT_M_PER_HOUR = 4000;
const UP_M_PER_HOUR = 400;
const DOWN_M_PER_HOUR = 600;

/** Minutes on foot along a way `metres` long that climbs and descends as `climb` says. */
export function walkingMinutes(metres: number, climb: Pick<Climb, 'up' | 'down'>): number {
  const flat = metres / FLAT_M_PER_HOUR;
  const steep = climb.up / UP_M_PER_HOUR + climb.down / DOWN_M_PER_HOUR;
  return 60 * (Math.max(flat, steep) + Math.min(flat, steep) / 2);
}

/** Minutes as they are told: to 5 minutes, as no walk keeps closer time; at least 5. */
export function roundedMinutes(minutes: number): number {
  return Math.max(5, Math.round(minutes / 5) * 5);
}

/** Rounded minutes told as "about 2 h 05" or "about 40 min". */
export function walkDuration(t: Translate, minutes: number): string {
  const rounded = roundedMinutes(minutes);
  if (rounded < 60) return t('durationMinutes', { minutes: rounded });
  return t('durationHours', {
    hours: Math.floor(rounded / 60),
    minutes: String(rounded % 60).padStart(2, '0'),
  });
}
