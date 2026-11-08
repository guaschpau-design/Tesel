import { describe, expect, it } from 'vitest';

import { viewPicture } from '../map/wms/view-picture.ts';
import { FIRES, floodServices, gibsDay } from './hazards.ts';

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

  it('asks the app’s server for the flood zones of the view, and nothing without one', () => {
    const [floods] = floodServices('https://tesel.eu/');
    if (floods === undefined) throw new Error('no flood zones');
    const url = new URL(viewPicture(floods, VALENCIA, 800, 600).url);
    expect(`${url.origin}${url.pathname}`).toBe('https://tesel.eu/v1/flood-zones');
    expect(url.searchParams.get('CRS')).toBe('EPSG:3857');
    expect(floodServices(null)).toEqual([]);
  });
});
