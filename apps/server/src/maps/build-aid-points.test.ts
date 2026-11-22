import { describe, expect, it } from 'vitest';

import { aidPoint, kindOf } from './build-aid-points.ts';

describe('aid points from OpenStreetMap', () => {
  it('knows a defibrillator, a hydrant and drinking water by their tags', () => {
    expect(kindOf({ emergency: 'defibrillator' })).toBe('defibrillator');
    expect(kindOf({ emergency: 'fire_hydrant' })).toBe('fire_hydrant');
    expect(kindOf({ amenity: 'drinking_water' })).toBe('drinking_water');
    expect(kindOf({ amenity: 'bench' })).toBeNull();
  });

  it('keeps of a point only what the app reads', () => {
    const point = aidPoint({
      type: 'node',
      id: 1,
      lat: 39.47,
      lon: -0.37,
      tags: {
        emergency: 'defibrillator',
        name: 'Polideportivo',
        'defibrillator:location': ' En la recepción ',
        opening_hours: '24/7',
        access: 'public',
        operator: 'Ayuntamiento',
      },
    });
    expect(point?.geometry.coordinates).toEqual([-0.37, 39.47]);
    expect(point?.properties).toEqual({
      kind: 'defibrillator',
      name: 'Polideportivo',
      where: 'En la recepción',
      hours: '24/7',
      access: 'public',
    });
  });

  it('places a point mapped as a building at its centre, and leaves out one with no place', () => {
    const building = aidPoint({
      type: 'way',
      id: 2,
      center: { lat: 41.1, lon: 1.2 },
      tags: { emergency: 'fire_hydrant', 'fire_hydrant:type': 'pillar' },
    });
    expect(building?.properties).toEqual({ kind: 'fire_hydrant', type: 'pillar' });
    expect(aidPoint({ type: 'relation', id: 3, tags: { amenity: 'drinking_water' } })).toBeNull();
  });
});
