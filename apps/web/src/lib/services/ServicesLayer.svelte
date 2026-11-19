<!-- The public services of the base map (health, pharmacies, fire, police, helipads, town halls,
     fuel stations) as round icons with their names, or on the tactical map as key points on
     squares (ADR-0141), and taps on them. They come with the base map,
     so they also work offline in downloaded areas. -->
<script lang="ts">
  import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import type { Locale } from '../i18n/index.ts';
  import { addGlyphImage } from '../map/style/glyph-images.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { BASEMAP_SOURCE } from '../map/style/style.ts';
  import type { MapTaps } from '../map/taps.ts';
  import { GLYPHS } from '../ui/glyphs.ts';
  import { themeColor, toneColor } from '../ui/theme.ts';
  import {
    SERVICE_KINDS,
    serviceIconExpression,
    serviceImageName,
    serviceKindOf,
    type ServiceLook,
    type TappedService,
  } from './services.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    locale: Locale;
    visible: boolean;
    /** Larger, over the urban map, where they are what a team in a town looks for (ADR-0137). */
    large: boolean;
    look: ServiceLook;
    onselect: (service: TappedService) => void;
  }

  let { map, taps, locale, visible, large, look, onselect }: Props = $props();

  const LAYER = 'tesel-services';
  /**
   * Services appear from this zoom. Which ones is the base map's choice: hospitals, fire stations
   * and town halls are in its levels from about here, the rest only in its last level (map/style/style.ts).
   */
  const MIN_ZOOM = 12;

  useOverlay(() => map, {
    level: 'services',
    data: {},
    baseSource: BASEMAP_SOURCE,
    visible: () => visible,
    prepare: () => {
      for (const kind of SERVICE_KINDS) {
        addGlyphImage(map, serviceImageName(kind, look), {
          glyph: GLYPHS[kind.glyph],
          colour: look === 'key' ? themeColor('map-key') : toneColor(kind.tone),
          shape: look === 'key' ? 'square' : 'circle',
        });
      }
    },
    layers: () => [
      {
        id: LAYER,
        type: 'symbol',
        source: BASEMAP_SOURCE,
        'source-layer': 'pois',
        minzoom: MIN_ZOOM,
        filter: ['in', ['get', 'kind'], ['literal', SERVICE_KINDS.flatMap((k) => k.osmKinds)]],
        layout: {
          'icon-image': serviceIconExpression(look),
          'icon-size': large ? 1.25 : 1,
          'icon-allow-overlap': true,
          'text-field': ['coalesce', ['get', `name:${locale}`], ['get', 'name']],
          'text-font': ['Noto Sans Medium'],
          'text-size': large ? 12.5 : 11,
          'text-offset': [0, large ? 1.6 : 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'text-color': themeColor('map-text'),
          'text-halo-color': themeColor('map-halo'),
          'text-halo-width': 1.5,
        },
      },
    ],
  });

  function tapped(feature: MapGeoJSONFeature): TappedService | null {
    const properties = feature.properties as Record<string, unknown>;
    const kind = serviceKindOf(String(properties['kind']));
    if (kind === undefined || feature.geometry.type !== 'Point') return null;
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    const name = properties[`name:${locale}`] ?? properties['name'];
    return { at: { lat, lon }, name: typeof name === 'string' ? name : null, kind };
  }

  onMount(() =>
    taps.onFeature([LAYER], (feature) => {
      const service = tapped(feature);
      if (service !== null) onselect(service);
    }),
  );
</script>
