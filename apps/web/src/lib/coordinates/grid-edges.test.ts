import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';

import { EDGE_INSET, gridEdgeLabels, type Screen } from './grid-edges.ts';

/** A screen 400 × 300 px where a degree is 100 px, north up, its top left corner at 0° E 3° N. */
const screen: Screen = {
  width: 400,
  height: 300,
  project: ([lon, lat]) => ({ x: lon * 100, y: (3 - lat) * 100 }),
  unproject: ({ x, y }) => [x / 100, 3 - y / 100],
};

function line(label: string, coordinates: number[][]) {
  return {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates },
    properties: { kind: 'line', label },
  };
}

describe('gridEdgeLabels', () => {
  it("writes a northing line's digits on the left edge and an easting line's at the bottom", () => {
    const grid: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        line('77', [
          [-1, 2],
          [5, 2],
        ]),
        line('46', [
          [2, -1],
          [2, 4],
        ]),
      ],
    };
    const labels = gridEdgeLabels(grid, screen);
    expect(labels.features.map((feature) => feature.properties)).toEqual([
      { label: '77', edge: 'left' },
      { label: '46', edge: 'bottom' },
    ]);
    expect(labels.features[0]?.geometry.coordinates).toEqual([EDGE_INSET / 100, 2]);
    const [lon, lat] = labels.features[1]?.geometry.coordinates ?? [];
    expect(lon).toBeCloseTo(2);
    expect(lat).toBeCloseTo(3 - (300 - EDGE_INSET) / 100);
  });

  it('writes nothing for lines off the screen, zone edges or lines without digits', () => {
    const grid: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        line('12', [
          [-1, 5],
          [5, 5],
        ]),
        line('', [
          [-1, 2],
          [5, 2],
        ]),
        {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [2, -1],
              [2, 4],
            ],
          },
          properties: { kind: 'zone', label: '' },
        },
      ],
    };
    expect(gridEdgeLabels(grid, screen).features).toEqual([]);
  });
});
