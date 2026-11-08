<!-- Pictures of the view from public map services (view-picture.ts) over the map: one from each
     service whose area is in view, asked for when the map settles at a zoom where what they show
     can be read. While the next comes, the last stays where it was; without a connection, or
     zoomed out, there is none. -->
<script lang="ts">
  import type { LayerSpecification, Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import { mapBounds } from '../geometry.ts';
  import { useOverlay, type MapImage, type OverlayLevel } from '../overlay.svelte.ts';
  import { TRANSPARENT_IMAGE_URL } from '../tiles/empty-tiles.ts';
  import type { Bounds } from '../tiles/math.ts';
  import { servicesIn, viewPicture, type ViewService } from './view-picture.ts';

  interface Props {
    map: MapLibreMap;
    /** Where on the map, among our overlays, the pictures go. */
    level: OverlayLevel;
    services: readonly ViewService[];
    /** Below this zoom, no picture is asked for: what they show could not be read. */
    minZoom: number;
    opacity: number;
  }

  let { map, level, services, minZoom, opacity }: Props = $props();

  const NOTHING: MapImage = {
    url: TRANSPARENT_IMAGE_URL,
    coordinates: [
      [0, 0.001],
      [0.001, 0.001],
      [0.001, 0],
      [0, 0],
    ],
  };

  const sourceOf = (service: ViewService) => `tesel-${level}-${service.id}`;

  /** Each service's picture of the view, from a URL of our own made from the bytes downloaded. */
  const pictures = new SvelteMap<string, MapImage>();

  function show(service: ViewService, next: MapImage | null): void {
    const last = pictures.get(service.id);
    if (next) pictures.set(service.id, next);
    else pictures.delete(service.id);
    if (last) URL.revokeObjectURL(last.url);
  }

  async function fetchPicture(
    service: ViewService,
    view: Bounds,
    signal: AbortSignal,
  ): Promise<MapImage | null> {
    const canvas = map.getCanvas();
    const request = viewPicture(service, view, canvas.clientWidth, canvas.clientHeight);
    try {
      const response = await fetch(request.url, { signal });
      // The services answer errors with a document, not a picture.
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) return null;
      const url = URL.createObjectURL(await response.blob());
      return { url, coordinates: request.coordinates };
    } catch {
      return null;
    }
  }

  onMount(() => {
    let request = new AbortController();
    const refresh = () => {
      request.abort();
      request = new AbortController();
      const { signal } = request;
      const view = mapBounds(map);
      const inView = map.getZoom() >= minZoom ? servicesIn(services, view) : [];
      for (const service of services) {
        if (!inView.includes(service)) {
          show(service, null);
          continue;
        }
        void fetchPicture(service, view, signal).then((next) => {
          if (!signal.aborted) show(service, next);
          else if (next) URL.revokeObjectURL(next.url);
        });
      }
    };
    refresh();
    map.on('moveend', refresh);
    return () => {
      map.off('moveend', refresh);
      request.abort();
      for (const service of services) show(service, null);
    };
  });

  // An overlay's level and sources are its own for its life; the layer is shown with fixed ones.
  const fixed = untrack(() => ({ level, services }));

  useOverlay(() => map, {
    level: fixed.level,
    data: Object.fromEntries(
      fixed.services.map((service) => [
        sourceOf(service),
        () => pictures.get(service.id) ?? NOTHING,
      ]),
    ),
    visible: () => pictures.size > 0,
    layers: () =>
      services.map((service): LayerSpecification => ({
        id: sourceOf(service),
        type: 'raster',
        source: sourceOf(service),
        paint: { 'raster-opacity': opacity, 'raster-fade-duration': 0 },
      })),
  });
</script>
