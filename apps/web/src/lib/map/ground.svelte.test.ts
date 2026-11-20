import { describe, expect, it } from 'vitest';

import { FakeMap } from './fake-map.ts';
import { groundExaggeration, keepDrapedTogether } from './ground.svelte.ts';

/** Lets what the map asked for, just after its frame, happen. */
const afterFrame = () => Promise.resolve();

function mapOf(layers: readonly [string, string][]): FakeMap {
  const map = new FakeMap();
  for (const [id, type] of layers) map.addLayer({ id, type });
  return map;
}

const MIXED: readonly [string, string][] = [
  ['land', 'background'],
  ['roads', 'line'],
  ['road-names', 'symbol'],
  ['relief', 'hillshade'],
  ['grid', 'line'],
  ['grid-labels', 'symbol'],
  ['members', 'circle'],
  ['trail', 'line'],
];

describe('how high the ground is raised', () => {
  it('raises it twice its height from afar and nearer its own up close', () => {
    expect(groundExaggeration(5)).toBe(2);
    expect(groundExaggeration(9)).toBe(2);
    expect(groundExaggeration(12)).toBeCloseTo(1.65);
    expect(groundExaggeration(15)).toBeCloseTo(1.3);
    expect(groundExaggeration(19)).toBeCloseTo(1.3);
  });
});

describe('the layers draped over raised ground', () => {
  it('are kept together under the others, each group in its order', async () => {
    const map = mapOf(MIXED);
    map.terrain = { source: 'terrain-3d' };
    const stop = keepDrapedTogether(map.map);
    await afterFrame();
    expect(map.getLayersOrder()).toEqual([
      'land',
      'roads',
      'relief',
      'grid',
      'trail',
      'road-names',
      'grid-labels',
      'members',
    ]);
    // An overlay added later among the names is put with its own kind again.
    map.addLayer({ id: 'route', type: 'line' }, 'members');
    map.fire('styledata');
    await afterFrame();
    expect(map.getLayersOrder().slice(4, 6)).toEqual(['trail', 'route']);
    stop();
  });

  it('are left where they are on a flat map', async () => {
    const map = mapOf(MIXED);
    keepDrapedTogether(map.map);
    map.fire('styledata');
    await afterFrame();
    expect(map.getLayersOrder()).toEqual(MIXED.map(([id]) => id));
  });
});
