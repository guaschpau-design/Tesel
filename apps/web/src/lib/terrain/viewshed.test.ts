import { distanceMeters } from '@tesel/core';
import type { LatLon } from '@tesel/protocol';
import { describe, expect, it } from 'vitest';

import { inSightAlong, viewshed } from './viewshed.ts';

const HERE = { lat: 41.15, lon: 1.1 };

describe('what can be seen from a point', () => {
  it('sees flat ground to the end, and nothing behind a ridge but what rises above it', () => {
    expect(inSightAlong(101.7, [100, 100, 100], 25)).toEqual([true, true, true]);
    expect(inSightAlong(101.7, [100, 130, 100, 120, 200], 25)).toEqual([
      true,
      true,
      false,
      false,
      true,
    ]);
  });

  it('does not see where the elevation is unknown, which hides nothing', () => {
    expect(inSightAlong(101.7, [null, 100], 25)).toEqual([false, true]);
  });

  it('shades the disc, and over it the ground in sight', async () => {
    // A wall 500 m to the east of the point, 50 m high, all along its north–south line.
    const heights = {
      elevations: (points: readonly LatLon[]) =>
        Promise.resolve(
          points.map((at) => {
            const east = distanceMeters(HERE, { lat: HERE.lat, lon: at.lon });
            return at.lon > HERE.lon && east > 490 && east < 510 ? 150 : 100;
          }),
        ),
    };
    const shed = await viewshed(heights, HERE);
    const [disc, ...seen] = shed?.features ?? [];
    expect(disc?.properties.seen).toBe(false);
    expect(seen.every((piece) => piece.properties.seen)).toBe(true);
    // Due east, the ground is seen to the wall and not beyond.
    const east = seen.filter((piece) => {
      const ring = piece.geometry.coordinates[0] ?? [];
      return ring.every(([lon = 0, lat = 0]) => lon >= HERE.lon && Math.abs(lat - HERE.lat) < 1e-3);
    });
    const farthest = Math.max(
      ...east.flatMap((piece) =>
        (piece.geometry.coordinates[0] ?? []).map(([lon = 0, lat = 0]) =>
          distanceMeters(HERE, { lat, lon }),
        ),
      ),
    );
    expect(farthest).toBeGreaterThan(490);
    expect(farthest).toBeLessThan(530);
    // Elsewhere, all round, to the end of the radius.
    expect(seen.length).toBeGreaterThan(300);
  });

  it('is not worked out where the point’s own elevation is unknown', async () => {
    const heights = {
      elevations: (points: readonly LatLon[]) => Promise.resolve(points.map(() => null)),
    };
    expect(await viewshed(heights, HERE)).toBeNull();
  });
});
