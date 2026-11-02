// For tests: just enough of a MapLibre map for our overlays, taps and framing. Sources, layers in
// drawing order, events fired at once as MapLibre does, the data each GeoJSON source was given, the
// features a test says are drawn where the map is tapped, and a view that moves at once.

import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';

export interface FakeLayer {
  readonly id: string;
  layout?: Record<string, unknown>;
  readonly metadata?: unknown;
}

type Handler = (event?: unknown) => void;

export class FakeMap {
  readonly sources = new Map<string, unknown>();
  /** In drawing order, bottom first. */
  readonly layers = new Map<string, FakeLayer>();
  /** Every `setData` on a GeoJSON source, by source, in order. */
  readonly uploads = new Map<string, unknown[]>();
  /** The features drawn under the next tap, by layer. */
  readonly drawn = new Map<string, Record<string, unknown>>();
  /** Every `fitBounds`, in order: the bounds asked for. */
  readonly fitted: unknown[] = [];
  #view = { lat: 40.2, lon: -3.7, zoom: 5, bearing: 0 };
  readonly #handlers = new Map<string, Set<Handler>>();

  /** This fake, typed as the map the code under test takes. */
  get map(): MapLibreMap {
    return this as unknown as MapLibreMap;
  }

  on(type: string, handler: Handler): void {
    const set = this.#handlers.get(type) ?? new Set();
    set.add(handler);
    this.#handlers.set(type, set);
  }

  off(type: string, handler: Handler): void {
    this.#handlers.get(type)?.delete(handler);
  }

  fire(type: string, event?: unknown): void {
    for (const handler of this.#handlers.get(type) ?? []) handler(event);
  }

  /** A tap at a place of the map. */
  tap(lat: number, lon: number): void {
    this.fire('click', { target: this, point: { x: 100, y: 100 }, lngLat: { lat, lng: lon } });
  }

  /** Moves the map, as the user or a panel of the app would, and says so once it is there. */
  moveTo(view: Partial<FakeMap['view']>, eventData: object = {}): void {
    this.#view = { ...this.#view, ...view };
    this.fire('moveend', eventData);
  }

  get view(): { lat: number; lon: number; zoom: number; bearing: number } {
    return this.#view;
  }

  getCenter(): { lat: number; lng: number } {
    return { lat: this.#view.lat, lng: this.#view.lon };
  }

  getZoom(): number {
    return this.#view.zoom;
  }

  getBearing(): number {
    return this.#view.bearing;
  }

  /**
   * Goes to the middle of the bounds at once, a zoom deeper each time; throws as MapLibre does at
   * a latitude that is not one.
   */
  fitBounds(
    bounds: [[number, number], [number, number]],
    _options: unknown,
    eventData: object,
  ): void {
    const [[west, south], [east, north]] = bounds;
    if (![south, north].every((lat) => lat >= -90 && lat <= 90)) {
      throw new Error('Invalid LngLat latitude value: must be between -90 and 90');
    }
    this.fitted.push(bounds);
    this.moveTo(
      { lat: (south + north) / 2, lon: (west + east) / 2, zoom: this.#view.zoom + 1 },
      eventData,
    );
  }

  isStyleLoaded(): boolean {
    return true;
  }

  getSource(id: string): unknown {
    return this.sources.get(id);
  }

  addSource(id: string, source: { readonly type: string }): void {
    if (this.sources.has(id)) throw new Error(`Source "${id}" already exists.`);
    const setData = (data: unknown) =>
      this.uploads.set(id, [...(this.uploads.get(id) ?? []), data]);
    this.sources.set(id, source.type === 'geojson' ? { ...source, setData } : source);
    this.fire('styledata');
  }

  removeSource(id: string): void {
    this.sources.delete(id);
  }

  getLayer(id: string): unknown {
    return this.layers.get(id);
  }

  addLayer(layer: FakeLayer, before?: string): void {
    const ordered = [...this.layers.values()];
    const at = before === undefined ? ordered.length : ordered.findIndex((l) => l.id === before);
    ordered.splice(at, 0, layer);
    this.layers.clear();
    for (const item of ordered) this.layers.set(item.id, item);
  }

  getStyle(): { layers: FakeLayer[] } {
    return { layers: [...this.layers.values()] };
  }

  removeLayer(id: string): void {
    this.layers.delete(id);
  }

  getLayoutProperty(id: string, name: string): unknown {
    return this.layers.get(id)?.layout?.[name];
  }

  setLayoutProperty(id: string, name: string, value: unknown): void {
    const layer = this.layers.get(id);
    if (layer) layer.layout = { ...layer.layout, [name]: value };
  }

  /** The features drawn under the tap in `layers`, topmost first, as MapLibre gives them. */
  queryRenderedFeatures(_box: unknown, options: { layers: string[] }): MapGeoJSONFeature[] {
    return [...this.layers.keys()]
      .reverse()
      .filter((id) => options.layers.includes(id) && this.drawn.has(id))
      .map((id) => ({ layer: { id }, properties: this.drawn.get(id) }) as MapGeoJSONFeature);
  }
}
