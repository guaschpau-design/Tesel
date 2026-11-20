// What can be seen from a point (ADR-0152): the ground in sight of someone standing there, worked
// out from the elevation tiles alone, so without buildings or trees, within a radius. Along each of
// a fan of rays out from the point, a stretch of ground is in sight when the slope up to it from
// the eye is at least as steep as to every stretch before it; the earth's curve, bent back a little
// by the air, lowers the farther ones.

import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import type { Feature, FeatureCollection, Polygon, Position } from 'geojson';

import { circleRing, toPosition } from '../map/geometry.ts';
import type { Heights } from './elevation.ts';

/** How far the view is worked out, in metres. */
export const VIEW_RADIUS_M = 2000;
/** Rays out from the point, all round, and the distance between the stretches along each. */
const RAYS = 360;
const STEP_M = 25;
/** The eye above the ground: someone standing. */
const EYE_M = 1.7;
/** The earth's radius, made larger by the air's bending of the light: the usual 0.13. */
const SIGHT_RADIUS_M = 6_371_000 / (1 - 0.13);

/** What can be seen from a point, in a panel: not asked for, being worked out, or how it went. */
export type ViewshedState = 'off' | 'working' | 'shown' | 'unknown';

/**
 * Which stretches of one ray are in sight from an eye at `eye` metres above sea level, given the
 * ground's elevations at `step`, 2 × `step`… metres out. An unknown elevation is not in sight, and
 * hides nothing.
 */
export function inSightAlong(
  eye: number,
  ground: readonly (number | null)[],
  step: number,
): boolean[] {
  let steepest = -Infinity;
  return ground.map((height, index) => {
    if (height === null) return false;
    const distance = (index + 1) * step;
    const slope = (height - (distance * distance) / (2 * SIGHT_RADIUS_M) - eye) / distance;
    const seen = slope >= steepest;
    steepest = Math.max(steepest, slope);
    return seen;
  });
}

export interface ViewshedProperties {
  /** In sight, or within the radius but hidden. */
  readonly seen: boolean;
}

/**
 * The ground in sight from `from`, within the radius: the whole disc, not in sight, and over it
 * each stretch in sight, as a piece of the ray's sector. Null when the point's own elevation is
 * not known.
 */
export async function viewshed(
  heights: Heights,
  from: LatLon,
): Promise<FeatureCollection<Polygon, ViewshedProperties> | null> {
  const samples = Math.floor(VIEW_RADIUS_M / STEP_M);
  const points: LatLon[] = [from];
  for (let ray = 0; ray < RAYS; ray++) {
    for (let sample = 1; sample <= samples; sample++)
      points.push(along(from, ray, sample * STEP_M));
  }
  const [ground = null, ...elevations] = await heights.elevations(points);
  if (ground === null) return null;
  const features: Feature<Polygon, ViewshedProperties>[] = [
    {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [circleRing(from, VIEW_RADIUS_M, 96)] },
      properties: { seen: false },
    },
  ];
  for (let ray = 0; ray < RAYS; ray++) {
    const seen = inSightAlong(
      ground + EYE_M,
      elevations.slice(ray * samples, (ray + 1) * samples),
      STEP_M,
    );
    // Each run of stretches in sight, from the point itself, which is.
    let start: number | null = 0;
    for (let sample = 0; sample <= samples; sample++) {
      const inSight = sample < samples && (seen[sample] ?? false);
      if (inSight && start === null) start = sample + 0.5;
      if (!inSight && start !== null) {
        features.push(sector(from, ray, start * STEP_M, (sample + 0.5) * STEP_M));
        start = null;
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

/** The point `metres` out along a ray. */
function along(from: LatLon, ray: number, metres: number): LatLon {
  const angle = (ray / RAYS) * 2 * Math.PI;
  return offsetMeters(from, metres * Math.cos(angle), metres * Math.sin(angle));
}

/** The piece of a ray's sector, half a ray either side, between two distances. */
function sector(
  from: LatLon,
  ray: number,
  near: number,
  far: number,
): Feature<Polygon, ViewshedProperties> {
  const corner = (side: number, metres: number): Position =>
    toPosition(along(from, ray + side, metres));
  const ring = [
    corner(-0.5, near),
    corner(-0.5, far),
    corner(0.5, far),
    corner(0.5, near),
    corner(-0.5, near),
  ];
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties: { seen: true },
  };
}
