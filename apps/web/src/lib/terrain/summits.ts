// The heights of summits and passes on the topographic map (ADR-0155), as paper maps write them.
// IGN names the mountains and the passes of Spain but gives their heights only at street zoom, so
// they are read from the elevation tiles: a pass where IGN names it, a summit at the highest ground
// near its name, where a mark goes with its height.

import { offsetMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';

import type { Heights } from './elevation.ts';

/** How far from its name a summit is looked for, and how finely, in metres. */
const SEARCH_M = 120;
const STEP_M = 15;

/** At most this many heights are marked at once: a range of mountains. */
const MOST = 80;

/** Heights kept worked out, at most: past them, all are forgotten and worked out again. */
const KEEP = 500;

/** A mountain, or a pass between two, as IGN names it; `key` tells one name from another. */
export interface NamedHeight {
  readonly key: string;
  readonly at: LatLon;
  readonly pass: boolean;
}

/** Where a height is marked, and what it is, rounded to the metre. */
export interface MarkedHeight {
  readonly at: LatLon;
  readonly metres: number;
}

/** A height marked for a mountain or a pass. */
export interface SummitMark extends MarkedHeight {
  readonly pass: boolean;
}

/** The points of a square grid, `STEP_M` apart, out to `SEARCH_M` around a point. */
export function searchGrid(around: LatLon): LatLon[] {
  const steps = Math.round(SEARCH_M / STEP_M);
  const points: LatLon[] = [];
  for (let north = -steps; north <= steps; north++) {
    for (let east = -steps; east <= steps; east++)
      points.push(offsetMeters(around, east * STEP_M, north * STEP_M));
  }
  return points;
}

/**
 * The height to mark for a mountain or a pass: a pass's where it is named, a mountain's at the
 * highest ground near its name. Null where the elevation is not known.
 */
export async function markedHeight(
  heights: Heights,
  named: NamedHeight,
): Promise<MarkedHeight | null> {
  const points = named.pass ? [named.at] : searchGrid(named.at);
  const elevations = await heights.elevations(points);
  let best: MarkedHeight | null = null;
  for (const [index, metres] of elevations.entries()) {
    const at = points[index];
    if (metres === null || at === undefined) continue;
    if (best === null || metres > best.metres) best = { at, metres };
  }
  return best === null ? null : { at: best.at, metres: Math.round(best.metres) };
}

/** The heights marked for the names a map shows, each worked out once while it is known. */
export class SummitMarks {
  readonly #heights: Heights;
  readonly #known = new Map<string, Promise<SummitMark | null>>();

  constructor(heights: Heights) {
    this.#heights = heights;
  }

  /**
   * The marks of these names, once each and the first `MOST` of them, leaving out those whose
   * elevation is not known.
   */
  async marks(named: readonly NamedHeight[]): Promise<SummitMark[]> {
    if (this.#known.size > KEEP) this.#known.clear();
    const once = [...new Map(named.map((name) => [name.key, name])).values()].slice(0, MOST);
    const found = await Promise.all(once.map((name) => this.#mark(name)));
    return found.filter((mark) => mark !== null);
  }

  #mark(name: NamedHeight): Promise<SummitMark | null> {
    let mark = this.#known.get(name.key);
    if (mark === undefined) {
      mark = markedHeight(this.#heights, name).then((height) => {
        // Unknown for now: its elevation may be downloaded, or the network back, later.
        if (height === null) this.#known.delete(name.key);
        return height === null ? null : { ...height, pass: name.pass };
      });
      this.#known.set(name.key, mark);
    }
    return mark;
  }
}
