<!-- Draws this device where the GPS says it is now, whenever the GPS is on, named 'You' so that
     whoever opens the map knows which dot is theirs. A fix that would draw the dot where it is
     already, within a pixel, is not drawn again until the zoom changes. On the tactical map it is
     its APP-6 frame edged in yellow, with an arrow the way it points, from its compass, or else the
     way it moves (ADR-0148). -->
<script lang="ts">
  import type { FilterSpecification, LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  import { metresPerPixel } from '../map/geometry.ts';
  import { nameLabel } from '../map/name-label.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import {
    addApp6SelfImages,
    APP6_DIRECTION_IMAGE,
    app6SelfImage,
    type MilitaryLook,
  } from '../objects/app6-images.ts';
  import { themeColor } from '../ui/theme.ts';
  import { compass } from './compass.svelte.ts';
  import { deviceLocation } from './device-location.svelte.ts';
  import type { DeviceFix } from './device-location.svelte.ts';
  import { drawnAlike, selfFeatures } from './self-features.ts';

  interface Props {
    map: MapLibreMap;
    /** The name beside the dot. */
    label: string;
    /** On the tactical map, this device in APP-6 with the way it points (ADR-0148). */
    military: MilitaryLook | null;
  }

  let { map, label, military }: Props = $props();

  // The compass is listened to only while its arrow is drawn.
  $effect(() => {
    if (military !== null) return compass.start();
  });

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
  // The compass where the phone gives one, or else the way the GPS says it moves.
  const heading = $derived(
    military === null ? null : (compass.heading ?? deviceLocation.fix?.heading ?? null),
  );
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
    data: { [SOURCE]: () => selfFeatures(drawn, label, heading) },
    prepare: () => {
      if (military !== null) addApp6SelfImages(map, military.locale);
    },
    layers: () => {
      const self = themeColor('self');
      const ring = themeColor('self-ring');
      const point: FilterSpecification = ['==', ['geometry-type'], 'Point'];
      // In APP-6 the symbol is drawn over the dot, which stays, unseen.
      const symbols: LayerSpecification[] =
        military === null
          ? []
          : [
              {
                id: `${SOURCE}-direction`,
                type: 'symbol',
                source: SOURCE,
                filter: ['all', point, ['has', 'heading']],
                layout: {
                  'icon-image': APP6_DIRECTION_IMAGE,
                  'icon-rotate': ['get', 'heading'],
                  'icon-rotation-alignment': 'map',
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                },
              },
              {
                id: `${SOURCE}-app6`,
                type: 'symbol',
                source: SOURCE,
                filter: point,
                layout: {
                  'icon-image': app6SelfImage(military.locale),
                  'icon-allow-overlap': true,
                  'icon-ignore-placement': true,
                },
              },
            ];
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
          filter: point,
          // Lime alone does not stand out on a light map: this device gets an ink ring.
          paint: {
            'circle-radius': 8,
            'circle-color': self,
            'circle-stroke-width': 3,
            'circle-stroke-color': ring,
            'circle-opacity': military === null ? 1 : 0,
            'circle-stroke-opacity': military === null ? 1 : 0,
          },
        },
        ...symbols,
        // In APP-6 the frame says "TÚ" itself.
        ...(military === null
          ? [nameLabel({ id: `${SOURCE}-label`, source: SOURCE, filter: point, overlap: true })]
          : []),
      ];
    },
  });
</script>
