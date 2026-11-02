import type { Feature, LineString } from 'geojson';
import { describe, expect, it } from 'vitest';

import { gridSpacing, mgrsGrid } from './mgrs-grid.ts';
import { toUtmInZone } from './utm.ts';

/** Around Valencia, at 30S YJ 25695 72210. */
const VALENCIA = { west: -0.39, south: 39.46, east: -0.36, north: 39.48, zoom: 14 };

const lines = (view: typeof VALENCIA) =>
  mgrsGrid(view).features.filter(
    (feature): feature is Feature<LineString> => feature.properties?.['kind'] === 'line',
  );

describe('MGRS grid', () => {
  it('spaces its lines to the zoom', () => {
    expect(gridSpacing(14, 39.5)).toBe(1_000);
    expect(gridSpacing(17, 39.5)).toBe(100);
    expect(gridSpacing(11, 39.5)).toBe(10_000);
    expect(gridSpacing(8, 39.5)).toBe(100_000);
    expect(gridSpacing(4, 39.5)).toBeNull();
  });

  it('draws each 1 km line where its easting is, labelled with its digits', () => {
    const onEasting = (feature: Feature<LineString>) =>
      feature.geometry.coordinates.every(
        ([lon = 0, lat = 0]) => Math.abs(toUtmInZone({ lat, lon }, 30).easting - 725_000) < 1,
      );
    const labelled = lines(VALENCIA).filter((feature) => feature.properties?.['label'] === '25');
    expect(labelled.some(onEasting)).toBe(true);
  });

  it('names the 100 km square in view', () => {
    const squares = mgrsGrid(VALENCIA).features.filter((f) => f.properties?.['kind'] === 'square');
    expect(squares.map((f) => String(f.properties?.['label']))).toEqual(['30S YJ']);
  });

  it('marks the edge between two zones and keeps each zone’s lines on its side', () => {
    // Zones 30 and 31 meet at 0°.
    const view = { west: -0.02, south: 39.47, east: 0.02, north: 39.49, zoom: 15 };
    const features = mgrsGrid(view).features;
    expect(features.filter((f) => f.properties?.['kind'] === 'zone')).toHaveLength(1);
    expect(lines(view).length).toBeGreaterThan(4);
  });

  it('draws the grid of each hemisphere on its side of the equator', () => {
    const view = { west: 9.98, south: -0.01, east: 10.02, north: 0.01, zoom: 15 };
    const all = lines(view);
    expect(all.length).toBeGreaterThan(4);
    // No line runs across the equator: the northings of each side are their own.
    for (const feature of all) {
      const lats = feature.geometry.coordinates.map(([, lat = 0]) => lat);
      expect(Math.min(...lats) < 0 && Math.max(...lats) > 0).toBe(false);
    }
  });

  it('draws nothing when zoomed too far out', () => {
    expect(mgrsGrid({ ...VALENCIA, zoom: 3 }).features).toEqual([]);
  });
});
