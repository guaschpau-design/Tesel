<!-- On the urban map, a tap on a building opens what is known of it (building.ts, ADR-0158,
     ADR-0161) in the panel of its point; with a panel already open, the tap closes it, as a tap
     on the map's empty ground does. Draws nothing itself. -->
<script lang="ts">
  import type { MapGeoJSONFeature, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { NAMES_SOURCE } from '../map/style/topo.ts';
  import { textProperty, type MapTaps } from '../map/taps.ts';
  import { closePanel, openPanel, panels } from '../ui/panels.svelte.ts';
  import { buildingFacts, type ArchivedBuilding, type HouseNumber } from './building.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
    taps: MapTaps;
  }

  let { t, map, taps }: Props = $props();

  /** The layers of buildings (map/style/buildings.ts): flat, and raised in 3D. */
  const LAYERS = ['buildings', 'buildings-3d'];

  /** A building tapped, as the archive keeps it: one in several parts as several polygons. */
  function archived(feature: MapGeoJSONFeature): ArchivedBuilding {
    const { geometry } = feature;
    const number = (name: string) => {
      const value: unknown = feature.properties[name];
      return typeof value === 'number' ? value : null;
    };
    return {
      polygons:
        geometry.type === 'Polygon'
          ? [geometry.coordinates]
          : geometry.type === 'MultiPolygon'
            ? geometry.coordinates
            : [],
      height: number('height'),
      floors: number('num_floors'),
      class: textProperty(feature, 'class'),
      source: textProperty(feature, '@geometry_source'),
    };
  }

  /**
   * Whether the map's tile holds the whole building. A tile keeps a building cut at its edge, a
   * little past it: its points, in the tile's own units, then reach outside the tile. They are read
   * from the feature as the tile has it, which MapLibre keeps with each feature it hands out.
   */
  function wholeInTile(feature: MapGeoJSONFeature): boolean {
    // MapLibre's own, not promised: a version without it leaves the ground covered untold.
    const tile = feature._vectorTileFeature as MapGeoJSONFeature['_vectorTileFeature'] | undefined;
    if (tile === undefined) return false;
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
    const building = archived(feature);
    const facts = buildingFacts(building, wholeInTile(feature), houseNumbers());
    const outer = building.polygons[0]?.[0] ?? [];
    if (outer.length === 0) return;
    // Its middle, roughly: where the way there and the panel's point go.
    const lon = outer.reduce((sum, [x = 0]) => sum + x, 0) / outer.length;
    const lat = outer.reduce((sum, [, y = 0]) => sum + y, 0) / outer.length;
    openPanel({ name: 'point', at: { lat, lon }, title: t('building'), building: facts });
  }

  onMount(() => taps.onFeature(LAYERS, tapped));
</script>
