import { describe, expect, it } from 'vitest';

import { CADASTRES } from '../../cadastre/cadastre.ts';
import { servicesIn, viewPicture, type ViewService } from './view-picture.ts';

const VALENCIA = { west: -0.38, south: 39.46, east: -0.37, north: 39.47 };
/** Across the Bidasoa, Irun and Hendaye. */
const BIDASOA = { west: -1.8, south: 43.33, east: -1.76, north: 43.37 };
const [SPAIN, FRANCE] = CADASTRES;

describe('pictures of the view from map services', () => {
  it('asks each country in view, and no other', () => {
    expect(servicesIn(CADASTRES, VALENCIA).map((service) => service.id)).toEqual(['spain']);
    expect(servicesIn(CADASTRES, BIDASOA).map((service) => service.id)).toEqual([
      'spain',
      'france',
    ]);
  });

  it('asks for one picture of the view in Web Mercator, and puts it at the view’s corners', () => {
    if (SPAIN === undefined) throw new Error('no Spanish cadastre');
    const image = viewPicture(SPAIN, VALENCIA, 800, 600);
    const query = new URL(image.url).searchParams;
    expect(query.get('SRS')).toBe('EPSG:3857');
    expect(query.get('LAYERS')).toBe('Catastro');
    expect([query.get('WIDTH'), query.get('HEIGHT')]).toEqual(['800', '600']);
    const [west, south, east, north] = (query.get('BBOX') ?? '').split(',').map(Number);
    expect(west).toBeCloseTo(-42_301, 0);
    expect(north ?? 0).toBeGreaterThan(south ?? 0);
    expect(east ?? 0).toBeGreaterThan(west ?? 0);
    expect(image.coordinates).toEqual([
      [-0.38, 39.47],
      [-0.37, 39.47],
      [-0.37, 39.46],
      [-0.38, 39.46],
    ]);
  });

  it('names the projection as each WMS version does', () => {
    if (FRANCE === undefined) throw new Error('no French cadastre');
    const query = new URL(viewPicture(FRANCE, BIDASOA, 800, 600).url).searchParams;
    expect(query.get('CRS')).toBe('EPSG:3857');
    expect(query.get('SRS')).toBeNull();
  });

  it('keeps the picture within the largest the services draw, in proportion', () => {
    if (SPAIN === undefined) throw new Error('no Spanish cadastre');
    const query = new URL(viewPicture(SPAIN, VALENCIA, 4096, 1024).url).searchParams;
    expect([query.get('WIDTH'), query.get('HEIGHT')]).toEqual(['2048', '512']);
  });

  it('adds what the service needs worked out at the time, such as the day', () => {
    if (SPAIN === undefined) throw new Error('no Spanish cadastre');
    const daily: ViewService = { ...SPAIN, extra: () => ({ TIME: '2026-11-08' }) };
    expect(new URL(viewPicture(daily, VALENCIA, 800, 600).url).searchParams.get('TIME')).toBe(
      '2026-11-08',
    );
  });
});
