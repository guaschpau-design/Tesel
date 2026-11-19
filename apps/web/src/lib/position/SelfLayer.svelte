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
  import { addApp6SelfImages, app6SelfImage, type MilitaryLook } from '../objects/app6-images.ts';
  import { themeColor } from '../ui/theme.ts';
  import {
    addArrowheadImage,
    movementFeatures,
    movementLayers,
    type Movement,
  } from '../objects/app6-movement.ts';
  import { useZoom } from '../map/zoom.svelte.ts';
  import { compass } from './compass.svelte.ts';
  import { deviceLocation } from './device-location.svelte.ts';
  import type { DeviceFix } from './device-location.svelte.ts';
  import { drawnAlike, selfFeatures } from './self-features.ts';

  interface Props {
    map: MapLibreMap;
    /** The name beside the dot. */
    label: string;
    /** On the tactical map, this device in APP-6 with the way it moves or points (ADR-0150). */
    military: MilitaryLook | null;
  }

  let { map, label, military }: Props = $props();

  // The compass is listened to only while this device's arrow may be drawn.
  $effect(() => {
    if (military !== null) return compass.start();
  });

  const SOURCE = 'tesel-self';
  /** Below this speed, in metres a second, the GPS's heading is its wandering, not a way. */
  const MOVING_MPS = 0.5;

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
  const MOVING = 'tesel-self-moving';
  const zoom = useZoom(() => map);
  /**
   * On the tactical map, the way this device moves and how fast, from the GPS, while it moves; or
   * else, from the compass where the phone has one, the way it points (ADR-0150).
   */
  const movement = $derived.by((): Movement | null => {
    const shown: DeviceFix | null = drawn;
    if (military === null || shown === null) return null;
    const { heading, speed } = deviceLocation.fix ?? shown;
    if (heading !== null && (speed ?? 0) >= MOVING_MPS) return { at: shown.at, heading, speed };
    return compass.heading === null
      ? null
      : { at: shown.at, heading: compass.heading, speed: null };
  });
  const moving = $derived(movementFeatures(movement === null ? [] : [movement], zoom.value));
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
    data: { [SOURCE]: () => selfFeatures(drawn, label), [MOVING]: () => moving },
    prepare: () => {
      if (military === null) return;
      addApp6SelfImages(map, military.locale);
      addArrowheadImage(map);
    },
    layers: () => {
      const self = themeColor('self');
      const ring = themeColor('self-ring');
      const point: FilterSpecification = ['==', ['geometry-type'], 'Point'];
      // This device as a dot named 'You' or, on the tactical map, as its own APP-6 frame, which
      // says "TÚ" itself, over the line of the way it points or moves (ADR-0148, ADR-0150).
      const points: LayerSpecification[] =
        military === null
          ? [
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
                },
              },
              nameLabel({ id: `${SOURCE}-label`, source: SOURCE, filter: point, overlap: true }),
            ]
          : [
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
        ...(military === null ? [] : movementLayers(MOVING)),
        ...points,
      ];
    },
  });
</script>
