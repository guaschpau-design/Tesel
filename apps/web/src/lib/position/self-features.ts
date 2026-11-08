// This device on the map, where the GPS says it is now: a dot named `label`, and the circle within
// which the browser thinks it is.

import { distanceMeters } from '@tesel/core';
import type { FeatureCollection } from 'geojson';

import { circleRing, toPosition } from '../map/geometry.ts';
import type { DeviceFix } from './device-location.svelte.ts';

export function selfFeatures(fix: DeviceFix | null, label: string): FeatureCollection {
  if (fix === null) return { type: 'FeatureCollection', features: [] };
  const dot = {
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: toPosition(fix.at) },
    properties: { label },
  };
  if (fix.accuracy === null) return { type: 'FeatureCollection', features: [dot] };
  const area = {
    type: 'Feature' as const,
    geometry: { type: 'Polygon' as const, coordinates: [circleRing(fix.at, fix.accuracy)] },
    properties: {},
  };
  return { type: 'FeatureCollection', features: [area, dot] };
}

/**
 * Whether `fix` would be drawn as `drawn` is, at `metresPerPixel`: less than a pixel away, with an
 * accuracy circle less than a pixel wider or narrower. Such a fix is not drawn again (ADR-0123).
 */
export function drawnAlike(
  drawn: DeviceFix | null,
  fix: DeviceFix | null,
  metresPerPixel: number,
): boolean {
  if (drawn === null || fix === null) return drawn === fix;
  if ((drawn.accuracy === null) !== (fix.accuracy === null)) return false;
  const wider = Math.abs((fix.accuracy ?? 0) - (drawn.accuracy ?? 0));
  return distanceMeters(drawn.at, fix.at) < metresPerPixel && wider < metresPerPixel;
}
