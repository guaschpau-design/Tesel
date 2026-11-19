<!-- Draws the group's markers, shapes and strips of sweeps, and reports taps on them. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';
  import { themeColor, toneExpression } from '../ui/theme.ts';
  import { markerFeatures, shapeFeatures, stripFeatures } from './object-features.ts';
  import { stripLayers } from './strip-layers.ts';
  import { addSymbolImages } from './symbol-images.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    objects: GroupState['objects'];
    /** Strips of sweeps take the colour of the team they are for. */
    tasks: GroupState['tasks'];
    teams: GroupState['teams'];
    /** Whether markers and shapes are shown. */
    visible: boolean;
    /** On a decluttered map, only threats and danger areas, and no sweeps (ADR-0151). */
    threatsOnly: boolean;
    onselect: (key: string) => void;
  }

  let { map, taps, objects, tasks, teams, visible, threatsOnly, onselect }: Props = $props();

  const MARKERS = 'tesel-markers';
  const SHAPES = 'tesel-shapes';
  const STRIPS = 'tesel-strips';
  const NOTHING: FeatureCollection = { type: 'FeatureCollection', features: [] };

  useOverlay(() => map, {
    level: 'objects',
    data: {
      [SHAPES]: () => shapeFeatures({ objects }, threatsOnly),
      [STRIPS]: () => (threatsOnly ? NOTHING : stripFeatures({ objects, tasks, teams })),
      [MARKERS]: () => markerFeatures({ objects }, threatsOnly),
    },
    visible: () => visible,
    prepare: () => {
      addSymbolImages(map);
    },
    layers: () => {
      const tone = toneExpression();
      const text = themeColor('map-text');
      const halo = themeColor('map-halo');
      return [
        {
          id: `${SHAPES}-fill`,
          type: 'fill',
          source: SHAPES,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': tone, 'fill-opacity': 0.18 },
        },
        {
          id: `${SHAPES}-line`,
          type: 'line',
          source: SHAPES,
          paint: { 'line-color': tone, 'line-width': 3 },
        },
        {
          id: `${SHAPES}-label`,
          type: 'symbol',
          source: SHAPES,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'symbol-placement': 'point',
          },
          paint: { 'text-color': tone, 'text-halo-color': halo, 'text-halo-width': 1.5 },
        },
        ...stripLayers(STRIPS),
        {
          id: `${MARKERS}-icon`,
          type: 'symbol',
          source: MARKERS,
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-allow-overlap': true,
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'text-offset': [0, 1.5],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': text, 'text-halo-color': halo, 'text-halo-width': 1.5 },
        },
      ];
    },
  });

  onMount(() =>
    taps.onFeature(
      [`${MARKERS}-icon`, `${STRIPS}-line`, `${SHAPES}-fill`, `${SHAPES}-line`],
      (feature) => {
        const key = textProperty(feature, 'key');
        if (key !== null) onselect(key);
      },
    ),
  );
</script>
