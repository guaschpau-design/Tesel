// Addresses of Spain found by CartoCiudad, the official geocoder of IGN and the cadastre (ADR-0139):
// "Calle Mayor 23, Reus" to the door it names. Free, with no key, and open to any web page; it
// needs the network, which coordinates do not.

import type { LatLon } from '@tesel/protocol';

const SEARCH_URL = 'https://www.cartociudad.es/geocoder/api/geocoder/candidates';
/** Few enough to read and pick from on a phone. */
const MAX_FOUND = 5;

export interface FoundAddress {
  /** As CartoCiudad writes it: "CALLE LLOVERA 10, Reus". */
  readonly name: string;
  readonly at: LatLon;
}

/** Whether a text may be an address rather than coordinates: it has a word in it. */
export function looksLikeAddress(text: string): boolean {
  return /\p{L}{3,}/u.test(text);
}

/** The addresses CartoCiudad finds for `text`, best first; rejects when it cannot be asked. */
export async function searchAddresses(text: string, signal?: AbortSignal): Promise<FoundAddress[]> {
  const url = `${SEARCH_URL}?q=${encodeURIComponent(text.trim())}&limit=${String(MAX_FOUND)}`;
  const response = await fetch(url, { signal: signal ?? null });
  if (!response.ok) throw new Error(`CartoCiudad answered ${String(response.status)}`);
  return foundIn(await response.json());
}

/** The addresses in CartoCiudad's answer, leaving out what is not one or has no place. */
export function foundIn(answer: unknown): FoundAddress[] {
  if (!Array.isArray(answer)) return [];
  return answer
    .flatMap((candidate: unknown) => {
      if (typeof candidate !== 'object' || candidate === null) return [];
      const { address, lat, lng } = candidate as Record<string, unknown>;
      if (typeof address !== 'string' || typeof lat !== 'number' || typeof lng !== 'number') {
        return [];
      }
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return [];
      return [{ name: address, at: { lat, lon: lng } }];
    })
    .slice(0, MAX_FOUND);
}
