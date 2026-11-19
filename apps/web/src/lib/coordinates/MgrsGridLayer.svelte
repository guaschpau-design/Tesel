<!-- The MGRS grid over the map, worked out again for the view each time the map stops moving:
     thin lines with their digits, the 100 km squares named, and the edges of UTM zones. On the
     tactical map the digits are at the screen's edges instead, as a military map prints them in
     its margins, and follow them as the map moves (ADR-0141). -->
<script lang="ts">
  import type { FeatureCollection } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { mapBounds } from '../map/geometry.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { themeColor } from '../ui/theme.ts';
  import { gridEdgeLabels } from './grid-edges.ts';
  import { mgrsGrid } from './mgrs-grid.ts';

  interface Props {
    map: MapLibreMap;
    /** The digits at the screen's edges rather than along the lines. */
    edges: boolean;
  }

  let { map, edges }: Props = $props();

  const SOURCE = 'tesel-mgrs';
  const EDGES = 'tesel-mgrs-edges';
  const NONE: FeatureCollection = { type: 'FeatureCollection', features: [] };
  let grid: FeatureCollection = $state.raw(NONE);
  let edgeLabels: FeatureCollection = $state.raw(NONE);
  /** The frame the edge digits are due to be placed in, while one is asked for. */
  let frame: number | null = null;

  function update(): void {
    grid = mgrsGrid({ ...mapBounds(map), zoom: map.getZoom() });
    placeEdgeLabels();
  }

  function placeEdgeLabels(): void {
    if (!edges) {
      edgeLabels = NONE;
      return;
    }
    const canvas = map.getCanvas();
    edgeLabels = gridEdgeLabels(grid, {
      width: canvas.clientWidth,
      height: canvas.clientHeight,
      project: ([lon, lat]) => map.project([lon, lat]),
      unproject: ({ x, y }) => {
        const place = map.unproject([x, y]);
        return [place.lng, place.lat];
      },
    });
  }

  /** As the map moves, the digits follow the edges, once a frame. */
  function follow(): void {
    if (!edges || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      placeEdgeLabels();
    });
  }

  onMount(() => {
    update();
    map.on('moveend', update);
    map.on('move', follow);
    return () => {
      map.off('moveend', update);
      map.off('move', follow);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  });

  useOverlay(() => map, {
    level: 'grid',
    data: { [SOURCE]: () => grid, [EDGES]: () => edgeLabels },
    layers: () => {
      const text = themeColor('map-text');
      const halo = themeColor('map-halo');
      const lines = themeColor('map-grid');
      const labels = {
        'text-color': text,
        'text-halo-color': halo,
        'text-halo-width': 1.5,
      };
      return [
        {
          id: `${SOURCE}-lines`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['get', 'kind'], 'line'],
          paint: { 'line-color': lines, 'line-width': 1, 'line-opacity': 0.45 },
        },
        {
          id: `${SOURCE}-zones`,
          type: 'line',
          source: SOURCE,
          filter: ['==', ['get', 'kind'], 'zone'],
          paint: { 'line-color': lines, 'line-width': 2, 'line-opacity': 0.7 },
        },
        {
          id: `${SOURCE}-line-labels`,
          type: 'symbol',
          source: SOURCE,
          filter: edges
            ? ['==', ['get', 'kind'], 'none']
            : ['all', ['==', ['get', 'kind'], 'line'], ['!=', ['get', 'label'], '']],
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 300,
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 11,
          },
          paint: labels,
        },
        {
          id: `${EDGES}-labels`,
          type: 'symbol',
          source: EDGES,
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 12,
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: { ...labels, 'text-color': lines, 'text-halo-width': 2 },
        },
        {
          id: `${SOURCE}-squares`,
          type: 'symbol',
          source: SOURCE,
          filter: ['==', ['get', 'kind'], 'square'],
          layout: {
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Medium'],
            'text-size': 14,
          },
          paint: { ...labels, 'text-opacity': 0.8 },
        },
      ];
    },
  });
</script>
