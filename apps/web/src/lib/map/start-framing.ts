// Brings the group into view while the map still shows the wide view it opens on (ADR-0054). Each
// time someone or something new appears — this device's first fix, a member's position, a
// practice's teammates, an operation area — the map is framed around all there is. The first time the view changes by anything else, a
// pan, a zoom, a turn or a place shown from a panel, the user has chosen a view: framing stops for
// good. A view the address gives (#map=…) is chosen already, so framing never starts.

import type { GroupState } from '@tesel/core';
import type { LatLon, NodeId } from '@tesel/protocol';
import type { Map as MapLibreMap, MapLibreEvent } from 'maplibre-gl';

import { toPosition } from './geometry.ts';
import { STALE_AFTER_S } from '../members/member-features.ts';
import { boundsAround, type Bounds } from './tiles/math.ts';

/** Closer than this the map would show one person's street, not where the group is. */
const MAX_ZOOM = 15;
/** Room around the points, in CSS pixels, so no dot sits on the edge or under a control. */
const PADDING_PX = 64;
/**
 * A short glide, in milliseconds: MapLibre's own flight from a whole country down to a street lasts
 * several seconds, and starts over each time someone else appears.
 */
const GLIDE_MS = 1000;
/** Marks the moves of the map that framing makes, in MapLibre's event data. */
const FRAMING = 'teselFraming';

interface View {
  readonly lat: number;
  readonly lon: number;
  readonly zoom: number;
  readonly bearing: number;
}

export class StartFraming {
  readonly #map: MapLibreMap;
  /** Who has been framed: `self`, or a member's node ID. */
  readonly #framed = new Set<string>();
  /** The view framing left the map in; null once the user chose another. */
  #view: View | null;

  /** Frames on `map` only if it opened on its wide view, not on one the address gave. */
  constructor(map: MapLibreMap, openedWide: boolean) {
    this.#map = map;
    this.#view = openedWide ? viewOf(map) : null;
    if (openedWide) map.on('moveend', this.#moved);
  }

  /** Who should be in view, by who they are: frames them all if any of them is new. */
  show(points: ReadonlyMap<string, LatLon>): void {
    if (this.#view === null) return;
    const newcomers = [...points.keys()].filter((who) => !this.#framed.has(who));
    if (newcomers.length === 0) return;
    for (const who of newcomers) this.#framed.add(who);
    const { west, south, east, north } = boundsAround([...points.values()]);
    this.#map.fitBounds(
      [toPosition({ lat: south, lon: west }), toPosition({ lat: north, lon: east })],
      { padding: PADDING_PX, maxZoom: MAX_ZOOM, linear: true, duration: GLIDE_MS },
      { [FRAMING]: true },
    );
  }

  /** Stops listening to the map. */
  remove(): void {
    this.#map.off('moveend', this.#moved);
  }

  // A resize ends a "move" that leaves the view as it was: only a changed view is a choice.
  readonly #moved = (event: MapLibreEvent & { readonly [FRAMING]?: boolean }): void => {
    const now = viewOf(this.#map);
    if (event[FRAMING] === true) this.#view = now;
    else if (this.#view !== null && !sameView(this.#view, now)) {
      this.#view = null;
      this.remove();
    }
  };
}

/**
 * What framing brings into view: this device where it is, if the GPS is on for something else,
 * the other members whose positions are fresh, and the operation areas, by their corners, so that
 * a member who has just joined sees where the group works. An old position says little of where
 * the group is now.
 */
export function groupPoints(
  positions: GroupState['positions'],
  self: NodeId | null,
  fix: LatLon | null,
  now: number,
  areas: readonly Bounds[],
): Map<string, LatLon> {
  const points = new Map<string, LatLon>();
  if (fix !== null) points.set('self', fix);
  areas.forEach(({ west, south, east, north }, index) => {
    points.set(`area-${String(index)}-sw`, { lat: south, lon: west });
    points.set(`area-${String(index)}-ne`, { lat: north, lon: east });
  });
  for (const [origin, report] of positions) {
    if (origin === self || report.type !== 'position' || now - report.time > STALE_AFTER_S)
      continue;
    points.set(origin, { lat: report.lat, lon: report.lon });
  }
  return points;
}

function viewOf(map: MapLibreMap): View {
  const { lat, lng } = map.getCenter();
  return { lat, lon: lng, zoom: map.getZoom(), bearing: map.getBearing() };
}

/** Views equal but for the rounding of floating point. */
function sameView(a: View, b: View): boolean {
  const close = (x: number, y: number) => Math.abs(x - y) < 1e-9;
  return (
    close(a.lat, b.lat) &&
    close(a.lon, b.lon) &&
    close(a.zoom, b.zoom) &&
    close(a.bearing, b.bearing)
  );
}
