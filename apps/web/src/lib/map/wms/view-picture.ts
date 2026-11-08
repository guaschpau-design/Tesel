// Public map services that draw a picture of the view on request (WMS): the cadastres, fire
// detections, flood zones (ADR-0036, ADR-0120). Their terms, or what they show, rule out tiles and
// downloads, so the map asks each service whose area is in view for one picture of the view once
// it settles, and only online (ViewPictureLayer.svelte).

import { toWebMercator } from '../geometry.ts';
import type { MapImage } from '../overlay.svelte.ts';
import type { Bounds } from '../tiles/math.ts';

/** The services' largest picture: most draw at most 2048 pixels a side. */
const MAX_SIDE_PX = 2048;

export interface ViewService {
  /** Unique among the services, for the map's source. */
  readonly id: string;
  /** Where the service has something to show; outside, its pictures are transparent. */
  readonly bounds: Bounds;
  readonly url: string;
  readonly version: '1.1.1' | '1.3.0';
  /** One layer, or several drawn together, comma-separated. */
  readonly layers: string;
  readonly style: string;
  /** More of the request, worked out as it is made, such as the day of the data (`TIME`). */
  readonly extra?: () => Readonly<Record<string, string>>;
  /** The credit the service asks for, as HTML (map/style/style-credits.svelte.ts). */
  readonly credit: string;
}

/** The services whose area is in a view. */
export function servicesIn(services: readonly ViewService[], view: Bounds): ViewService[] {
  return services.filter(
    ({ bounds }) =>
      bounds.west < view.east &&
      bounds.east > view.west &&
      bounds.south < view.north &&
      bounds.north > view.south,
  );
}

/** A service's picture of a view `width` × `height` pixels: where to ask, where it goes. */
export function viewPicture(
  service: ViewService,
  view: Bounds,
  width: number,
  height: number,
): MapImage {
  const scale = Math.min(1, MAX_SIDE_PX / Math.max(width, height));
  const [west, south] = toWebMercator({ lat: view.south, lon: view.west });
  const [east, north] = toWebMercator({ lat: view.north, lon: view.east });
  const query = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: service.version,
    REQUEST: 'GetMap',
    LAYERS: service.layers,
    STYLES: service.style,
    // WMS 1.3.0 renamed the parameter; in Web Mercator the axes keep their order.
    [service.version === '1.3.0' ? 'CRS' : 'SRS']: 'EPSG:3857',
    BBOX: [west, south, east, north].join(','),
    WIDTH: String(Math.round(width * scale)),
    HEIGHT: String(Math.round(height * scale)),
    FORMAT: 'image/png',
    TRANSPARENT: 'TRUE',
    ...service.extra?.(),
  });
  return {
    url: `${service.url}?${query.toString()}`,
    coordinates: [
      [view.west, view.north],
      [view.east, view.north],
      [view.east, view.south],
      [view.west, view.south],
    ],
  };
}
