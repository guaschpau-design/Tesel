<!-- Draws the group's markers, shapes and strips of sweeps, and reports taps on them. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';
  import { themeColor, toneExpression } from '../ui/theme.ts';
  import { markerFeatures, shapeFeatures, stripFeatures } from './object-features.ts';
  import { stripLayers } from './strip-layers.ts';
  import { addApp6MarkerImages, type MilitaryLook } from './app6-images.ts';
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
    /** On the tactical maps, markers in NATO's symbols (ADR-0146). */
    military: MilitaryLook | null;
    onselect: (key: string) => void;
  }

  let { map, taps, objects, tasks, teams, visible, military, onselect }: Props = $props();

  const MARKERS = 'tesel-markers';
  const SHAPES = 'tesel-shapes';
  const STRIPS = 'tesel-strips';

  useOverlay(() => map, {
    level: 'objects',
    data: {
      [SHAPES]: () => shapeFeatures({ objects }),
      [STRIPS]: () => stripFeatures({ objects, tasks, teams }),
      [MARKERS]: () => markerFeatures({ objects }, military),
    },
    visible: () => visible,
    prepare: () => {
      addSymbolImages(map);
      if (military !== null) addApp6MarkerImages(map, military.time, military.locale);
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
            // APP-6's frames take more room than the app's icons.
            'text-offset': [0, military === null ? 1.5 : 2.2],
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
