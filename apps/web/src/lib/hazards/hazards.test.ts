import { describe, expect, it } from 'vitest';

import { viewPicture } from '../map/wms/view-picture.ts';
import { FIRES, FLOODS, gibsDay } from './hazards.ts';

const VALENCIA = { west: -0.5, south: 39.3, east: -0.2, north: 39.6 };

describe('hazards', () => {
  it('names days in UTC as GIBS does, today and the days before', () => {
    const now = Date.UTC(2026, 10, 8, 0, 30);
    expect(gibsDay(0, now)).toBe('2026-11-08');
    expect(gibsDay(1, now)).toBe('2026-11-07');
  });

  it('asks GIBS for each satellite’s fires of yesterday and today, in Web Mercator', () => {
    expect(FIRES).toHaveLength(6);
    const days = new Set<string>();
    for (const service of FIRES) {
      const query = new URL(viewPicture(service, VALENCIA, 800, 600).url).searchParams;
      expect(query.get('LAYERS')).toMatch(/^VIIRS_\w+_Thermal_Anomalies_375m_All$/);
      expect(query.get('SRS')).toBe('EPSG:3857');
      days.add(query.get('TIME') ?? '');
    }
    expect([...days]).toEqual([gibsDay(1), gibsDay(0)]);
  });

  it('asks the SNCZI for the zones a 100-year flood reaches', () => {
    const [floods] = FLOODS;
    if (floods === undefined) throw new Error('no flood zones');
    const query = new URL(viewPicture(floods, VALENCIA, 800, 600).url).searchParams;
    expect(query.get('LAYERS')).toBe('NZ.RiskZone');
    expect(query.get('CRS')).toBe('EPSG:3857');
  });
});
