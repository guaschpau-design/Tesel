<!-- On the urban map, a tap on a building opens what is known of it (building.ts, ADR-0158) in the
     panel of its point; with a panel already open, the tap closes it, as a tap on the map's empty
     ground does. Draws nothing itself. -->
<script lang="ts">
  import type { MapGeoJSONFeature, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { NAMES_SOURCE } from '../map/style/topo.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';
  import { closePanel, openPanel, panels } from '../ui/panels.svelte.ts';
  import { buildingFacts, type BuildingPiece, type HouseNumber } from './building.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
    taps: MapTaps;
  }

  let { t, map, taps }: Props = $props();

  /** The base map's layers of buildings: flat, and raised in 3D. */
  const LAYERS = ['buildings', 'buildings-3d'];

  /** The pieces of a feature: a building in several parts comes as several polygons. */
  function piecesOf(feature: MapGeoJSONFeature): BuildingPiece[] {
    const { geometry } = feature;
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.type === 'MultiPolygon'
          ? geometry.coordinates
          : [];
    const height: unknown = feature.properties['height'];
    return polygons.map((rings) => ({
      rings,
      height: typeof height === 'number' ? height : null,
      number: textProperty(feature, 'addr_housenumber'),
    }));
  }

  /** IGN's house numbers loaded on the map, where its map is drawn. */
  function houseNumbers(): HouseNumber[] {
    if (map.getSource(NAMES_SOURCE) === undefined) return [];
    return map
      .querySourceFeatures(NAMES_SOURCE, { sourceLayer: 'portal_pto' })
      .flatMap((feature) => {
        const ref: unknown = feature.properties['ref'];
        if (typeof ref !== 'string' || feature.geometry.type !== 'Point') return [];
        // CartoCiudad marks a number given twice with "DUPL": the number is the same.
        const number = ref.replace(/\s*DUPL$/, '');
        const [lon = 0, lat = 0] = feature.geometry.coordinates;
        return [{ ref: number, at: { lat, lon } }];
      });
  }

  function tapped(feature: MapGeoJSONFeature): void {
    if (panels.open !== null) {
      closePanel();
      return;
    }
    // The same building in each tile the map cuts it into.
    const pieces =
      feature.id === undefined
        ? piecesOf(feature)
        : map
            .queryRenderedFeatures({
              layers: [feature.layer.id],
              filter: ['==', ['id'], feature.id],
            })
            .flatMap(piecesOf);
    const building = buildingFacts(pieces, houseNumbers());
    const outer = pieces[0]?.rings[0] ?? [];
    if (outer.length === 0) return;
    // Its middle, roughly: where the way there and the panel's point go.
    const lon = outer.reduce((sum, [x = 0]) => sum + x, 0) / outer.length;
    const lat = outer.reduce((sum, [, y = 0]) => sum + y, 0) / outer.length;
    openPanel({ name: 'point', at: { lat, lon }, title: t('building'), building });
  }

  onMount(() => taps.onFeature(LAYERS, tapped));
</script>
