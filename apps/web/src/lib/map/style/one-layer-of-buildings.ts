// One layer of buildings on the flat map (ADR-0149). In Spain the cadastre's buildings
// (cadastre.ts) are every building, where it stands; OpenStreetMap's, traced by hand over
// photographs, often sit a few metres off, and drawn together each building showed twice, one
// over the other. So while the view is in Spain, reaches no other country's outline and shows the
// cadastre's buildings, OpenStreetMap's flat buildings are hidden. Elsewhere they are the only
// ones, and so they stay; where the cadastre cannot be had, offline in an area downloaded without
// it or with IGN's service down, they stay too; and raised in 3D they stay everywhere, for their
// heights. It is decided each time the map settles, once its tiles are drawn.

import type { Map as MapLibreMap } from 'maplibre-gl';

import { outlineCoverage } from '../geometry.ts';
import type { Outline } from '../tiles/borders-data.ts';
import type { Bounds } from '../tiles/math.ts';
import { CADASTRE_MIN_ZOOM } from './cadastre.ts';

/** OpenStreetMap's flat buildings, and the urban map's edge round them (urban.ts). */
const OSM_FLAT_BUILDINGS = ['buildings', 'buildings-edge'];
/** A layer of the cadastre's: present only on the maps that draw it. */
const CADASTRE_LAYER = 'cadastre-buildings';

export interface Outlines {
  readonly spain: Outline;
  /** The other countries whose outlines the app has, each with OpenStreetMap's buildings only. */
  readonly others: readonly Outline[];
}

/** Whether OpenStreetMap's flat buildings are hidden for a view close enough for the cadastre. */
export function osmBuildingsHidden(view: Bounds, outlines: Outlines): boolean {
  return (
    outlineCoverage(outlines.spain, view) !== 'none' &&
    outlines.others.every((outline) => outlineCoverage(outline, view) === 'none')
  );
}

/** The outlines, loaded once, the first time a view needs them: they weigh some 250 kB. */
let loading: Promise<Outlines> | null = null;
function outlines(): Promise<Outlines> {
  loading ??= import('../tiles/borders-data.ts').then(({ SPAIN, PORTUGAL, FRANCE_SOUTH }) => ({
    spain: SPAIN,
    others: [PORTUGAL, FRANCE_SOUTH],
  }));
  return loading;
}

/** Keeps one layer of buildings on `map` as it moves and restyles, until the returned call. */
export function keepOneLayerOfBuildings(map: MapLibreMap): () => void {
  let latest = 0;
  const update = async () => {
    if (map.getLayer(CADASTRE_LAYER) === undefined) return;
    const ask = ++latest;
    const bounds = map.getBounds();
    const view = {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };
    // Further out, or where its tiles are empty or missing, the cadastre draws nothing, and the
    // outlines need not load.
    const cadastre =
      map.getZoom() >= CADASTRE_MIN_ZOOM &&
      map.queryRenderedFeatures({ layers: [CADASTRE_LAYER] }).length > 0;
    const hidden = cadastre && osmBuildingsHidden(view, await outlines());
    // A later move, or a new style, decides instead.
    if (ask !== latest) return;
    const visibility = hidden ? 'none' : 'visible';
    for (const id of OSM_FLAT_BUILDINGS) {
      if (
        map.getLayer(id) !== undefined &&
        map.getLayoutProperty(id, 'visibility') !== visibility
      ) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    }
  };
  const run = () => {
    void update();
  };
  // After a move, new tiles or a new style, which draws OpenStreetMap's buildings again.
  map.on('idle', run);
  return () => {
    map.off('idle', run);
  };
}
