import { describe, expect, it } from 'vitest';

import {
  areaSquareMeters,
  bearingDegrees,
  distanceMeters,
  eastNorthMeters,
  nearestOnSegment,
  offsetMeters,
  pathMeters,
} from './geo.ts';

const VALENCIA = { lat: 39.4699, lon: -0.3763 };
const MADRID = { lat: 40.4168, lon: -3.7038 };

describe('geometry on the Earth', () => {
  it('measures great-circle distances', () => {
    // About 302 km by the WGS 84 ellipsoid; the sphere is within half a percent.
    expect(distanceMeters(VALENCIA, MADRID) / 1000).toBeCloseTo(302, -1);
  });

  it('gives the bearing to set off on, clockwise from north', () => {
    const north = { lat: VALENCIA.lat + 0.01, lon: VALENCIA.lon };
    const east = { lat: VALENCIA.lat, lon: VALENCIA.lon + 0.01 };
    expect(bearingDegrees(VALENCIA, north)).toBeCloseTo(0, 5);
    expect(bearingDegrees(VALENCIA, east)).toBeCloseTo(90, 1);
    expect(bearingDegrees(north, VALENCIA)).toBeCloseTo(180, 5);
    // PROJ on a sphere: -68.5737°, that is 291.4263°.
    expect(bearingDegrees(VALENCIA, MADRID)).toBeCloseTo(291.4263, 4);
  });

  it('adds up the legs of a path', () => {
    const middle = { lat: 40, lon: -2 };
    expect(pathMeters([VALENCIA, middle, MADRID])).toBeCloseTo(
      distanceMeters(VALENCIA, middle) + distanceMeters(middle, MADRID),
      6,
    );
    expect(pathMeters([VALENCIA])).toBe(0);
  });

  it('measures the area of a ring, whichever way round', () => {
    // A square of 0.01° of latitude a side: about 1112 m by 858 m at Valencia.
    const { lat, lon } = VALENCIA;
    const dLon = 0.01 / Math.cos((lat * Math.PI) / 180);
    const square = [
      { lat, lon },
      { lat, lon: lon + dLon },
      { lat: lat + 0.01, lon: lon + dLon },
      { lat: lat + 0.01, lon },
    ];
    const side = distanceMeters(square[0] ?? VALENCIA, square[3] ?? VALENCIA);
    expect(areaSquareMeters(square) / side ** 2).toBeCloseTo(1, 2);
    expect(areaSquareMeters([...square].reverse())).toBeCloseTo(areaSquareMeters(square), 6);
    expect(areaSquareMeters(square.slice(0, 2))).toBe(0);
  });

  it('places a point some metres north and east of another', () => {
    const away = offsetMeters(VALENCIA, 300, -400);
    expect(distanceMeters(VALENCIA, away)).toBeCloseTo(500, 0);
    expect(bearingDegrees(VALENCIA, away)).toBeCloseTo(306.87, 1);
    expect(offsetMeters(VALENCIA, 0, 0)).toEqual(VALENCIA);
  });

  it('never places a point past a pole, nor more than half a turn east or west', () => {
    const north = { lat: 85, lon: 10 };
    const far = offsetMeters(north, 1_000_000, 2_000_000);
    expect(far.lat).toBe(90);
    expect(far.lon).toBe(190);
    expect(offsetMeters(north, -1_000_000, -2_000_000).lon).toBe(-170);
    expect(offsetMeters({ lat: -89, lon: 0 }, -4e9, 0).lat).toBe(-90);
    const pole = offsetMeters({ lat: 90, lon: 0 }, 0, 10);
    expect(pole).toEqual({ lat: 90, lon: 180 });
  });

  it('tells how far a point is east and north of another', () => {
    const away = offsetMeters(VALENCIA, 300, -400);
    const offset = eastNorthMeters(VALENCIA, away);
    expect(offset.north).toBeCloseTo(300, 6);
    expect(offset.east).toBeCloseTo(-400, 6);
  });

  it('finds where a segment passes closest to a point', () => {
    const start = offsetMeters(VALENCIA, 0, -100);
    const end = offsetMeters(VALENCIA, 0, 300);
    const beside = nearestOnSegment(offsetMeters(VALENCIA, 40, 0), start, end);
    expect(beside.meters).toBeCloseTo(40, 0);
    expect(beside.along).toBeCloseTo(0.25, 2);
    expect(distanceMeters(beside.at, VALENCIA)).toBeLessThan(0.5);
    // Beyond an end, the end itself.
    const past = nearestOnSegment(offsetMeters(VALENCIA, 0, 500), start, end);
    expect(past.along).toBe(1);
    expect(past.meters).toBeCloseTo(200, 0);
    // A segment of one point is that point.
    expect(nearestOnSegment(VALENCIA, start, start).meters).toBeCloseTo(100, 0);
  });
});
