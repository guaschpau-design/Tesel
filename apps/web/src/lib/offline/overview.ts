// The overview of the base map: its lowest zooms over all it covers, kept on the device as soon as
// it can be had, so that offline, with no area downloaded, the map still shows land, borders and
// the big places (ADR-0056). Its tiles belong to the overview, not to an area: deleting areas
// leaves them, and they are not listed among the areas.

import { countTiles, type Bounds } from '../map/tiles/math.ts';
import { downloadTiles } from '../map/tiles/area-download.ts';
import type { TileArchives } from '../map/tiles/protocol.ts';
import type { TileStore } from '../map/tiles/store.ts';
import { roomForMaps } from '../storage/storage-space.svelte.ts';
import { bytesStillNeeded, downloadLayers } from './offline-maps.ts';

/** The owner of the overview's tiles in the tile store. */
const OVERVIEW = 'overview';

/** The deepest zoom of the overview: countries, regions, the cities and the roads between them. */
const OVERVIEW_MAX_ZOOM = 6;

/**
 * Most tiles the overview takes. The map our servers publish, of Spain and Portugal, needs 42 to
 * zoom 6, some 12 MB; a map of the whole world would need 5,461 and hundreds of megabytes, and gets
 * fewer zooms instead.
 */
const OVERVIEW_MAX_TILES = 100;

/** The deepest zoom up to 6 at which the overview of `bounds` stays within its tiles. */
export function overviewZoom(bounds: Bounds): number {
  for (let zoom = OVERVIEW_MAX_ZOOM; zoom > 0; zoom--) {
    if (countTiles(bounds, 0, zoom) <= OVERVIEW_MAX_TILES) return zoom;
  }
  return 0;
}

/**
 * Downloads what the overview is still missing, if there is room for it besides the group's log.
 * Without a connection it gives up quietly, and the next start of the app tries again. Never
 * rejects.
 */
export async function keepOverview(store: TileStore, archives: TileArchives): Promise<void> {
  try {
    const bounds = await archives.basemap.bounds();
    const layers = downloadLayers(archives, overviewZoom(bounds), []);
    const room = await roomForMaps();
    if (room !== null && room < (await bytesStillNeeded(store, bounds, layers))) return;
    await downloadTiles(store, {
      owner: OVERVIEW,
      bounds,
      layers,
      signal: new AbortController().signal,
    });
  } catch (error) {
    console.warn('The overview of the map could not be stored now', error);
  }
}
