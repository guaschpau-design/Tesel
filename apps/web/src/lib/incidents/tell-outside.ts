// Telling someone without Tesel of an SOS (ADR-0122, ADR-0127): the organisers, a family. A short
// text with whose call it is and when, the coordinates as phones read them, in UTM as rescue teams
// and paper maps do, and a link any phone opens on a map; sent from the phone's own share menu
// (WhatsApp, SMS…), or copied where there is none. To 112 one calls instead: the call itself sends
// the phone's position.

import type { LatLon } from '@tesel/protocol';

import { formatCoordinate } from '../coordinates/coordinates.ts';
import { formatDistance, formatTime } from '../format.ts';
import type { Translate } from '../i18n/index.ts';

/** Where the caller is, and since when. */
export interface Whereabouts {
  readonly at: LatLon;
  /** Metres, or null if unknown. */
  readonly accuracy: number | null;
}

/** The call: whose, what kind, what they wrote, and when, in milliseconds since the epoch. */
export interface Call {
  readonly name: string;
  readonly what: string;
  readonly text: string;
  readonly time: number;
}

/** The text to send: whose call and when on the first line, then where, then a link to a map. */
export function outsideText(
  call: Call,
  where: Whereabouts | null,
  t: Translate,
  locale: string,
): string {
  const head = t('outsideSos', {
    name: call.name,
    what: call.what,
    note: call.text && t('quotedAfter', { name: call.text }),
    time: formatTime(call.time, locale),
  });
  if (where === null) return [head, t('outsideNoPlace')].join('\n');
  const decimal = formatCoordinate(where.at, 'decimal') ?? '';
  const accuracy = where.accuracy === null ? '' : ` (±${formatDistance(where.accuracy, locale)})`;
  const utm = formatCoordinate(where.at, 'utm');
  return [
    head,
    `${decimal}${accuracy}`,
    ...(utm === null ? [] : [`UTM ${utm}`]),
    mapLink(where.at),
  ].join('\n');
}

/** A link that opens the point on a map in any phone, with or without an app. */
export function mapLink({ lat, lon }: LatLon): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`;
}

/**
 * Sends the text from the phone's share menu, where the user picks WhatsApp, SMS or any other;
 * where there is none (a computer), or it fails to open, copies it, and says so: 'copied'.
 */
export async function sendOutside(text: string): Promise<'shared' | 'copied'> {
  // Not in every browser, whatever the types say: none on a computer with Linux.
  const phone: Partial<Pick<Navigator, 'share'>> & Pick<Navigator, 'clipboard'> = navigator;
  if (phone.share) {
    try {
      await phone.share({ text });
      return 'shared';
    } catch (error) {
      // The user closed the menu: nothing more to do.
      if (error instanceof Error && error.name === 'AbortError') return 'shared';
    }
  }
  await phone.clipboard.writeText(text);
  return 'copied';
}
