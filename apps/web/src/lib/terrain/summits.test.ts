import { describe, expect, it } from 'vitest';

import type { LatLon } from '@tesel/protocol';

import type { Heights } from './elevation.ts';
import { markedHeight, searchGrid, SummitMarks } from './summits.ts';

const NAMED: LatLon = { lat: 41.6, lon: 1.81 };

/** A cone of a hill whose top is `east` metres east of the name, 1000 m high. */
function hill(east: number): Heights {
  const metresEast = (at: LatLon) =>
    (at.lon - NAMED.lon) * 111_320 * Math.cos((NAMED.lat * Math.PI) / 180);
  const metresNorth = (at: LatLon) => (at.lat - NAMED.lat) * 110_574;
  return {
    elevations: (points) =>
      Promise.resolve(
        points.map((at) => 1000 - Math.hypot(metresEast(at) - east, metresNorth(at)) / 10),
      ),
  };
}

describe('the height marked for a mountain or a pass', () => {
  it('marks a mountain at the highest ground near its name', async () => {
    const marked = await markedHeight(hill(60), { key: 'top', at: NAMED, pass: false });
    expect(marked?.metres).toBe(1000);
    expect(marked?.at.lon).toBeGreaterThan(NAMED.lon);
  });

  it('marks a pass where it is named', async () => {
    const marked = await markedHeight(hill(60), { key: 'pass', at: NAMED, pass: true });
    expect(marked).toEqual({ at: NAMED, metres: 994 });
  });

  it('marks nothing where the elevation is not known', async () => {
    const unknown: Heights = { elevations: (points) => Promise.resolve(points.map(() => null)) };
    expect(await markedHeight(unknown, { key: 'top', at: NAMED, pass: false })).toBeNull();
  });

  it('looks for a summit on a grid around its name', () => {
    expect(searchGrid(NAMED)).toHaveLength(17 * 17);
  });

  it('works out each height once, and again while it is not known', async () => {
    let asked = 0;
    let known = false;
    const counted: Heights = {
      elevations: (points) => {
        asked++;
        return Promise.resolve(points.map(() => (known ? 500 : null)));
      },
    };
    const marks = new SummitMarks(counted);
    const pass = { key: 'pass', at: NAMED, pass: true };
    expect(await marks.marks([pass, pass])).toEqual([]);
    known = true;
    expect(await marks.marks([pass])).toEqual([{ at: NAMED, metres: 500, pass: true }]);
    await marks.marks([pass]);
    expect(asked).toBe(2);
  });
});
