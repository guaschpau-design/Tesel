// Whether the ground is raised in 3D (ADR-0102, ADR-0106): off whenever the app opens, since it
// costs the phone more battery and warmth, and turned off again when the screen rests
// (power/activity). How it is seen: leaning far back, and raised more from afar than up close.

import type { Map as MapLibreMap } from 'maplibre-gl';

/** How far the view leans back to show the raised ground, in degrees from straight down. */
const GROUND_PITCH = 75;
/** How far two fingers may lean it while raised: nearly eye level. Flat, MapLibre's own 60°. */
const GROUND_MAX_PITCH = 80;

/** Raised twice its height across a district, so gentle hills show; nearer its own up close. */
const FAR = { zoom: 9, exaggeration: 2 };
const NEAR = { zoom: 15, exaggeration: 1.3 };

/** How many times its height the ground is raised at `zoom`. */
export function groundExaggeration(zoom: number): number {
  const along = Math.min(1, Math.max(0, (zoom - FAR.zoom) / (NEAR.zoom - FAR.zoom)));
  return FAR.exaggeration + (NEAR.exaggeration - FAR.exaggeration) * along;
}

class Ground {
  /** The ground raised in 3D, the map leaning back to show it. */
  raised = $state(false);
}

export const ground = new Ground();

/** Raises the ground and leans the map back to show it, or lays both flat again. */
export function setGround(map: MapLibreMap, raised: boolean): void {
  // Already so: the map is left where the user has it.
  if (ground.raised === raised) return;
  ground.raised = raised;
  if (raised) map.setMaxPitch(GROUND_MAX_PITCH);
  map.easeTo({ pitch: raised ? GROUND_PITCH : 0 });
  // Back to MapLibre's own limit once the map lies flat, so that it does not cut the ease short.
  if (!raised) {
    map.once('moveend', () => {
      if (!ground.raised) map.setMaxPitch(null);
    });
  }
}

/**
 * The layers MapLibre drapes over raised ground, drawn onto it as pictures, one per tile: flat
 * ones such as fills, lines and the relief. Each run of them between other layers (names, dots,
 * buildings) takes pictures of its own, so a map that mixes them took several times the memory
 * and a phone could close the page (ADR-0163).
 */
const DRAPED = new Set(['background', 'fill', 'line', 'raster', 'hillshade', 'color-relief']);

/**
 * With the ground raised, keeps every draped layer under all the others, each group in its order,
 * so the ground takes one picture per tile. The flat map, a style of its own, keeps its order.
 * Our overlays come back after every new style, so this is done again whenever the style
 * changes, just after the frame, as overlays are (overlay.svelte.ts).
 */
export function keepDrapedTogether(map: MapLibreMap): () => void {
  let queued = false;
  const arrange = () => {
    queued = false;
    if (map.getTerrain() === null) return;
    const order = map.getLayersOrder();
    const draped = (id: string) => DRAPED.has(map.getLayer(id)?.type ?? '');
    const lastDraped = order.findLastIndex(draped);
    const firstOther = order.findIndex((id) => !draped(id));
    if (firstOther === -1 || firstOther > lastDraped) return;
    // Every other layer to the top, in its order: the draped ones are left together below.
    for (const id of order.filter((layer) => !draped(layer))) map.moveLayer(id);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(arrange);
  };
  map.on('styledata', queue);
  map.on('idle', queue);
  queue();
  return () => {
    map.off('styledata', queue);
    map.off('idle', queue);
  };
}
