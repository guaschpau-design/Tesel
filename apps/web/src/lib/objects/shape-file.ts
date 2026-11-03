// Reading a route or an area from a file made by another app or device: GPX, KML or GeoJSON. Only
// the shape is kept, and its name: for a route, the longest line in the file; for an area, the
// largest polygon, or line that closes on itself, as a track walked round a place does. The files
// are read as text, without an XML parser, so the same code runs in the browser and in the tests.
// A file is whatever the user was sent: reading one takes time in proportion to its size, however
// it is made, and nesting however deep does not overflow the stack (ADR-0110).

import { areaSquareMeters, distanceMeters, pathMeters } from '@tesel/core';
import type { LatLon, Result } from '@tesel/protocol';

export interface FileShape {
  /** The shape's own name in the file, or empty. */
  readonly name: string;
  readonly points: readonly LatLon[];
}

export type ShapeFileError =
  /** Not GPX, KML or GeoJSON. */
  | 'unsupported'
  /** For a route: no line of two points or more. */
  | 'no-line'
  /** For an area: no polygon, nor closed line, of three corners or more. */
  | 'no-area';

/** A line whose ends are this close goes round a place: it is an area. */
const CLOSES_M = 25;

export function readShapeFile(
  text: string,
  kind: 'route' | 'area',
): Result<FileShape, ShapeFileError> {
  const shapes = shapesIn(text.trim());
  if (shapes === null) return { ok: false, error: 'unsupported' };
  return kind === 'route' ? longestLine(shapes.lines) : largestArea(shapes);
}

/** The lines and the polygons' outer rings in a file. */
interface Shapes {
  readonly lines: readonly FileShape[];
  readonly rings: readonly FileShape[];
}

function longestLine(lines: readonly FileShape[]): Result<FileShape, ShapeFileError> {
  const usable = lines.filter((line) => line.points.length >= 2);
  if (usable.length === 0) return { ok: false, error: 'no-line' };
  const longest = usable.reduce((best, line) =>
    pathMeters(line.points) > pathMeters(best.points) ? line : best,
  );
  return { ok: true, value: longest };
}

function largestArea({ lines, rings }: Shapes): Result<FileShape, ShapeFileError> {
  const closed = lines.filter(({ points }) => {
    const [first] = points;
    const last = points.at(-1);
    return (
      points.length >= 4 &&
      first !== undefined &&
      last !== undefined &&
      distanceMeters(first, last) <= CLOSES_M
    );
  });
  const areas = [...rings, ...closed]
    .map((shape) => ({ ...shape, points: unclosed(shape.points) }))
    .filter((shape) => shape.points.length >= 3);
  if (areas.length === 0) return { ok: false, error: 'no-area' };
  const largest = areas.reduce((best, area) =>
    areaSquareMeters(area.points) > areaSquareMeters(best.points) ? area : best,
  );
  return { ok: true, value: largest };
}

/** A ring's corners, without the last when it only closes the ring on the first. */
function unclosed(points: readonly LatLon[]): readonly LatLon[] {
  const [first] = points;
  const last = points.at(-1);
  const repeats = first !== undefined && last !== undefined && distanceMeters(first, last) < 1;
  return repeats && points.length > 1 ? points.slice(0, -1) : points;
}

/** The shapes in a file, or null if it is of none of the formats. */
function shapesIn(text: string): Shapes | null {
  if (text.startsWith('{')) return geoJsonShapes(text);
  if (/<(?:[\w.-]+:)?gpx\b/.test(text)) return { lines: gpxLines(text), rings: [] };
  if (/<(?:[\w.-]+:)?kml\b/.test(text)) return kmlShapes(text);
  return null;
}

// --- GPX: tracks, their segments joined, and routes ----------------------------------------

function gpxLines(xml: string): FileShape[] {
  const line = (container: string, child: string) =>
    [...elements(xml, container)].map(({ body }) => ({
      name: ownName(body, child),
      points: [...elements(body, child)].flatMap(({ attributes }) =>
        pointOf(Number(attribute(attributes, 'lat')), Number(attribute(attributes, 'lon'))),
      ),
    }));
  return [...line('trk', 'trkpt'), ...line('rte', 'rtept')];
}

// --- KML: the line strings, tracks and polygons of each placemark ---------------------------

function kmlShapes(xml: string): Shapes {
  const placemarks = [...elements(xml, 'Placemark')].map(({ body }) => body);
  const lines = placemarks.flatMap((body) => {
    const name = ownName(body, 'LineString');
    const strings = [...elements(body, 'LineString')].map((string) => ({
      name,
      points: kmlCoordinates(string.body),
    }));
    const tracks = [...elements(body, 'Track')].map((track) => ({
      name,
      points: [...elements(track.body, 'coord')].flatMap((coord) => {
        const [lon, lat] = coord.body.trim().split(/\s+/).map(Number);
        return pointOf(lat, lon);
      }),
    }));
    return [...strings, ...tracks];
  });
  const rings = placemarks.flatMap((body) => {
    const name = ownName(body, 'Polygon');
    return [...elements(body, 'Polygon')].flatMap((polygon) =>
      [...elements(polygon.body, 'outerBoundaryIs')].map((outer) => ({
        name,
        points: kmlCoordinates(outer.body),
      })),
    );
  });
  return { lines, rings };
}

