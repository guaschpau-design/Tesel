<!-- Draws this device where the GPS says it is now, whenever the GPS is on, named 'You' so that
     whoever opens the map knows which dot is theirs. A fix that would draw the dot where it is
     already, within a pixel, is not drawn again until the zoom changes. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  import { metresPerPixel } from '../map/geometry.ts';
  import { nameLabel } from '../map/name-label.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { deviceLocation } from './device-location.svelte.ts';
  import type { DeviceFix } from './device-location.svelte.ts';
  import { drawnAlike, selfFeatures } from './self-features.ts';

  interface Props {
    map: MapLibreMap;
    /** The name beside the dot. */
    label: string;
  }

  let { map, label }: Props = $props();

  const SOURCE = 'tesel-self';

  /** The fix drawn: the GPS's, unless it would look the same. */
  let drawn: DeviceFix | null = $state.raw(null);
  $effect(() => {
    const fix = deviceLocation.fix;
    const scale = untrack(() => metresPerPixel(map.getZoom(), fix?.at.lat ?? 0));
    if (
      !drawnAlike(
        untrack(() => drawn),
        fix,
        scale,
      )
    )
      drawn = fix;
  });
  // Zoomed in, what was within a pixel may be several: the dot goes where the GPS says.
  onMount(() => {
    const zoomed = () => {
      drawn = deviceLocation.fix;
    };
    map.on('zoomend', zoomed);
    return () => {
      map.off('zoomend', zoomed);
    };
  });

  useOverlay(() => map, {
    level: 'self',
    data: { [SOURCE]: () => selfFeatures(drawn, label) },
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
