import { describe, expect, it } from 'vitest';

import { CRITICAL_PLACES, SERVICE_KINDS, serviceKindOf } from './services.ts';

describe('services', () => {
  it('groups the base map kinds into a few services', () => {
    expect(serviceKindOf('hospital')?.id).toBe('health');
    expect(serviceKindOf('clinic')?.id).toBe('health');
    expect(serviceKindOf('pharmacy')?.id).toBe('pharmacy');
    expect(serviceKindOf('fuel')?.id).toBe('fuel');
    expect(serviceKindOf('fire_station')?.id).toBe('fire');
    expect(serviceKindOf('police')?.id).toBe('police');
  });

  it('leaves out everything else', () => {
    expect(serviceKindOf('supermarket')).toBeUndefined();
  });

  it('keeps the critical places of a town apart from the services', () => {
    expect(CRITICAL_PLACES.map((kind) => kind.id)).toEqual(['school']);
    expect(SERVICE_KINDS.map((kind) => kind.id)).not.toContain('school');
    expect(serviceKindOf('university')?.id).toBe('school');
  });

  it('gives each base map kind to one service only', () => {
    const all = SERVICE_KINDS.flatMap((kind) => kind.osmKinds);
    expect(new Set(all).size).toBe(all.length);
  });
});
