import { describe, expect, it } from 'vitest';

import type { TileArchive } from '../map/tiles/sources.ts';
import type { TileArchives } from '../map/tiles/protocol.ts';
import type { OfflineArea } from '../map/tiles/store-schema.ts';
import { TERRAIN_MAX_ZOOM } from '../map/tiles/sources.ts';
import { areaContents, areaLayers, downloadLayers } from './offline-maps.ts';

const archive: TileArchive = { getTile: () => Promise.resolve(undefined) };
const archives: TileArchives = {
  basemap: {
    ...archive,
    bounds: () => Promise.resolve({ west: -10, south: 36, east: 4, north: 44 }),
  },
  'ign-names': archive,
  ortho: archive,
  terrain: archive,
};

describe('offline maps', () => {
  it('downloads the topographic map, and each extra from its sources, to the zoom it needs', () => {
    const layers = downloadLayers(archives, 14, ['aerial']);
    expect(layers.map(({ source, maxZoom }) => [source, maxZoom])).toEqual([
      ['basemap', 14],
      ['ign-names', 14],
      ['terrain', TERRAIN_MAX_ZOOM],
      ['ortho', 17],
    ]);
  });

  it('asks the public services for fewer tiles at a time than our own map', () => {
    const layers = downloadLayers(archives, 14, ['aerial']);
    const [own, ...others] = layers;
    expect(own?.source).toBe('basemap');
    for (const layer of others) expect(layer.concurrency).toBeLessThan(own?.concurrency ?? 0);
  });

  it('names what an area holds once, whatever the sources behind it', () => {
    const area: OfflineArea = {
      id: 'a',
      name: 'a',
      bounds: { west: 0, south: 0, east: 1, north: 1 },
      minZoom: 0,
      layers: downloadLayers(archives, 14, ['aerial']).map(({ source, maxZoom }) => ({
        source,
        maxZoom,
      })),
      storedTiles: 0,
      bytes: 0,
      createdAt: 0,
      complete: true,
    };
    expect(areaContents(area)).toEqual(['baseMapTopo', 'baseMapAerial']);
  });

  it('resumes an area with the sources, zooms and pace it was downloaded with', () => {
    const layers = downloadLayers(archives, 14, ['aerial']);
    const area: OfflineArea = {
      id: 'a',
      name: 'a',
      bounds: { west: 0, south: 0, east: 1, north: 1 },
      minZoom: 0,
      layers: layers.map(({ source, maxZoom }) => ({ source, maxZoom })),
      storedTiles: 0,
      bytes: 0,
      createdAt: 0,
      complete: false,
    };
    expect(areaLayers(archives, area)).toEqual(layers);
  });
});
