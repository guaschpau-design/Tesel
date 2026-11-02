<!-- The regions under an official weather warning, beneath everything else on the map. They are
     drawn unlike the group's own areas, which are filled flat with a thick edge: a thin edge in the
     colour of their level, a band of that colour fading inwards along it, and a cloud on a rounded
     square, the sign of official warnings (map/style/glyph-images.ts). Seen from afar they are
     hatched as well, to find them at a glance; the hatching fades out on zooming in, so the inside
     of a region stays clear to work on (ADR-0100). Dashes are left to what is being drawn. -->
<script lang="ts">
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import { addGlyphImage, addHatchImage } from '../map/style/glyph-images.ts';
  import { useOverlay } from '../map/overlay.svelte.ts';
  import { GLYPHS } from '../ui/glyphs.ts';
  import { toneColor, toneExpression } from '../ui/theme.ts';
  import {
    regionEdges,
    regionFeatures,
    WARNING_LOOKS,
    type ActiveRegion,
  } from './weather-warnings.ts';

  interface Props {
    map: MapLibreMap;
    regions: readonly ActiveRegion[];
    visible: boolean;
  }

  let { map, regions, visible }: Props = $props();

  const SOURCE = 'tesel-weather';
  const EDGES = 'tesel-weather-edges';
  const HATCH = 'tesel-weather-hatch-';
  const ICON = 'tesel-weather-icon-';
  const tones = Object.values(WARNING_LOOKS).map((look) => look.tone);

  /** Zoom levels between which the hatching fades out: from a province to a town. */
  const HATCH_SHOWN_UNTIL = 9;
  const HATCH_GONE_AT = 11.5;

  /** The band inside the edge, in pixels: a wide faint part and a narrow stronger one. */
  const BAND_WIDE = 20;
  const BAND_NARROW = 7;

  useOverlay(() => map, {
    level: 'weather',
    data: {
      [SOURCE]: () => regionFeatures(regions),
      [EDGES]: () => regionEdges(regions),
    },
    visible: () => visible,
    prepare: () => {
      for (const tone of tones) {
        addHatchImage(map, `${HATCH}${tone}`, toneColor(tone));
        addGlyphImage(map, `${ICON}${tone}`, {
          glyph: GLYPHS.cloud,
          colour: toneColor(tone),
          shape: 'square',
        });
      }
    },
    layers: () => [
      {
        id: 'tesel-weather-fill',
        type: 'fill',
        source: SOURCE,
        paint: {
          'fill-pattern': ['concat', HATCH, ['get', 'tone']],
          'fill-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            HATCH_SHOWN_UNTIL,
            1,
            HATCH_GONE_AT,
            0,
          ],
        },
      },
      // Edges run with their region on the right (regionEdges), so a positive offset is inwards.
      {
        id: 'tesel-weather-band',
        type: 'line',
        source: EDGES,
        paint: {
          'line-color': toneExpression(),
          'line-width': BAND_WIDE,
          'line-offset': BAND_WIDE / 2,
          'line-blur': BAND_WIDE / 3,
          'line-opacity': 0.18,
        },
      },
      {
        id: 'tesel-weather-band-inner',
        type: 'line',
        source: EDGES,
        paint: {
          'line-color': toneExpression(),
          'line-width': BAND_NARROW,
          'line-offset': BAND_NARROW / 2,
          'line-opacity': 0.3,
        },
      },
      {
        id: 'tesel-weather-line',
        type: 'line',
        source: EDGES,
        paint: { 'line-color': toneExpression(), 'line-width': 1.5, 'line-opacity': 0.9 },
      },
      {
        id: 'tesel-weather-icon',
        type: 'symbol',
        source: SOURCE,
        layout: { 'icon-image': ['concat', ICON, ['get', 'tone']], 'icon-size': 0.9 },
      },
    ],
  });
</script>
