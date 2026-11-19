<!-- Draws the pending tasks that have a place, and opens the one tapped. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';
  import { themeColor } from '../ui/theme.ts';
  import { taskFeatures } from './task-features.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    tasks: GroupState['tasks'];
    /** Tasks at an object are drawn where it is. */
    objects: GroupState['objects'];
    visible: boolean;
    onselect: (key: string) => void;
  }

  let { map, taps, tasks, objects, visible, onselect }: Props = $props();

  const SOURCE = 'tesel-tasks';

  useOverlay(() => map, {
    level: 'tasks',
    data: { [SOURCE]: () => taskFeatures({ tasks, objects }) },
    visible: () => visible,
    layers: () => {
      const ink = themeColor('map-text');
      const halo = themeColor('map-halo');
      const signal = themeColor('signal');
      return [
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': 7,
            'circle-color': ['case', ['get', 'started'], signal, halo],
            'circle-stroke-width': 3,
            'circle-stroke-color': ink,
          },
        },
        {
          id: `${SOURCE}-label`,
          type: 'symbol',
          source: SOURCE,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'text-offset': [0, 1.1],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': ink, 'text-halo-color': halo, 'text-halo-width': 1.5 },
        },
      ];
    },
  });

  onMount(() =>
    taps.onFeature([`${SOURCE}-dot`], (feature) => {
      const key = textProperty(feature, 'key');
      if (key !== null) onselect(key);
    }),
  );
</script>
