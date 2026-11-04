// The elevation profile of a way, drawn to scale: the ground as a line over the distance, with the
// heights of a few round levels marked, and how many times the heights are stretched against the
// distance so that a gentle slope can be seen at all.

/** The drawing's size, in its own units; the page scales it to its width. */
export const PROFILE_WIDTH = 320;
export const PROFILE_HEIGHT = 140;
/** Room for the heights on the left and the distances below. */
const LEFT = 44;
const RIGHT = 8;
const TOP = 8;
const BOTTOM = 22;
/** The least range of heights drawn: on flat ground, ten metres of noise would fill the drawing. */
const LEAST_RANGE_M = 20;

interface ProfileLevel {
  /** Metres above sea level, a round number. */
  readonly metres: number;
  /** Where it is drawn, from the top. */
  readonly y: number;
}

export interface ProfileDrawing {
  /** The ground as a line, and as a filled shape down to the bottom of the plot. */
  readonly line: string;
  readonly area: string;
  /** Round heights marked across the plot, lowest first. */
  readonly levels: readonly ProfileLevel[];
  /** The plot's edges, for the axes and the labels. */
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
  /** How many times the heights are stretched against the distance (1 is true to scale). */
  readonly exaggeration: number;
}

/** A round step between levels: 1, 2 or 5 times a power of ten, giving two to four levels. */
export function levelStep(range: number): number {
  const rough = range / 3;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((value) => value >= rough);
  return step ?? 10 * power;
}

/**
 * The drawing of heights sampled evenly along a way `length` metres long. Every height must be
 * known, and there must be two at least.
 */
export function profileDrawing(heights: readonly number[], length: number): ProfileDrawing {
  const lowest = Math.min(...heights);
  const highest = Math.max(...heights);
  const middle = (lowest + highest) / 2;
  const half = Math.max(highest - lowest, LEAST_RANGE_M) / 2;
  const step = levelStep(half * 2);
  // The plot runs from one level below the lowest point to one above the highest.
  const floor = Math.floor((middle - half) / step) * step;
  const ceiling = Math.ceil((middle + half) / step) * step;
  const right = PROFILE_WIDTH - RIGHT;
  const bottom = PROFILE_HEIGHT - BOTTOM;
  const x = (index: number) => LEFT + ((right - LEFT) * index) / (heights.length - 1);
  const y = (metres: number) => bottom - ((bottom - TOP) * (metres - floor)) / (ceiling - floor);
  const points = heights.map((metres, index) => `${round(x(index))} ${round(y(metres))}`);
  const line = `M${points.join(' L')}`;
  const area = `${line} L${round(right)} ${bottom} L${LEFT} ${bottom} Z`;
  const levels: ProfileLevel[] = [];
  for (let metres = floor; metres <= ceiling; metres += step) {
    levels.push({ metres, y: round(y(metres)) });
  }
  const unitsPerMetreUp = (bottom - TOP) / (ceiling - floor);
  const unitsPerMetreAlong = (right - LEFT) / Math.max(length, 1);
  return {
    line,
    area,
    levels,
    left: LEFT,
    right,
    bottom,
    exaggeration: unitsPerMetreUp / unitsPerMetreAlong,
  };
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
