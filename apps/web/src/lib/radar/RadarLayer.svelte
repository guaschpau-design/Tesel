<!-- The radar around this device (radar.ts): rings whose spacing follows the zoom, and lines to the
     nearest members with their distance and bearing. It keeps the GPS on while shown, since it is
     drawn around where the device is. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import type { Locale } from '../i18n/index.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { bearings } from '../navigation/bearings.svelte.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { clockEvery } from '../ui/now.svelte.ts';
  import { nearestMembers, ringFeatures, ringStep, vectorFeatures } from './radar.ts';

  interface Props {
    map: MapLibreMap;
    locale: Locale;
    /** The active group's positions and this device in it, for the lines to the nearest members. */
    group: { readonly positions: GroupState['positions']; readonly self: NodeId } | null;
  }

  let { map, locale, group }: Props = $props();

  const RINGS = 'tesel-radar-rings';
  const VECTORS = 'tesel-radar-vectors';
  const NOTHING: FeatureCollection = { type: 'FeatureCollection', features: [] };

  /** The map's zoom, read when it mounts and after each zoom. */
  let zoom = $state(0);
  const now = clockEvery(30_000);
  const here = $derived(deviceLocation.fix?.at ?? null);
  const rings = $derived(here ? ringFeatures(here, ringStep(zoom, here.lat), locale) : NOTHING);
  const vectors = $derived(
    here && group
      ? vectorFeatures(
          here,
          nearestMembers(group, group.self, here, now.seconds),
          locale,
          bearings.style,
        )
      : NOTHING,
  );

  $effect(() => deviceLocation.use());

  onMount(() => {
    const zoomed = () => {
      zoom = map.getZoom();
    };
    zoomed();
    map.on('zoomend', zoomed);
    return () => {
      map.off('zoomend', zoomed);
    };
  });

  useOverlay(() => map, {
    level: 'radar',
    data: { [RINGS]: () => rings, [VECTORS]: () => vectors },
    layers: () => {
      const text = themeColor('map-text');
      const halo = themeColor('map-halo');
      const member = themeColor('member');
      const label = { 'text-font': ['Noto Sans Medium'], 'text-size': 11 };
      return [
        {
          id: `${RINGS}-lines`,
          type: 'line',
          source: RINGS,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': text, 'line-width': 1.5, 'line-opacity': 0.5 },
        },
        {
          id: `${RINGS}-labels`,
          type: 'symbol',
          source: RINGS,
          filter: ['==', ['geometry-type'], 'Point'],
          layout: { ...label, 'text-field': ['get', 'label'], 'text-allow-overlap': true },
          paint: { 'text-color': text, 'text-halo-color': halo, 'text-halo-width': 2 },
        },
        {
          id: `${VECTORS}-lines`,
          type: 'line',
          source: VECTORS,
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': member, 'line-width': 2, 'line-dasharray': [2, 2] },
        },
        {
          id: `${VECTORS}-labels`,
          type: 'symbol',
          source: VECTORS,
          layout: { ...label, 'symbol-placement': 'line-center', 'text-field': ['get', 'label'] },
          paint: { 'text-color': member, 'text-halo-color': halo, 'text-halo-width': 2 },
        },
      ];
    },
  });
</script>