/** The points of the `<coordinates>` an element holds: "lon,lat[,alt]" tuples. */
function kmlCoordinates(body: string): LatLon[] {
  return [...elements(body, 'coordinates')].flatMap((list) =>
    list.body
      .trim()
      .split(/\s+/)
      .flatMap((tuple) => {
        const [lon, lat] = tuple.split(',').map(Number);
        return pointOf(lat, lon);
      }),
  );
}

// --- GeoJSON: line strings, polygons and the parts of multi ones, wherever they are ----------

function geoJsonShapes(text: string): Shapes | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const lines: FileShape[] = [];
  const rings: FileShape[] = [];
  /** A polygon's outer ring, its first. */
  const outer = (polygon: unknown, name: string) => {
    const [ring] = arrayOf(polygon);
    rings.push({ name, points: positions(ring) });
  };
  // What is still to look at, the next on top: collections are walked without recursion, so
  // nesting however deep cannot overflow the stack.
  const pending: { value: unknown; name: string }[] = [{ value: json, name: '' }];
  /** Children are pushed last first, so they are looked at in the file's order. */
  const push = (values: readonly unknown[], name: string) => {
    for (const value of [...values].reverse()) pending.push({ value, name });
  };
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const { value, name } = next;
    if (!isRecord(value)) continue;
    switch (value['type']) {
      case 'FeatureCollection':
        push(arrayOf(value['features']), '');
        break;
      case 'Feature': {
        const properties = isRecord(value['properties']) ? value['properties'] : {};
        const own = properties['name'] ?? properties['title'];
        push([value['geometry']], typeof own === 'string' ? own.trim() : '');
        break;
      }
      case 'GeometryCollection':
        push(arrayOf(value['geometries']), name);
        break;
      case 'LineString':
        lines.push({ name, points: positions(value['coordinates']) });
        break;
      case 'MultiLineString':
        for (const part of arrayOf(value['coordinates'])) {
          lines.push({ name, points: positions(part) });
        }
        break;
      case 'Polygon':
        outer(value['coordinates'], name);
        break;
      case 'MultiPolygon':
        for (const part of arrayOf(value['coordinates'])) outer(part, name);
        break;
    }
  }
  return { lines, rings };
}

function positions(value: unknown): LatLon[] {
  return arrayOf(value).flatMap((position) => {
    const [lon, lat] = arrayOf(position);
    return pointOf(lat, lon);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function arrayOf(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

// --- XML, as far as these formats need it ----------------------------------------------------

/**
 * Each element of a name, with any namespace prefix: its attributes and what it holds. Its tags
 * are found in one pass, so the time taken grows with the text, not with it squared: an element
 * holds what comes up to its closing tag or, never closed, up to the next element of its name or
 * the end, as in a file cut short.
 */
function* elements(xml: string, name: string): Generator<{ attributes: string; body: string }> {
  const prefix = '(?:[\\w.-]+:)?';
  // An attribute holds no `<`: stopping at one keeps every tag found short.
  const tags = new RegExp(`<(?:(/)${prefix}${name}\\s*|${prefix}${name}(\\s[^<>]*?)?(/?))>`, 'g');
  let open: { attributes: string; start: number } | null = null;
  for (const tag of xml.matchAll(tags)) {
    if (open !== null)
      yield { attributes: open.attributes, body: xml.slice(open.start, tag.index) };
    open = null;
    const [whole, closing, attributes = '', empty] = tag;
    if (closing !== undefined) continue;
    if (empty === '/') yield { attributes, body: '' };
    else open = { attributes, start: tag.index + whole.length };
  }
  if (open !== null) yield { attributes: open.attributes, body: xml.slice(open.start) };
}

/** The name of what an element holds: the first <name> before its first `child`. */
function ownName(body: string, child: string): string {
  const end = body.search(new RegExp(`<(?:[\\w.-]+:)?${child}\\b`));
  const [name] = elements(end < 0 ? body : body.slice(0, end), 'name');
  return name ? textOf(name.body) : '';
}

function attribute(attributes: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`).exec(attributes)?.[2];
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/** The text an element holds, its markup undone. */
function textOf(body: string): string {
  return withoutCdata(body)
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) {
        return character(Number.parseInt(code.slice(2), 16)) ?? entity;
      }
      if (code.startsWith('#')) return character(Number.parseInt(code.slice(1), 10)) ?? entity;
      return ENTITIES[code] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

const CDATA_OPEN = '<![CDATA[';
const CDATA_CLOSE = ']]>';

/** The text with its CDATA sections opened, in one pass; one never closed is left as it is. */
function withoutCdata(text: string): string {
  let result = '';
  let at = 0;
  for (;;) {
    const open = text.indexOf(CDATA_OPEN, at);
    const close = open < 0 ? -1 : text.indexOf(CDATA_CLOSE, open + CDATA_OPEN.length);
    if (close < 0) return result + text.slice(at);
    result += text.slice(at, open) + text.slice(open + CDATA_OPEN.length, close);
    at = close + CDATA_CLOSE.length;
  }
}

/** The character a numeric reference names, or null for none: past U+10FFFF, or half of one. */
function character(code: number): string | null {
  const surrogate = code >= 0xd800 && code <= 0xdfff;
  return code > 0 && code <= 0x10ffff && !surrogate ? String.fromCodePoint(code) : null;
}

/** A point if the numbers are a valid latitude and longitude, else none. */
function pointOf(lat: unknown, lon: unknown): LatLon[] {
  if (typeof lat !== 'number' || typeof lon !== 'number') return [];
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) return [];
  return [{ lat, lon }];
}
