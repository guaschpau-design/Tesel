import { distanceMeters } from '@tesel/core';
import { describe, expect, it } from 'vitest';

import { climbOf, samplesAlong } from './climb.ts';
import { tileAt } from '../map/tiles/math.ts';
import { TERRAIN_MAX_ZOOM } from '../map/tiles/sources.ts';
import { ElevationReader, terrariumMetres, type Pixels } from './elevation.ts';

const A = { lat: 39.47, lon: -0.37 };
const B = { lat: 39.48, lon: -0.37 }; // about 1112 m north

describe('elevation tiles', () => {
  it('decodes Terrarium pixels', () => {
    expect(terrariumMetres(128, 0, 0)).toBe(0);
    expect(terrariumMetres(128, 100, 128)).toBe(100.5);
    expect(terrariumMetres(127, 255, 0)).toBe(-1);
  });

  it('reads elevations, and says null where the tiles cannot be had', async () => {
    // Every pixel of the fake tile is 250.5 m, except where it is "offline".
    const pixels: Pixels = {
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        128, 250, 128, 255, 128, 250, 128, 255, 128, 250, 128, 255, 128, 250, 128, 255,
      ]),
    };
    let loads = 0;
    const reader = new ElevationReader(
      (tile) => {
        loads++;
        return Promise.resolve(tile.y % 2 === 0 ? new ArrayBuffer(1) : undefined);
      },
      () => Promise.resolve(pixels),
    );
    const near = { lat: 39.47, lon: -0.37 };
    const [first] = await reader.elevations([near, near]);
    const { tile } = tileAt(near, TERRAIN_MAX_ZOOM);
    expect(first).toBe(tile.y % 2 === 0 ? 250.5 : null);
    expect(loads).toBe(1);
  });

  it('tries a tile again once it could not be had, and keeps one it read', async () => {
    const pixels: Pixels = { width: 1, height: 1, data: new Uint8ClampedArray([128, 10, 0, 255]) };
    let online = false;
    let loads = 0;
    const reader = new ElevationReader(
      () => {
        loads++;
        return online ? Promise.resolve(new ArrayBuffer(1)) : Promise.reject(new Error('offline'));
      },
      () => Promise.resolve(pixels),
    );
    expect(await reader.elevations([A])).toEqual([null]);
    online = true;
    expect(await reader.elevations([A])).toEqual([10]);
    expect(await reader.elevations([A])).toEqual([10]);
    expect(loads).toBe(2);
  });
});

describe('climb along a way', () => {
  it('samples about every 30 m, both ends included', () => {
    const samples = samplesAlong([A, B]);
    expect(samples.length).toBe(39);
    expect(samples[0]).toEqual(A);
    expect(samples.at(-1)).toEqual(B);
  });

  it('spreads the samples evenly along a path of several stretches, through its corners', () => {
    const corner = { lat: 39.47, lon: -0.36 };
    const end = { lat: 39.48, lon: -0.36 };
    const samples = samplesAlong([A, corner, end]);
    expect(samples[0]).toEqual(A);
    expect(samples.at(-1)?.lat).toBeCloseTo(end.lat, 9);
    expect(samples.at(-1)?.lon).toBeCloseTo(end.lon, 9);
    const gaps = samples.slice(1).map((sample, i) => distanceMeters(samples[i] ?? sample, sample));
    // Even, but for the one gap that cuts the corner, and shorter.
    const sorted = [...gaps].sort((a, b) => a - b);
    expect((sorted.at(-1) ?? 0) - (sorted[1] ?? 0)).toBeLessThan(0.5);
  });

  it('adds up ups and downs and finds the steepest stretch', () => {
    const samples = samplesAlong([A, B]);
    // Up 60 m over the first 290 m, then down 10 m, then flat.
    const elevations = samples.map((_, i) => (i <= 10 ? i * 6 : i <= 15 ? 60 - (i - 10) * 2 : 50));
    const climb = climbOf(samples, elevations);
    expect(climb?.up).toBeCloseTo(60);
    expect(climb?.down).toBeCloseTo(10);
    // 6 m every 29.3 m.
    expect(climb?.steepest).toBeCloseTo(20.5, 0);
  });

  it('gives no climb when any elevation is unknown', () => {
    const samples = samplesAlong([A, B]);
    expect(
      climbOf(
        samples,
        samples.map((_, i) => (i === 3 ? null : 0)),
      ),
    ).toBeNull();
  });
});
