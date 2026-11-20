<!-- On the topographic map, the heights of the mountains and passes IGN names (summits.ts,
     ADR-0155): a summit's under a small triangle at its highest ground, a pass's beside a dot, as
     paper maps mark them. Read for what the map shows once it stops, from zoom 13. -->
<script lang="ts">
  import type { Feature, FeatureCollection, Point } from 'geojson';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { toPosition } from '../map/geometry.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { NAMES_SOURCE } from '../map/style/topo.ts';
  import { themeColor } from '../ui/theme.ts';
  import type { Heights } from './elevation.ts';
  import { SummitMarks, type NamedHeight, type SummitMark } from './summits.ts';

  interface Props {
    map: MapLibreMap;
    heights: Heights;
  }

  let { map, heights }: Props = $props();

  const SOURCE = 'tesel-summits';
  const SUMMIT_IMAGE = 'tesel-summit';
  const PASS_IMAGE = 'tesel-pass';
  const MIN_ZOOM = 13;
  /** IGN's classes of the names that get a height. */
  const SUMMIT = 'montaña';
  const PASS = 'paso_montaña';
  const PIXEL_RATIO = 2;

  const summits = $derived(new SummitMarks(heights));
  let marked: readonly SummitMark[] = $state.raw([]);

  /** The mountains and passes named where the map shows, as many times as IGN's tiles have them. */
  function namedInView(): NamedHeight[] {
    const named: NamedHeight[] = [];
    if (map.getZoom() < MIN_ZOOM || map.getSource(NAMES_SOURCE) === undefined) return named;
    const features = map.querySourceFeatures(NAMES_SOURCE, {
      sourceLayer: 'nombre_orografia_pto',
      filter: ['in', ['get', 'clase'], ['literal', [SUMMIT, PASS]]],
    });
    const bounds = map.getBounds();
    for (const feature of features) {
      if (feature.geometry.type !== 'Point') continue;
      const [lon = 0, lat = 0] = feature.geometry.coordinates;
      if (!bounds.contains([lon, lat])) continue;
      const pass = feature.properties['clase'] === PASS;
      const key = `${String(feature.properties['nombre'])}@${lon.toFixed(4)},${lat.toFixed(4)}`;
      named.push({ key, at: { lat, lon }, pass });
    }
    return named;
  }

  /** Each look at the map counts; an older one finishing later is not drawn. */
  let looks = 0;

  async function update(): Promise<void> {
    const look = ++looks;
    const found = await summits.marks(namedInView());
    if (look === looks) marked = found;
  }

  /** Once the map has stopped, or IGN's tiles have come, a moment after: they come in bursts. */
  let waiting: ReturnType<typeof setTimeout> | undefined;
  function soon(): void {
    clearTimeout(waiting);
    waiting = setTimeout(() => void update(), 200);
  }

  /** IGN's tiles arriving after the map stopped: their names count too. */
  function sourceLoaded(event: { sourceId?: string; isSourceLoaded?: boolean }): void {
    if (event.sourceId === NAMES_SOURCE && event.isSourceLoaded === true) soon();
  }

  onMount(() => {
    map.on('moveend', soon);
    map.on('sourcedata', sourceLoaded);
    soon();
    return () => {
      clearTimeout(waiting);
      map.off('moveend', soon);
      map.off('sourcedata', sourceLoaded);
    };
  });

  const features = $derived<FeatureCollection<Point>>({
    type: 'FeatureCollection',
    features: marked.map((height): Feature<Point> => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: toPosition(height.at) },
      properties: { metres: height.metres, pass: height.pass },
    })),
  });

  /** A mark of `size` pixels, drawn in the ink of the contour lines over a light edge. */
  function addMark(name: string, draw: (c: CanvasRenderingContext2D) => void): void {
    if (map.hasImage(name)) return;
    const size = 10;
    const canvas = document.createElement('canvas');
    canvas.width = size * PIXEL_RATIO;
    canvas.height = size * PIXEL_RATIO;
    const c = canvas.getContext('2d');
    if (c === null) return;
    c.scale(PIXEL_RATIO, PIXEL_RATIO);
    c.fillStyle = themeColor('map-terrain');
    c.strokeStyle = themeColor('map-halo');
    c.lineWidth = 1.5;
    c.lineJoin = 'round';
    c.beginPath();
    draw(c);
    c.closePath();
    c.stroke();
    c.fill();
    map.addImage(name, c.getImageData(0, 0, canvas.width, canvas.height), {
      pixelRatio: PIXEL_RATIO,
    });
  }

  useOverlay(() => map, {
    level: 'summits',
    data: { [SOURCE]: () => features },
    prepare: () => {
      addMark(SUMMIT_IMAGE, (c) => {
        c.moveTo(5, 1.5);
        c.lineTo(9, 8.5);
        c.lineTo(1, 8.5);
      });
      addMark(PASS_IMAGE, (c) => {
        c.arc(5, 5, 2.5, 0, 2 * Math.PI);
      });
    },
    layers: () => [
      {
        id: `${SOURCE}-heights`,
        type: 'symbol',
        source: SOURCE,
        minzoom: MIN_ZOOM,
        layout: {
          'icon-image': ['case', ['get', 'pass'], PASS_IMAGE, SUMMIT_IMAGE],
          'text-field': ['to-string', ['get', 'metres']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10.5,
          'text-anchor': 'left',
          'text-offset': [0.6, 0],
          // The mark tells where; the height may give way to a name.
          'text-optional': true,
        },
        paint: {
          'text-color': themeColor('map-terrain'),
          'text-halo-color': themeColor('map-halo'),
          'text-halo-width': 1.4,
        },
      },
    ],
  });
</script>
