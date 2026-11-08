// The flood zones of a view (protocol §8.3, ADR-0121): the zones a 100-year flood reaches in
// Spain, drawn by the Ministry for the Ecological Transition's map service (SNCZI), asked on the
// app's behalf. Browsers cannot always read that service's pictures themselves: it sometimes
// answers with a broken cross-origin header, which they refuse. The server asks only that layer of
// that service, for a view within Spain, never anything else, and passes on only a PNG of a
// sensible size.

import { FLOOD_ZONES_PATH } from '@tesel/protocol';
import type { FastifyInstance } from 'fastify';

/** The Ministry's map service, and its layer of the 100-year flood zones. */
export const SNCZI_URL = 'https://gis.miteco.gob.es/geoserver/agua/wms';
const SNCZI_LAYER = 'Zi_laminas_q100';

/** Spain, the Balearic and the Canary Islands, in Web Mercator metres: west, south, east, north. */
const SPAIN = [-2_030_000, 3_190_000, 500_000, 5_440_000] as const;
const MAX_SIDE_PX = 2048;
/** Larger answers are not a picture of flood zones. */
const MAX_BYTES = 8 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
/** Pictures being asked of the Ministry at once; past this, clients are asked to wait. */
const MAX_IN_FLIGHT = 8;
/** The zones change with the Ministry's studies, years apart: a day is a short keep. */
const CACHE_CONTROL = 'public, max-age=86400';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface FloodZonesView {
  readonly bbox: readonly [number, number, number, number];
  readonly width: number;
  readonly height: number;
}

/** The view a request asks for, or null if it is malformed or not within Spain. */
export function floodZonesView(query: Readonly<Record<string, unknown>>): FloodZonesView | null {
  const text = (key: string) => (typeof query[key] === 'string' ? query[key] : '');
  const bbox = text('BBOX').split(',').map(Number);
  const [west = NaN, south = NaN, east = NaN, north = NaN] = bbox;
  const width = Number(text('WIDTH'));
  const height = Number(text('HEIGHT'));
  const [spainWest, spainSouth, spainEast, spainNorth] = SPAIN;
  const sides = [width, height].every(
    (side) => Number.isInteger(side) && side >= 1 && side <= MAX_SIDE_PX,
  );
  const placed =
    bbox.length === 4 &&
    [west, south, east, north].every(Number.isFinite) &&
    west < east &&
    south < north &&
    east > spainWest &&
    west < spainEast &&
    north > spainSouth &&
    south < spainNorth;
  return sides && placed ? { bbox: [west, south, east, north], width, height } : null;
}

/** Where the Ministry draws a view. */
function snczi(view: FloodZonesView): string {
  const query = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    LAYERS: SNCZI_LAYER,
    STYLES: '',
    CRS: 'EPSG:3857',
    BBOX: view.bbox.join(','),
    WIDTH: String(view.width),
    HEIGHT: String(view.height),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
  });
  return `${SNCZI_URL}?${query.toString()}`;
}

/** Serves the flood zones of a view, asking `fetchImage` (the network, in tests a stand-in). */
export function serveFloodZones(
  app: FastifyInstance,
  fetchImage: (url: string, signal: AbortSignal) => Promise<Response> = (url, signal) =>
    fetch(url, { signal, redirect: 'error' }),
): void {
  let inFlight = 0;
  app.get(`/${FLOOD_ZONES_PATH}`, async (request, reply) => {
    void reply.header('Access-Control-Allow-Origin', '*');
    const view = floodZonesView(request.query as Record<string, unknown>);
    if (view === null) return reply.code(400).type('text/plain').send('Not a view within Spain');
    if (inFlight >= MAX_IN_FLIGHT) {
      return reply.code(503).header('Retry-After', '5').type('text/plain').send('Busy');
    }
    inFlight++;
    let picture: Buffer | null;
    try {
      picture = await png(fetchImage(snczi(view), AbortSignal.timeout(TIMEOUT_MS)));
    } finally {
      inFlight--;
    }
    if (picture === null) return reply.code(502).type('text/plain').send('No picture');
    return reply.header('Cache-Control', CACHE_CONTROL).type('image/png').send(picture);
  });
}

/** The PNG an answer holds, or null for an error, another kind of document or a huge one. */
async function png(answer: Promise<Response>): Promise<Buffer | null> {
  let response: Response;
  try {
    response = await answer;
  } catch {
    return null;
  }
  if (!response.ok || response.body === null) return null;
  const length = Number(response.headers.get('Content-Length') ?? 0);
  if (length > MAX_BYTES) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    // Node's types leave the chunks untyped; fetch delivers them as bytes.
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      size += chunk.byteLength;
      if (size > MAX_BYTES) return null;
      chunks.push(chunk);
    }
  } catch {
    return null;
  }
  const bytes = Buffer.concat(chunks);
  return PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) ? bytes : null;
}
