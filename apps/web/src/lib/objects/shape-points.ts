// The points of a route or an area as they can be sent: the protocol carries each point after the
// first as a small step from the one before, at most 0.32767° (§3.7), and leaves it to the sender
// to put points in between on a longer segment.

import type { LatLon } from '@tesel/protocol';

/** The longest step between consecutive points, in degrees: under the protocol's, with room. */
const MAX_STEP_DEGREES = 0.3;

/**
 * The points with as many evenly spaced ones added on each segment as keep every step within
 * what can be sent. Longitude takes the short way round, across the antimeridian if need be.
 */
export function densify(points: readonly LatLon[]): LatLon[] {
  const dense: LatLon[] = [];
  points.forEach((point, index) => {
    const previous = points[index - 1];
    if (previous !== undefined) {
      const dLat = point.lat - previous.lat;
      const dLon = shortLongitude(point.lon - previous.lon);
      const steps = Math.ceil(Math.max(Math.abs(dLat), Math.abs(dLon)) / MAX_STEP_DEGREES);
      for (let step = 1; step < steps; step++) {
        const share = step / steps;
        dense.push({
          lat: previous.lat + dLat * share,
          lon: shortLongitude(previous.lon + dLon * share),
        });
      }
    }
    dense.push(point);
  });
  return dense;
}

/** A longitude difference or value brought within −180…180. */
function shortLongitude(degrees: number): number {
  return degrees > 180 ? degrees - 360 : degrees < -180 ? degrees + 360 : degrees;
}
