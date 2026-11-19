<!-- Draws where the situation reports were made, and opens the reports when one is tapped. On the
     tactical map each is the APP-6 symbol of its incident, as its marker would be (ADR-0148). -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { REPORTS } from '../chat/chat-tabs.ts';
  import type { Translate } from '../i18n/index.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import type { MapTaps } from '../map/taps.ts';
  import { addApp6MarkerImages, type MilitaryLook } from '../objects/app6-images.ts';
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
    /** On the tactical map, each report as its incident's APP-6 symbol (ADR-0148). */
    military: MilitaryLook | null;
  }

  let { t, map, taps, reports, objects, visible, military }: Props = $props();

  const SOURCE = 'tesel-reports';

  useOverlay(() => map, {
    level: 'tasks',
    data: { [SOURCE]: () => reportFeatures({ reports, objects }, t, military) },
    visible: () => visible,
    prepare: () => {
      if (military !== null) addApp6MarkerImages(map, military.locale);
    },
    layers: () => {
      const halo = themeColor('map-halo');
      // Each report as a dot or, on the tactical map, as the APP-6 marker of its incident.
      const point: LayerSpecification =
        military === null
          ? {
              id: `${SOURCE}-dot`,
              type: 'circle',
              source: SOURCE,
              paint: {
                'circle-radius': 8,
                'circle-color': themeColor('warning'),
                'circle-stroke-width': 3,
                'circle-stroke-color': themeColor('map-text'),
              },
            }
          : {
              id: `${SOURCE}-app6`,
              type: 'symbol',
              source: SOURCE,
              layout: { 'icon-image': ['get', 'icon'], 'icon-allow-overlap': true },
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
            'text-offset': [0, military === null ? 1.1 : 2.2],
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
    taps.onFeature([`${SOURCE}-dot`, `${SOURCE}-app6`], () => {
      openPanel(REPORTS);
    }),
  );
</script>
