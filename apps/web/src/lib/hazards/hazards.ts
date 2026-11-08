// Hazards over the map, from public services, as pictures of the view (map/wms/view-picture.ts,
// ADR-0120); only online.
//
// Fires: what NASA's VIIRS sensors, on three satellites, detect burning, each spot a 375 m
// pixel, through NASA's GIBS with no key. GIBS keeps a day's detections under that day (UTC),
// so the map shows yesterday's and today's: the last 24 to 48 hours. GIBS draws its fire layers
// only from its EPSG:4326 service, which answers Web Mercator requests too, as GIBS documents.
//
// Flood zones: where a flood with a return period of 100 years reaches, Spain's official reference
// for flood risk, from the Ministry's SNCZI. Browsers cannot always read that service's pictures
// themselves, so the server that serves the app asks it for them (protocol §8.3, ADR-0121). The
// Basque Country and Navarre publish their own, not in it.

import { floodZonesUrl } from '@tesel/protocol';

import type { Bounds } from '../map/tiles/math.ts';
import type { ViewService } from '../map/wms/view-picture.ts';

/** Fires show from afar: a view of a whole region tells where something burns. */
export const FIRES_MIN_ZOOM = 5;
/** Flood zones follow rivers: from a province's view they can be told apart. */
export const FLOODS_MIN_ZOOM = 8;

const EARTH: Bounds = { west: -180, south: -85, east: 180, north: 85 };
/** The peninsula, the Balearic and the Canary Islands. */
const SPAIN: Bounds = { west: -18.2, south: 27.6, east: 4.4, north: 43.8 };

const DAY_MS = 24 * 60 * 60 * 1000;

/** A day in UTC as GIBS names it, `days` before today. */
export function gibsDay(daysAgo: number, now: number = Date.now()): string {
  return new Date(now - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

/** GIBS's layers of VIIRS fire detections, one a satellite. */
const SATELLITES = ['NOAA21', 'NOAA20', 'SNPP'] as const;

/**
 * One satellite's detections of one day: asked for apart, so that a satellite with no data for
 * the day spoils no other's picture.
 */
function fireService(satellite: (typeof SATELLITES)[number], daysAgo: number): ViewService {
  return {
    id: `${satellite.toLowerCase()}-${String(daysAgo)}`,
    bounds: EARTH,
    url: 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi',
    version: '1.1.1',
    layers: `VIIRS_${satellite}_Thermal_Anomalies_375m_All`,
    style: '',
    extra: () => ({ TIME: gibsDay(daysAgo) }),
    credit:
      '<a href="https://www.earthdata.nasa.gov/data/tools/gibs" target="_blank">' +
      'NASA EOSDIS GIBS</a> · VIIRS',
  };
}

export const FIRES: readonly ViewService[] = [1, 0].flatMap((daysAgo) =>
  SATELLITES.map((satellite) => fireService(satellite, daysAgo)),
);

export const FIRES_CREDITS = [...new Set(FIRES.map((service) => service.credit))];

const FLOODS_CREDIT =
  '<a href="https://www.miteco.gob.es/es/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html" ' +
  'target="_blank">© Ministerio para la Transición Ecológica y el Reto Demográfico</a> · SNCZI';

/** The flood zones, through `server` (the app's own, config.ts); none without one. */
export function floodServices(server: string | null): ViewService[] {
  if (server === null) return [];
  return [
    {
      id: 'spain-100',
      bounds: SPAIN,
      url: floodZonesUrl(server),
      version: '1.3.0',
      layers: 'Zi_laminas_q100',
      style: '',
      credit: FLOODS_CREDIT,
    },
  ];
}

export const FLOODS_CREDITS = [FLOODS_CREDIT];
