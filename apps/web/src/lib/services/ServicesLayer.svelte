<!-- The public services of the base map (health, pharmacies, fire, police, helipads, town halls,
     fuel stations) as round icons with their names, and taps on them; on the urban map, close up,
     its critical places too (ADR-0155); and the aid points of the app's server (defibrillators,
     drinking water, fire hydrants, ADR-0165), each from its own zoom. They come with the base map
     and with the server's archive, so they also work offline in downloaded areas. -->
<script lang="ts">
  import type { LayerSpecification, Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import type { Locale } from '../i18n/index.ts';
  import { addGlyphImage } from '../map/style/glyph-images.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { BASEMAP_SOURCE } from '../map/style/style.ts';
  import type { MapTaps } from '../map/taps.ts';
  import { GLYPHS } from '../ui/glyphs.ts';
  import { themeColor, toneColor } from '../ui/theme.ts';
  import { AID_LAYER, AID_SOURCE, aidFacts } from './aid-points.ts';
  import {
    AID_KINDS,
    ALL_KINDS,
    CRITICAL_PLACES,
    CRITICAL_PLACES_MIN_ZOOM,
    SERVICE_KINDS,
    serviceIconExpression,
    serviceImageName,
    serviceKindOf,
    type AidKind,
    type ServiceKind,
    type TappedService,
  } from './services.ts';

  interface Props {
    map: MapLibreMap;
    taps: MapTaps;
    locale: Locale;
    visible: boolean;
    /**
     * Over the urban map: larger, as what a team in a town looks for (ADR-0137), and with its
     * critical places from zoom 16 (ADR-0155).
     */
    urban: boolean;
    onselect: (service: TappedService) => void;
  }

  let { map, taps, locale, visible, urban, onselect }: Props = $props();

  const LAYER = 'tesel-services';
  const CRITICAL = 'tesel-critical-places';
  /** One layer per kind of aid point, as each shows from its own zoom. */
  const aidLayerId = (kind: AidKind) => `tesel-aid-${kind.id}`;
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
      for (const kind of ALL_KINDS) {
        addGlyphImage(map, serviceImageName(kind), {
          glyph: GLYPHS[kind.glyph],
          colour: toneColor(kind.tone),
          shape: 'circle',
        });
      }
    },
    layers: () => [
      // Under the services: a hydrant in front of a hospital leaves the hospital in sight.
      ...AID_KINDS.map(aidIcons),
      icons(LAYER, SERVICE_KINDS, MIN_ZOOM),
      ...(urban ? [icons(CRITICAL, CRITICAL_PLACES, CRITICAL_PLACES_MIN_ZOOM)] : []),
    ],
  });

  /**
   * The aid points of one kind. Only defibrillators carry their name: there are few, and a name
   * says where it is; hydrants and fountains have none worth reading, and smaller icons.
   */
  function aidIcons(kind: AidKind): LayerSpecification {
    const named = kind.id === 'defibrillator';
    return {
      id: aidLayerId(kind),
      type: 'symbol',
      source: AID_SOURCE,
      'source-layer': AID_LAYER,
      minzoom: kind.minZoom,
      filter: ['in', ['get', 'kind'], ['literal', kind.osmKinds]],
      layout: {
        'icon-image': serviceImageName(kind),
        'icon-size': (named ? 1 : 0.8) * (urban ? 1.25 : 1),
        'icon-allow-overlap': true,
        ...(named
          ? {
              'text-field': ['get', 'name'],
              'text-font': ['Noto Sans Medium'],
              'text-size': urban ? 12.5 : 11,
              'text-offset': [0, urban ? 1.6 : 1.4],
              'text-anchor': 'top',
              'text-optional': true,
            }
          : {}),
      },
      paint: {
        'text-color': themeColor('map-text'),
        'text-halo-color': themeColor('map-halo'),
        'text-halo-width': 1.5,
      },
    };
  }

  /** The icons and names of some kinds, from a zoom. */
  function icons(
    id: string,
    kinds: readonly [ServiceKind, ...ServiceKind[]],
    minzoom: number,
  ): LayerSpecification {
    return {
      id,
      type: 'symbol',
      source: BASEMAP_SOURCE,
      'source-layer': 'pois',
      minzoom,
      filter: ['in', ['get', 'kind'], ['literal', kinds.flatMap((k) => k.osmKinds)]],
      layout: {
        'icon-image': serviceIconExpression(kinds),
        'icon-size': urban ? 1.25 : 1,
        'icon-allow-overlap': true,
        'text-field': ['coalesce', ['get', `name:${locale}`], ['get', 'name']],
        'text-font': ['Noto Sans Medium'],
        'text-size': urban ? 12.5 : 11,
        'text-offset': [0, urban ? 1.6 : 1.4],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': themeColor('map-text'),
        'text-halo-color': themeColor('map-halo'),
        'text-halo-width': 1.5,
      },
    };
  }

  function tapped(feature: MapGeoJSONFeature): TappedService | null {
    const properties = feature.properties as Record<string, unknown>;
    const kind = serviceKindOf(String(properties['kind']));
    if (kind === undefined || feature.geometry.type !== 'Point') return null;
    const [lon, lat] = feature.geometry.coordinates as [number, number];
    const name = properties[`name:${locale}`] ?? properties['name'];
    return {
      at: { lat, lon },
      name: typeof name === 'string' ? name : null,
      kind,
      ...(feature.source === AID_SOURCE ? { aid: aidFacts(properties) } : {}),
    };
  }

  onMount(() =>
    taps.onFeature([LAYER, CRITICAL, ...AID_KINDS.map(aidLayerId)], (feature) => {
      const service = tapped(feature);
      if (service !== null) onselect(service);
    }),
  );
</script>
