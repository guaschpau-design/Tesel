// The elevations along the straight way from one point to another, and how much it climbs: read
// again when the start has moved a little or the end changes. The climb under guidance (ClimbLine)
// and the elevation profile of a point (FromHere) both follow a way with it.

import { distanceMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

import { climbOf, samplesAlong, type Climb } from './climb.ts';
import type { ElevationReader } from './elevation.ts';

/**
 * Closer than this, the way is the same as far as its samples, 30 m apart (climb.ts), can tell:
 * the elevation itself, about 10 m apart, is finer.
 */
const RECOMPUTE_AFTER_M = 25;

export interface WayEnds {
  readonly from: LatLon;
  readonly to: LatLon;
}

/** A way sampled along, with what is known of its elevations. */
export interface WayElevations {
  readonly samples: readonly LatLon[];
  /** Metres above sea level, sample by sample; null where unknown. */
  readonly elevations: readonly (number | null)[];
  /** Null unless every elevation is known. */
  readonly climb: Climb | null;
}

export class WayClimb {
  /** The latest way read; null until one has been. */
  current: WayElevations | null = $state.raw(null);
  /** Whether a way is being read now. */
  reading = $state(false);

  /**
   * Follows the way `ends` gives, reading it with the reader `reader` gives; nothing is read while
   * either is null. Made while a component starts, which it follows until it goes.
   */
  constructor(ends: () => WayEnds | null, reader: () => ElevationReader | null) {
    /** The ends of the way last read, so small moves do not read it again. */
    let worked: WayEnds | null = null;
    /** Only the latest request may set the result; an older one may answer later. */
    let latest = 0;
    $effect(() => {
      const way = ends();
      const terrain = reader();
      if (way === null || terrain === null) return;
      if (
        worked !== null &&
        distanceMeters(worked.from, way.from) < RECOMPUTE_AFTER_M &&
        distanceMeters(worked.to, way.to) < 1
      ) {
        return;
      }
      worked = way;
      const samples = samplesAlong(way.from, way.to);
      const request = ++latest;
      this.reading = true;
      void terrain.elevations(samples).then((elevations) => {
        if (request !== latest) return;
        this.current = { samples, elevations, climb: climbOf(samples, elevations) };
        this.reading = false;
      });
    });
  }
}
