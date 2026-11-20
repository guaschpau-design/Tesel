import { describe, expect, it } from 'vitest';

import { mapDefaults } from './map-defaults.ts';

describe('what each base map shows when chosen', () => {
  it('the topographic map: relief and fires, bearings in degrees', () => {
    const topo = mapDefaults('topo');
    expect(topo.flags).toEqual({
      relief: true,
      slope: false,
      cadastre: false,
      fires: true,
      floods: false,
      grid: false,
      radar: false,
    });
    expect([topo.bearingUnit, topo.north]).toEqual(['degrees', 'true']);
  });

  it('the urban map: flood zones and the radar', () => {
    const { flags } = mapDefaults('urban');
    expect(Object.entries(flags).filter(([, on]) => on)).toEqual([
      ['floods', true],
      ['radar', true],
    ]);
  });

  it('the tactical map: relief, slopes, radar and the grid, in mils and MGRS', () => {
    const tactical = mapDefaults('tactical');
    expect(Object.entries(tactical.flags).filter(([, on]) => on)).toEqual([
      ['relief', true],
      ['slope', true],
      ['grid', true],
      ['radar', true],
    ]);
    expect([tactical.bearingUnit, tactical.north]).toEqual(['mils', 'magnetic']);
    expect(tactical.coordinates('decimal')).toBe('mgrs');
  });

  it('shows the services and hides the weather warnings, keeping the rest as the user left it', () => {
    expect(mapDefaults('urban').hidden(['services', 'trails'])).toEqual(['trails', 'weather']);
  });

  it('leaves MGRS for the tactical map, keeping another format chosen', () => {
    expect(mapDefaults('topo').coordinates('mgrs')).toBe('decimal');
    expect(mapDefaults('urban').coordinates('utm')).toBe('utm');
  });
});
