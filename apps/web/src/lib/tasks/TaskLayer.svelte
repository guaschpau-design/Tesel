<!-- Draws the pending tasks that have a place, and opens the one tapped. On the tactical map each
     is an objective, APP-6's "OBJ" (ADR-0148). -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';
  import {
    addApp6ObjectiveImages,
    app6ObjectiveImage,
    type MilitaryLook,
  } from '../objects/app6-images.ts';
  import { themeColor } from '../ui/theme.ts';
  import { taskFeatures } from './task-features.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    tasks: GroupState['tasks'];
    /** Tasks at an object are drawn where it is. */
    objects: GroupState['objects'];
    visible: boolean;
    /** On the tactical map, each task's place as an objective (ADR-0148). */
    military: MilitaryLook | null;
    onselect: (key: string) => void;
  }

  let { map, taps, tasks, objects, visible, military, onselect }: Props = $props();

  const SOURCE = 'tesel-tasks';

  useOverlay(() => map, {
    level: 'tasks',
    data: { [SOURCE]: () => taskFeatures({ tasks, objects }) },
    visible: () => visible,
    prepare: () => {
      if (military !== null) addApp6ObjectiveImages(map, military.locale);
    },
    layers: () => {
      const ink = themeColor('map-text');
      const halo = themeColor('map-halo');
      const signal = themeColor('signal');
      // Each task's place as a dot, filled once started, or, on the tactical map, as an objective
      // (ADR-0148).
      const point: LayerSpecification =
        military === null
          ? {
              id: `${SOURCE}-dot`,
              type: 'circle',
              source: SOURCE,
              paint: {
                'circle-radius': 7,
                'circle-color': ['case', ['get', 'started'], signal, halo],
                'circle-stroke-width': 3,
                'circle-stroke-color': ink,
              },
            }
          : {
              id: `${SOURCE}-app6`,
              type: 'symbol',
              source: SOURCE,
              layout: {
                'icon-image': [
                  'case',
                  ['get', 'started'],
                  app6ObjectiveImage(true),
                  app6ObjectiveImage(false),
                ],
                'icon-allow-overlap': true,
              },
            };
      return [
        point,
        {
          id: `${SOURCE}-label`,
          type: 'symbol',
          source: SOURCE,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'text-offset': [0, military === null ? 1.1 : 0.6],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.5 },
        },
      ];
    },
  });

  onMount(() =>
    taps.onFeature([`${SOURCE}-dot`, `${SOURCE}-app6`], (feature) => {
      const key = textProperty(feature, 'key');
      if (key !== null) onselect(key);
    }),
  );
</script>
