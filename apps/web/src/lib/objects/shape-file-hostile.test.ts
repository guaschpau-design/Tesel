// Files made to break the reader: it must answer, quickly, and never throw (ADR-0110).

import { describe, expect, it } from 'vitest';

import { MAX_SHAPE_FILE_BYTES } from './shape-import.ts';
import { readShapeFile } from './shape-file.ts';

/** Well over the time a file of the largest size takes, on a slow machine running tests. */
const QUICK_MS = 2_000;

function timed<T>(read: () => T): { value: T; ms: number } {
  const start = performance.now();
  const value = read();
  return { value, ms: performance.now() - start };
}

/** A GPX file of the largest size accepted, mostly `filler`, with a route of two points. */
function largestGpx(filler: string): string {
  const route = '<rte><rtept lat="42.5" lon="1.5"/><rtept lat="42.6" lon="1.5"/></rte>';
  const room = MAX_SHAPE_FILE_BYTES - route.length - 20;
  return `<gpx>${route}<trk>${filler.repeat(Math.floor(room / filler.length))}</trk></gpx>`;
}

describe('reading a file made to break the reader', () => {
  it('leaves as they are references to characters that do not exist', () => {
    const gpx = `<gpx><rte><name>A&#x110000;B&#99999999;C&#xD800;D&#65;&#x1F692;</name>
      <rtept lat="42.5" lon="1.5"/><rtept lat="42.6" lon="1.5"/></rte></gpx>`;
    const read = readShapeFile(gpx, 'route');
    expect(read.ok && read.value.name).toBe('A&#x110000;B&#99999999;C&#xD800;DA\u{1F692}');
  });

  it('reads GeoJSON nested deeper than the stack would go', () => {
    const depth = 100_000;
    const line = '{"type":"LineString","coordinates":[[1.5,42.5],[1.5,42.6]]}';
    const nested =
      '{"type":"GeometryCollection","geometries":['.repeat(depth) + line + ']}'.repeat(depth);
    const read = readShapeFile(nested, 'route');
    expect(read.ok && read.value.points).toHaveLength(2);
  });

  it.each([
    ['tags never closed', '<trkseg><trkpt lat="1" lon="1">'],
    ['tags never ended', '<trkpt lat="1" '],
    ['names never closed', '<name>'],
    ['sections of text never closed', '<name><![CDATA[x'],
  ])('reads a file of the largest size full of %s in moments', (_, filler) => {
    const { value, ms } = timed(() => readShapeFile(largestGpx(filler), 'route'));
    expect(value.ok).toBe(true);
    expect(ms).toBeLessThan(QUICK_MS);
  });

  it('reads a KML file of the largest size full of placemarks never closed in moments', () => {
    const filler = '<Placemark><name>x</name><LineString><coordinates>1,42 ';
    const kml = `<kml>${filler.repeat(Math.floor(MAX_SHAPE_FILE_BYTES / filler.length))}</kml>`;
    const { ms } = timed(() => readShapeFile(kml, 'route'));
    expect(ms).toBeLessThan(QUICK_MS);
  });
});
