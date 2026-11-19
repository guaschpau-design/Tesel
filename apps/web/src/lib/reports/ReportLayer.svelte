<!-- Draws where the situation reports were made, and opens the reports when one is tapped. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { REPORTS } from '../chat/chat-tabs.ts';
  import type { Translate } from '../i18n/index.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import type { MapTaps } from '../map/taps.ts';
  import { openPanel } from '../ui/panels.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { reportFeatures } from './report-features.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
    taps: MapTaps;
    reports: GroupState['reports'];
    /** Reports at an object are drawn where it is. */
    objects: GroupState['objects'];
    visible: boolean;
  }

  let { t, map, taps, reports, objects, visible }: Props = $props();

  const SOURCE = 'tesel-reports';

  useOverlay(() => map, {
    level: 'tasks',
    data: { [SOURCE]: () => reportFeatures({ reports, objects }, t) },
    visible: () => visible,
    layers: () => {
      const halo = themeColor('map-halo');
      return [
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': 8,
            'circle-color': themeColor('warning'),
            'circle-stroke-width': 3,
            'circle-stroke-color': themeColor('map-text'),
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
          paint: {
            'text-color': themeColor('map-text'),
            'text-halo-color': halo,
            'text-halo-width': 1.5,
          },
        },
      ];
    },
  });

  onMount(() =>
    taps.onFeature([`${SOURCE}-dot`], () => {
      openPanel(REPORTS);
    }),
  );
</script>
