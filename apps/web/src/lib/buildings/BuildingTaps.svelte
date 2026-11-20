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

  /**
   * Whether the map's tile holds the whole building. A tile keeps a building cut at its edge, a
   * little past it: its points, in the tile's own units, then reach outside the tile. They are read
   * from the feature as the tile has it, which MapLibre keeps with each feature it hands out.
   */
  function wholeInTile(feature: MapGeoJSONFeature): boolean {
    const tile = feature._vectorTileFeature;
    const { extent } = tile;
    return tile
      .loadGeometry()
      .every((ring) => ring.every(({ x, y }) => x >= 0 && x <= extent && y >= 0 && y <= extent));
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
    const pieces = piecesOf(feature);
    // A part of a building, as OpenStreetMap draws a tower or a wing apart, has its own height,
    // but the ground it covers is not the building's.
    const part = textProperty(feature, 'kind') === 'building_part';
    const building = buildingFacts(pieces, !part && wholeInTile(feature), houseNumbers());
    const outer = pieces[0]?.rings[0] ?? [];
    if (outer.length === 0) return;
    // Its middle, roughly: where the way there and the panel's point go.
    const lon = outer.reduce((sum, [x = 0]) => sum + x, 0) / outer.length;
    const lat = outer.reduce((sum, [, y = 0]) => sum + y, 0) / outer.length;
    openPanel({ name: 'point', at: { lat, lon }, title: t('building'), building });
  }

  onMount(() => taps.onFeature(LAYERS, tapped));
</script>
