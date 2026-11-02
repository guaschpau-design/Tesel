import { EMPTY_STATE, reduce, type GroupState } from '@tesel/core';
import type { NodeId, TeselEvent } from '@tesel/protocol';
import { flushSync } from 'svelte';
import { describe, expect, it } from 'vitest';

import { FakeMap } from '../map/fake-map.ts';
import { memberFeatures } from '../members/member-features.ts';
import { useOverlay } from '../map/overlay.svelte.ts';
import { trailFeatures } from '../members/trail-features.ts';
import { markerFeatures, shapeFeatures } from '../objects/object-features.ts';
import { taskFeatures } from '../tasks/task-features.ts';
import { stateSlices } from './state-slices.svelte.ts';

const ANA = 'a1b2c3d4' as NodeId;
const BERTA = '0f1e2d3c' as NodeId;
const T0 = 1_761_350_400;

function position(seq: number, lat: number): TeselEvent {
  const fix = { lon: -0.37, accuracy: 5, heading: null, speed: null };
  return { type: 'position', origin: BERTA, seq, time: T0 + seq, lat, ...fix };
}

/**
 * The group's layers as MapLayers puts them on the map, each reading its slices: what each
 * event uploads to the map is what the test counts.
 */
function groupOnMap(): { map: FakeMap; apply: (event: TeselEvent) => void; stop: () => void } {
  const map = new FakeMap();
  let state: GroupState = $state.raw(EMPTY_STATE);
  const stop = $effect.root(() => {
    const slices = stateSlices(() => state);
    const layer = (source: string, data: () => GeoJSON.FeatureCollection) => {
      useOverlay(() => map.map, {
        level: 'members',
        data: { [source]: data },
        layers: () => [{ id: `${source}-layer`, type: 'circle', source }],
      });
    };
    layer('members', () => memberFeatures(slices, ANA, T0));
    layer('trails', () => trailFeatures(slices, ANA));
    layer('markers', () => markerFeatures(slices));
    layer('shapes', () => shapeFeatures(slices));
    layer('tasks', () => taskFeatures(slices));
  });
  flushSync();
  map.uploads.clear();
  return {
    map,
    apply: (event) => {
      state = reduce(state, event);
      flushSync();
    },
    stop,
  };
}

describe('the group on the map', () => {
  it('uploads only the members and the trails when a member moves', () => {
    const { map, apply, stop } = groupOnMap();
    apply(position(1, 39.47));
    apply(position(2, 39.48));
    expect(Object.fromEntries([...map.uploads].map(([id, list]) => [id, list.length]))).toEqual({
      members: 2,
      trails: 2,
    });
    stop();
  });

  it('uploads the markers and shapes when an object is drawn, and not the members', () => {
    const { map, apply, stop } = groupOnMap();
    apply({
      type: 'marker',
      origin: ANA,
      seq: 1,
      time: T0,
      object: { origin: ANA, seq: 1 },
      symbol: 3,
      lat: 39.47,
      lon: -0.37,
      label: 'Fuego',
    });
    expect([...map.uploads.keys()].sort()).toEqual(['markers', 'shapes']);
    stop();
  });
});
