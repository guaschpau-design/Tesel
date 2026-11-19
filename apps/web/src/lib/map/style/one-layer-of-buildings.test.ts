import type { Map as MapLibreMap } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';

import { FRANCE_SOUTH, PORTUGAL, SPAIN } from '../tiles/borders-data.ts';
import { keepOneLayerOfBuildings, osmBuildingsHidden } from './one-layer-of-buildings.ts';

const OUTLINES = { spain: SPAIN, others: [PORTUGAL, FRANCE_SOUTH] };

/** A view of about a kilometre round a place. */
function around(lat: number, lon: number) {
  const half = 0.006;
  return { west: lon - half, south: lat - half, east: lon + half, north: lat + half };
}

describe('one layer of buildings', () => {
  it('hides OpenStreetMap’s buildings in Spain, inland as on the coast', () => {
    expect(osmBuildingsHidden(around(41.155, 1.107), OUTLINES)).toBe(true); // Reus
    expect(osmBuildingsHidden(around(39.469, -0.322), OUTLINES)).toBe(true); // Valencia's beach
  });

  it('keeps them elsewhere, and where a view reaches another country', () => {
    expect(osmBuildingsHidden(around(38.722, -9.139), OUTLINES)).toBe(false); // Lisbon
    expect(osmBuildingsHidden(around(43.6, 1.44), OUTLINES)).toBe(false); // Toulouse
    expect(osmBuildingsHidden(around(43.343, -1.79), OUTLINES)).toBe(false); // Irun and Hendaye
  });
});

/** A map with the cadastre drawn and OpenStreetMap's buildings, at a view; what it is told. */
function stubMap(view: { lat: number; lon: number }) {
  const handlers = new Map<string, () => void>();
  const opacity = new Map<string, unknown>([
    ['buildings', 0.5],
    ['cadastre-buildings', 1],
  ]);
  const at = { ...view };
  const map = {
    on: (type: string, handler: () => void) => handlers.set(type, handler),
    off: (type: string) => handlers.delete(type),
    getLayer: (id: string) => (opacity.has(id) ? { id } : undefined),
    getPaintProperty: (id: string) => opacity.get(id),
    setPaintProperty: (id: string, _name: string, value: unknown) => opacity.set(id, value),
    getZoom: () => 16,
    getBounds: () => ({
      getWest: () => at.lon - 0.006,
      getEast: () => at.lon + 0.006,
      getSouth: () => at.lat - 0.006,
      getNorth: () => at.lat + 0.006,
    }),
    queryRenderedFeatures: () => [{}],
  };
  return { map, opacity, at, emit: (type: string) => handlers.get(type)?.() };
}

/** Lets the outlines load and a decision land. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

describe('keeping one layer of buildings', () => {
  it('hides OpenStreetMap’s at once in a new style, and gives them back their own opacity', async () => {
    const { map, opacity, at, emit } = stubMap({ lat: 41.155, lon: 1.107 });
    keepOneLayerOfBuildings(map as unknown as MapLibreMap);
    emit('idle');
    await settle();
    expect(opacity.get('buildings')).toBe(0);
    // Another map comes with its own buildings shown: they are hidden as it comes.
    opacity.set('buildings', 1);
    emit('styledata');
    expect(opacity.get('buildings')).toBe(0);
    // Away from Spain, they show again, with the new map's opacity.
    Object.assign(at, { lat: 38.722, lon: -9.139 });
    emit('idle');
    await settle();
    expect(opacity.get('buildings')).toBe(1);
  });
});
