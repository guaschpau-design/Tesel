import type { FeatureCollection } from 'geojson';
import { describe, expect, it } from 'vitest';

import { FakeMap } from './fake-map.ts';
import { Overlay } from './overlay.svelte.ts';

const NOTHING: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Lets an install the map called for, just after its frame, happen. */
const afterFrame = () => Promise.resolve();

const spec = (map: FakeMap) => ({
  level: 'members' as const,
  data: { a: NOTHING, b: NOTHING },
  // Adding an image announces a style change straight away.
  prepare: () => {
    map.fire('styledata');
  },
  layers: () => [{ id: 'a-dots', type: 'circle' as const, source: 'a' }],
});

describe('map overlays', () => {
  it('installs once even when the map calls back while it is installing', () => {
    const map = new FakeMap();
    new Overlay(map.map, spec(map));
    expect([...map.sources.keys()]).toEqual(['a', 'b']);
    expect([...map.layers.keys()]).toEqual(['a-dots']);
  });

  it('comes back after a new style removes it, hidden if it was hidden', async () => {
    const map = new FakeMap();
    const overlay = new Overlay(map.map, spec(map));
    overlay.setVisible(false);
    map.sources.clear();
    map.layers.clear();
    map.fire('styledata');
    // Not within the map's own announcement, which comes from inside its drawing.
    expect(map.layers.size).toBe(0);
    await afterFrame();
    expect(map.layers.get('a-dots')?.layout).toEqual({ visibility: 'none' });
  });

  it('stacks overlays by level, whatever order they come in', () => {
    const map = new FakeMap();
    const overlay = (level: 'trails' | 'self', id: string) =>
      new Overlay(map.map, {
        level,
        data: { [id]: NOTHING },
        layers: () => [{ id: `${id}-line`, type: 'line' as const, source: id }],
      });
    overlay('self', 'me');
    overlay('trails', 'trails');
    expect([...map.layers.keys()]).toEqual(['trails-line', 'me-line']);
  });

  it('waits for the base map source its layers read, and comes back after a new style', async () => {
    const map = new FakeMap();
    new Overlay(map.map, {
      level: 'services',
      data: {},
      baseSource: 'protomaps',
      layers: () => [{ id: 'services-icons', type: 'symbol' as const, source: 'protomaps' }],
    });
    expect(map.layers.size).toBe(0);
    map.sources.set('protomaps', {});
    map.fire('idle');
    await afterFrame();
    expect([...map.layers.keys()]).toEqual(['services-icons']);
    map.layers.clear();
    map.fire('styledata');
    await afterFrame();
    expect([...map.layers.keys()]).toEqual(['services-icons']);
  });

  it('takes everything away when removed', async () => {
    const map = new FakeMap();
    // Removed while the map has just called for it again: it does not come back.
    new Overlay(map.map, spec(map)).remove();
    expect(map.sources.size + map.layers.size).toBe(0);
    map.fire('idle');
    await afterFrame();
    expect(map.sources.size).toBe(0);
  });

  it('draws a picture from an image source, and moves it where it is told', () => {
    const map = new FakeMap();
    const corners = (
      west: number,
    ): [[number, number], [number, number], [number, number], [number, number]] => [
      [west, 1],
      [west + 1, 1],
      [west + 1, 0],
      [west, 0],
    ];
    const moved: unknown[] = [];
    const overlay = new Overlay(map.map, {
      level: 'cadastre',
      data: { view: { url: 'a.png', coordinates: corners(0) } },
      layers: () => [{ id: 'view-picture', type: 'raster' as const, source: 'view' }],
    });
    expect(map.sources.get('view')).toEqual({
      type: 'image',
      url: 'a.png',
      coordinates: corners(0),
    });
    map.sources.set('view', { updateImage: (image: unknown) => moved.push(image) });
    overlay.setData('view', { url: 'b.png', coordinates: corners(2) });
    expect(moved).toEqual([{ url: 'b.png', coordinates: corners(2) }]);
  });
});
