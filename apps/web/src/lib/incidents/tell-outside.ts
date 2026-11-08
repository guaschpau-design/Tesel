// Telling someone who has no Tesel where a member is (ADR-0122): 112, the organisers, a family. A
// short text with who, when, the coordinates as phones and 112 read them, in UTM as rescue teams
// and paper maps do, and a link any phone opens on a map; sent by SMS, which needs no data, by
// WhatsApp, through the phone's own share sheet, or copied.

import type { LatLon } from '@tesel/protocol';

import { formatCoordinate } from '../coordinates/coordinates.ts';
import { formatDistance, formatTime } from '../format.ts';
import type { Translate } from '../i18n/index.ts';

/** Where someone is, and since when, to be told outside the group. */
export interface Whereabouts {
  readonly at: LatLon;
  /** Metres, or null if unknown. */
  readonly accuracy: number | null;
  /** When they were there, in milliseconds since the epoch. */
  readonly time: number;
}

/** What the text starts with: whose position it is, or whose call for help. */
export type Telling =
  | { readonly kind: 'position'; readonly name: string }
  | { readonly kind: 'sos'; readonly name: string; readonly what: string; readonly text: string };

/** The text to send: who and when on the first line, then where, then a link to a map. */
export function outsideText(
  telling: Telling,
  where: Whereabouts,
  t: Translate,
  locale: string,
): string {
  const time = formatTime(where.time, locale);
  const head =
    telling.kind === 'sos'
      ? t('outsideSos', {
          name: telling.name,
          what: telling.what,
          note: telling.text && t('quotedAfter', { name: telling.text }),
          time,
        })
      : t('outsidePosition', { name: telling.name, time });
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

/** Opens the phone's messages with the text written: `?&` is what Android and iOS both read. */
export function smsLink(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

/** Opens WhatsApp with the text written, to choose whom to send it to. */
export function whatsAppLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
