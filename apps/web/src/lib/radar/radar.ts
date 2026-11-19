// The radar around this device: rings at round distances, as many metres apart as reads well at
// the map's zoom, and lines to the nearest members with their distance and bearing. Pure: the
// layer (RadarLayer.svelte) feeds it the device's position, the zoom and the group's state.

import { bearingDegrees, distanceMeters, type GroupState } from '@tesel/core';
import type { LatLon, NodeId } from '@tesel/protocol';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

import { formatBearing, formatDistance, type BearingStyle } from '../format.ts';
import type { Locale } from '../i18n/index.ts';
import { circleRing, metresPerPixel, toPosition } from '../map/geometry.ts';
import { STALE_AFTER_S } from '../members/member-features.ts';

/** Rings drawn around the device. */
export const RING_COUNT = 4;
/** Distances a ring may be apart, in metres: round numbers, as a scale bar uses. */
const RING_STEPS = [10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000, 25_000, 50_000];
/** Rings closer than this on screen, in pixels, would crowd the map. */
const MIN_RING_GAP_PX = 60;
/** Lines are drawn to this many members at most, the nearest. */
const NEAREST_MEMBERS = 5;

/** The distance between rings at a zoom and latitude: the smallest that leaves room. */
export function ringStep(zoom: number, lat: number): number {
  const scale = metresPerPixel(zoom, lat);
  return (
    RING_STEPS.find((step) => step / scale >= MIN_RING_GAP_PX) ?? (RING_STEPS.at(-1) as number)
  );
}

/** The rings around a point, each with its distance as a label at its northern edge. */
export function ringFeatures(centre: LatLon, step: number, locale: Locale): FeatureCollection {
  const features: Feature[] = [];
  for (let k = 1; k <= RING_COUNT; k++) {
    const radius = k * step;
    const ring = circleRing(centre, radius);
    const label = formatDistance(radius, locale);
    features.push(feature<LineString>({ type: 'LineString', coordinates: ring }, { label }));
    // The ring's first position is due north of the centre (map/geometry.ts).
    const north = ring[0] ?? toPosition(centre);
    features.push(feature<Point>({ type: 'Point', coordinates: north }, { label }));
  }
  return { type: 'FeatureCollection', features };
}

export interface Nearby {
  readonly id: NodeId;
  readonly at: LatLon;
  /** Metres from the device. */
  readonly distance: number;
  /** Degrees clockwise from true north, from the device. */
  readonly bearing: number;
}

/**
 * The members nearest to a point, nearest first, from the positions they shared in the last
 * minutes: an older position may no longer be where they are. This device is left out.
 */
export function nearestMembers(
  state: Pick<GroupState, 'positions'>,
  self: NodeId,
  from: LatLon,
  now: number,
  count = NEAREST_MEMBERS,
): Nearby[] {
  const nearby: Nearby[] = [];
  for (const [id, report] of state.positions) {
    if (id === self || report.type !== 'position' || now - report.time > STALE_AFTER_S) continue;
    const at = { lat: report.lat, lon: report.lon };
    nearby.push({ id, at, distance: distanceMeters(from, at), bearing: bearingDegrees(from, at) });
  }
  return nearby.sort((a, b) => a.distance - b.distance).slice(0, count);
}

/** A line from the device to each nearby member, labelled with its distance and bearing. */
export function vectorFeatures(
  from: LatLon,
  members: readonly Nearby[],
  locale: Locale,
  style: BearingStyle,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: members.map((member) =>
      feature<LineString>(
        { type: 'LineString', coordinates: [toPosition(from), toPosition(member.at)] },
        {
          label: `${formatDistance(member.distance, locale)} · ${formatBearing(member.bearing, locale, style)}`,
        },
      ),
    ),
  };
}

function feature<G extends LineString | Point>(
  geometry: G,
  properties: { readonly label: string },
): Feature<G> {
  return { type: 'Feature', geometry, properties };
}
