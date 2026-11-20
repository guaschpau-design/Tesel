<!-- The building whose panel is open (ADR-0158), outlined on the map in the app's own colour. -->
<script lang="ts">
  import type { FeatureCollection, Polygon } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import type { BuildingFacts } from './building.ts';

  interface Props {
    map: MapLibreMap;
    building: BuildingFacts;
  }

  let { map, building }: Props = $props();

  const SOURCE = 'tesel-building';

  const outline = $derived<FeatureCollection<Polygon>>({
    type: 'FeatureCollection',
    features: building.outline.map((coordinates) => ({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates },
      properties: {},
    })),
  });

  useOverlay(() => map, {
    level: 'point',
    data: { [SOURCE]: () => outline },
    layers: () => [
      {
        id: `${SOURCE}-fill`,
        type: 'fill',
        source: SOURCE,
        paint: { 'fill-color': themeColor('signal'), 'fill-opacity': 0.35 },
      },
      {
        id: `${SOURCE}-edge`,
        type: 'line',
        source: SOURCE,
        layout: { 'line-join': 'round' },
        paint: { 'line-color': themeColor('map-text'), 'line-width': 2.5 },
      },
    ],
  });
</script>
