<!-- The radio link on show (ADR-0159) on the map: the line from here in green while the ground
     lets the signal through, amber where it only grazes it, red from where the ground cuts it, and
     a ring where it cuts it most. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
  import type { ExpressionSpecification, Map as MapLibreMap } from 'maplibre-gl';

  import { toPosition } from '../map/geometry.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import type { ShownLink } from './radio-link.svelte.ts';

  interface Props {
    map: MapLibreMap;
    shown: ShownLink;
  }

  let { map, shown }: Props = $props();

  const SOURCE = 'tesel-radio-link';
  type Stretch = 'clear' | 'grazing' | 'blocked';

  /** The point `metres` along the way. */
  function along(metres: number): LatLon {
    const share = shown.link.length === 0 ? 0 : metres / shown.link.length;
    return {
      lat: shown.from.lat + (shown.to.lat - shown.from.lat) * share,
      lon: shown.from.lon + (shown.to.lon - shown.from.lon) * share,
    };
  }

  function stretch(start: LatLon, end: LatLon, kind: Stretch): Feature<LineString> {
    return {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: [toPosition(start), toPosition(end)] },
      properties: { kind },
    };
  }

  const features = $derived.by((): FeatureCollection<LineString | Point> => {
    const { verdict } = shown.link;
    if (verdict.kind !== 'blocked') {
      return {
        type: 'FeatureCollection',
        features: [stretch(shown.from, shown.to, verdict.kind)],
      };
    }
    const cut = along(verdict.from);
    return {
      type: 'FeatureCollection',
      features: [
        stretch(shown.from, cut, 'clear'),
        stretch(cut, shown.to, 'blocked'),
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: toPosition(along(verdict.metres)) },
          properties: { kind: 'blocked' },
        },
      ],
    };
  });

  useOverlay(() => map, {
    level: 'point',
    data: { [SOURCE]: () => features },
    layers: () => {
      const colour: ExpressionSpecification = [
        'match',
        ['get', 'kind'],
        'clear',
        themeColor('accent-line'),
        'grazing',
        themeColor('warning'),
        themeColor('danger'),
      ];
      return [
        {
          id: `${SOURCE}-halo`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round' },
          paint: { 'line-color': themeColor('map-halo'), 'line-width': 7 },
        },
        {
          id: `${SOURCE}-line`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'LineString'],
          layout: { 'line-cap': 'round' },
          paint: {
            'line-color': colour,
            'line-width': 4,
            'line-dasharray': [
              'case',
              ['==', ['get', 'kind'], 'blocked'],
              ['literal', [2, 1.5]],
              ['literal', [1, 0]],
            ],
          },
        },
        {
          id: `${SOURCE}-cut`,
          type: 'circle',
          source: SOURCE,
          filter: ['==', ['geometry-type'], 'Point'],
          paint: {
            'circle-radius': 7,
            'circle-color': 'rgba(0, 0, 0, 0)',
            'circle-stroke-width': 3,
            'circle-stroke-color': themeColor('danger'),
          },
        },
      ];
    },
  });
</script>
