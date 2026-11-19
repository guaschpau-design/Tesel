<!-- What can be seen from a point of the map (viewshed.ts, ADR-0152): within the radius, the ground
     in sight in green, the rest darkened. Worked out as it is shown, and again for a new point;
     `onstate` tells how it went. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { viewshed, type Heights, type ViewshedState } from './viewshed.ts';

  interface Props {
    map: MapLibreMap;
    from: LatLon;
    heights: Heights;
    onstate: (state: Exclude<ViewshedState, 'off'>) => void;
  }

  let { map, from, heights, onstate }: Props = $props();

  const SOURCE = 'tesel-viewshed';
  const NOTHING: FeatureCollection = { type: 'FeatureCollection', features: [] };

  let shown: FeatureCollection = $state.raw(NOTHING);

  $effect(() => {
    let current = true;
    onstate('working');
    shown = NOTHING;
    void viewshed(heights, from).then((result) => {
      if (!current) return;
      shown = result ?? NOTHING;
      onstate(result === null ? 'unknown' : 'shown');
    });
    return () => {
      current = false;
    };
  });

  useOverlay(() => map, {
    level: 'point',
    data: { [SOURCE]: () => shown },
    layers: () => [
      {
        id: `${SOURCE}-hidden`,
        type: 'fill',
        source: SOURCE,
        filter: ['!', ['get', 'seen']],
        paint: { 'fill-color': themeColor('map-text'), 'fill-opacity': 0.25 },
      },
      {
        id: `${SOURCE}-seen`,
        type: 'fill',
        source: SOURCE,
        filter: ['get', 'seen'],
        // No antialiasing: the pieces meet edge to edge, and their edges would show as lines.
        paint: {
          'fill-color': themeColor('signal'),
          'fill-opacity': 0.45,
          'fill-antialias': false,
        },
      },
    ],
  });
</script>
