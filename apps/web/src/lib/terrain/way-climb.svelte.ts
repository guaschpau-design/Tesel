// The elevations along a way, and how much it climbs: read again when its start has moved a little
// or anything else about it changes. The climb under guidance (ClimbLine), the elevation profile
// of a point (FromHere), both the straight way from this device, and that of a path measured on
// the map (MeasureBar, ADR-0135) follow a way with it.

import { distanceMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

import { climbOf, samplesAlong, type Climb } from './climb.ts';
import type { ElevationReader } from './elevation.ts';

/**
 * Closer than this, the way is the same as far as its samples, 30 m apart (climb.ts), can tell:
 * the elevation itself, about 10 m apart, is finer.
 */
const RECOMPUTE_AFTER_M = 25;

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
   * Follows the way `path` gives, from its first point to its last, reading it with the reader
   * `reader` gives; nothing is read while either is null. Made while a component starts, which it
   * follows until it goes.
   */
  constructor(path: () => readonly LatLon[] | null, reader: () => ElevationReader | null) {
    /** The way last read, so small moves of its start do not read it again. */
    let worked: readonly LatLon[] | null = null;
    /** Only the latest request may set the result; an older one may answer later. */
    let latest = 0;
    $effect(() => {
      const way = path();
      const terrain = reader();
      if (way === null || way.length < 2 || terrain === null) return;
      if (worked !== null && sameWay(worked, way)) return;
      worked = way;
      const samples = samplesAlong(way);
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

/** The same way as far as its samples can tell: its start moved a little at most, the rest not. */
function sameWay(before: readonly LatLon[], now: readonly LatLon[]): boolean {
  return (
    before.length === now.length &&
    now.every((point, index) => {
      const was = before[index];
      if (was === undefined) return false;
      return distanceMeters(was, point) < (index === 0 ? RECOMPUTE_AFTER_M : 1);
    })
  );
}
