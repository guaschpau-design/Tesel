<!-- Draws this device where the GPS says it is now, whenever the GPS is on, named 'You' so that
     whoever opens the map knows which dot is theirs. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { nameLabel } from '../map/name-label.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { deviceLocation } from './device-location.svelte.ts';
  import { selfFeatures } from './self-features.ts';

  interface Props {
    map: MapLibreMap;
    /** The name beside the dot. */
    label: string;
  }

  let { map, label }: Props = $props();

  const SOURCE = 'tesel-self';

  useOverlay(() => map, {
    level: 'self',
    data: { [SOURCE]: () => selfFeatures(deviceLocation.fix, label) },
    layers: () => {
      const self = themeColor('self');
      const ring = themeColor('self-ring');
      return [
        {
          id: `${SOURCE}-accuracy`,
          type: 'fill',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': self, 'fill-opacity': 0.18, 'fill-outline-color': ring },
        },
        {
          id: `${SOURCE}-dot`,
          type: 'circle',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          // Lime alone does not stand out on a light map: this device gets an ink ring.
          paint: {
            'circle-radius': 8,
            'circle-color': self,
            'circle-stroke-width': 3,
            'circle-stroke-color': ring,
          },
        },
        nameLabel({
          id: `${SOURCE}-label`,
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          overlap: true,
        }),
      ];
    },
  });
</script>
