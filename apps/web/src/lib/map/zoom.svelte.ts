// The map's zoom as state, for what is drawn at a size on screen rather than on the ground: read
// when a component starts and after each zoom, not on every frame of one.

import type { Map as MapLibreMap } from 'maplibre-gl';

/** Follows `map`'s zoom while the calling component lives. */
export function useZoom(map: () => MapLibreMap): { readonly value: number } {
  const zoom = $state({ value: map().getZoom() });
  $effect(() => {
    const current = map();
    const zoomed = () => {
      zoom.value = current.getZoom();
    };
    zoomed();
    current.on('zoomend', zoomed);
    return () => {
      current.off('zoomend', zoomed);
    };
  });
  return zoom;
}
