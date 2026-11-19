<!-- Draws this device where the GPS says it is now, whenever the GPS is on, named 'You' so that
     whoever opens the map knows which dot is theirs. A fix that would draw the dot where it is
     already, within a pixel, is not drawn again until the zoom changes. On the tactical map a line
     out of the dot shows the way it moves, or, standing, the way the phone points (ADR-0150). -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  import { metresPerPixel } from '../map/geometry.ts';
  import {
    addArrowheadImage,
    movementFeatures,
    movementLayers,
    type Movement,
  } from '../map/movement.ts';
  import { nameLabel } from '../map/name-label.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { useZoom } from '../map/zoom.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { compass } from './compass.svelte.ts';
  import { deviceLocation } from './device-location.svelte.ts';
  import type { DeviceFix } from './device-location.svelte.ts';
  import { drawnAlike, selfFeatures } from './self-features.ts';

  interface Props {
    map: MapLibreMap;
    /** The name beside the dot. */
    label: string;
    /** On the tactical map, the way this device moves or points (ADR-0150). */
    movement: boolean;
  }

  let { map, label, movement }: Props = $props();

  const SOURCE = 'tesel-self';
  const MOVING = 'tesel-self-moving';
  /** Below this speed, in metres a second, the GPS's heading is its wandering, not a way. */
  const MOVING_MPS = 0.5;

  // The compass is listened to only while this device's line may be drawn.
  $effect(() => {
    if (movement) return compass.start();
  });

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

  const zoom = useZoom(() => map);
  /**
   * The way this device moves and how fast, from the GPS, while it moves; or else, from the compass
   * where the phone has one, the way it points.
   */
  const moved = $derived.by((): Movement | null => {
    const shown: DeviceFix | null = drawn;
    if (!movement || shown === null) return null;
    const { heading, speed } = deviceLocation.fix ?? shown;
    if (heading !== null && (speed ?? 0) >= MOVING_MPS) return { at: shown.at, heading, speed };
    return compass.heading === null
      ? null
      : { at: shown.at, heading: compass.heading, speed: null };
  });
  const moving = $derived(movementFeatures(moved === null ? [] : [moved], zoom.value));

  useOverlay(() => map, {
    level: 'self',
    data: { [SOURCE]: () => selfFeatures(drawn, label), [MOVING]: () => moving },
    prepare: () => {
      if (movement) addArrowheadImage(map);
    },
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
        // The way it moves, under its dot.
        ...(movement ? movementLayers(MOVING) : []),
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
