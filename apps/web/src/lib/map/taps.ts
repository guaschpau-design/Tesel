// Taps on the map, each handed to one owner. A tool in use, such as drawing or measuring, takes
// every tap. Otherwise the tap goes to the owner of the feature drawn on top where it landed: the
// map is asked what it renders there, topmost first; a tap on no feature is a tap on the place.
// Handlers of their own on the map would be called in the order they were added, so a task under
// a member could take a tap meant for the member. A fingertip is wider than a dot on the map, so a
// tap counts within a few pixels of a feature.

import type { LatLon } from '@tesel/protocol';
import type { MapGeoJSONFeature, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';

/** How far from a feature a tap still hits it, in CSS pixels. */
const REACH_PX = 12;

type FeatureHandler = (feature: MapGeoJSONFeature) => void;
type PointHandler = (at: LatLon) => void;

export class MapTaps {
  /** Who owns the features of each of our layers, by layer ID. */
  readonly #owners = new Map<string, FeatureHandler>();
  /** Tools that take every tap, the latest last: it is the one in use. */
  #tools: PointHandler[] = [];
  /** Who takes a tap on no feature. */
  #place: PointHandler | null = null;
  readonly #featuresTappable: () => boolean;

  /**
   * @param featuresTappable Whether a tap may open a feature now: not while something else uses
   * the map's taps, such as a drawing being described.
   */
  constructor(featuresTappable: () => boolean) {
    this.#featuresTappable = featuresTappable;
  }

  /** Hands the map's taps out until the returned function is called. */
  listen(map: MapLibreMap): () => void {
    map.on('click', this.#onTap);
    return () => {
      map.off('click', this.#onTap);
    };
  }

  /** Hands taps on the features of `layers` to `handler` until the returned function is called. */
  onFeature(layers: readonly string[], handler: FeatureHandler): () => void {
    for (const layer of layers) this.#owners.set(layer, handler);
    return () => {
      for (const layer of layers) this.#owners.delete(layer);
    };
  }

  /** Hands taps on no feature to `handler` until the returned function is called. */
  onPlace(handler: PointHandler): () => void {
    this.#place = handler;
    return () => {
      if (this.#place === handler) this.#place = null;
    };
  }

  /**
   * Hands every tap to `handler`, and none to features, until the returned function is called: for
   * a tool that adds points where the map is tapped.
   */
  takeAll(handler: PointHandler): () => void {
    this.#tools = [...this.#tools, handler];
    return () => {
      this.#tools = this.#tools.filter((tool) => tool !== handler);
    };
  }

  readonly #onTap = (event: MapMouseEvent): void => {
    const tool = this.#tools.at(-1);
    if (tool !== undefined) {
      tool({ lat: event.lngLat.lat, lon: event.lngLat.lng });
      return;
    }
    if (!this.#featuresTappable()) return;
    const feature = topmostFeature(event, [...this.#owners.keys()]);
    if (feature !== null) this.#owners.get(feature.layer.id)?.(feature);
    else this.#place?.({ lat: event.lngLat.lat, lon: event.lngLat.lng });
  };
}

/**
 * The topmost feature of `layers` drawn under the tap, if any. A layer switched off is left out at
 * once, not only once the map has drawn it away.
 */
function topmostFeature(event: MapMouseEvent, layers: readonly string[]): MapGeoJSONFeature | null {
  const map = event.target;
  const present = layers.filter(
    (id) => map.getLayer(id) !== undefined && map.getLayoutProperty(id, 'visibility') !== 'none',
  );
  if (present.length === 0) return null;
  const { x, y } = event.point;
  const box: [[number, number], [number, number]] = [
    [x - REACH_PX, y - REACH_PX],
    [x + REACH_PX, y + REACH_PX],
  ];
  return map.queryRenderedFeatures(box, { layers: present })[0] ?? null;
}

/** A feature's property, if it is text. */
export function textProperty(feature: MapGeoJSONFeature, name: string): string | null {
  const value: unknown = feature.properties[name];
  return typeof value === 'string' ? value : null;
}
