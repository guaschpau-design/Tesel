// A route or an area read from a file the user picks: refused if the file is too big to hold one,
// and thinned to the points a shape can carry over the radio (draft.ts), with what that cost.

import { simplifyLine, type Simplified } from '@tesel/core';
import { SHAPE_LABEL_MAX_BYTES, SHAPE_MAX_POINTS, type LatLon, type Result } from '@tesel/protocol';

import { fitBytes } from '../text.ts';
import { readShapeFile, type ShapeFileError } from './shape-file.ts';
import { densify } from './shape-points.ts';

/** A route of a whole day's walk, recorded every second, takes a few megabytes of GPX. */
export const MAX_SHAPE_FILE_BYTES = 5 * 1024 * 1024;

export interface ImportedShape {
  readonly kind: 'route' | 'area';
  /** The shape's name in the file, or else the file's, cut to fit a label. */
  readonly name: string;
  readonly points: readonly LatLon[];
  /** How many points the file's shape had. */
  readonly read: number;
  /** The most the shape kept strays from the file's, in metres. */
  readonly deviation: number;
}

export type ShapeImportError = ShapeFileError | 'too-big' | 'unreadable' | 'too-wide';

/** The fewest points of each kind of shape. */
const FEWEST: Readonly<Record<ImportedShape['kind'], number>> = { route: 2, area: 3 };

export async function importShape(
  file: File,
  kind: ImportedShape['kind'],
): Promise<Result<ImportedShape, ShapeImportError>> {
  if (file.size > MAX_SHAPE_FILE_BYTES) return { ok: false, error: 'too-big' };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'unreadable' };
  }
  try {
    return shapeOf(text, kind, file.name);
  } catch (error) {
    // Nothing a file holds should get here (shape-file.ts); if it does, the file is unreadable.
    console.warn('Reading a shape file failed', error);
    return { ok: false, error: 'unreadable' };
  }
}

function shapeOf(
  text: string,
  kind: ImportedShape['kind'],
  fileName: string,
): Result<ImportedShape, ShapeImportError> {
  const read = readShapeFile(text, kind);
  if (!read.ok) return read;
  const line = withoutRepeats(read.value.points);
  if (line.length < FEWEST[kind]) {
    return { ok: false, error: kind === 'route' ? 'no-line' : 'no-area' };
  }
  const sendable = simplified(line, FEWEST[kind]);
  if (sendable === null) return { ok: false, error: 'too-wide' };
  const { points, deviation } = sendable;
  const name = read.value.name || fileName.replace(/\.[^.]*$/, '');
  return {
    ok: true,
    value: {
      kind,
      name: fitBytes(name.trim(), SHAPE_LABEL_MAX_BYTES),
      points,
      read: line.length,
      deviation,
    },
  };
}

/**
 * The line in as many points as a shape may have once points are added where they are too far
 * apart to send; null when even the fewest it may have would need more.
 */
function simplified(line: readonly LatLon[], fewest: number): Simplified | null {
  let budget = SHAPE_MAX_POINTS;
  while (budget >= fewest) {
    const { points, deviation } = simplifyLine(line, budget);
    const dense = densify(points);
    if (dense.length <= SHAPE_MAX_POINTS) return { points: dense, deviation };
    budget -= dense.length - SHAPE_MAX_POINTS;
  }
  return null;
}

/** The line without a point that repeats the one before it, as recorders do while standing. */
function withoutRepeats(line: readonly LatLon[]): LatLon[] {
  return line.filter(
    (point, index) =>
      index === 0 || point.lat !== line[index - 1]?.lat || point.lon !== line[index - 1]?.lon,
  );
}
