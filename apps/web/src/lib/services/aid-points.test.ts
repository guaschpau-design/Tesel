import { describe, expect, it } from 'vitest';

import { aidFacts } from './aid-points.ts';
import { AID_KINDS, serviceKindOf } from './services.ts';

describe('aid points', () => {
  it('are services of their own, by the kind the archive gives them', () => {
    expect(serviceKindOf('defibrillator')?.id).toBe('defibrillator');
    expect(serviceKindOf('fire_hydrant')?.id).toBe('hydrant');
    expect(serviceKindOf('drinking_water')?.id).toBe('water');
    // Defibrillators from further out than the thousands of hydrants and fountains.
    const zoom = (id: string) => AID_KINDS.find((kind) => kind.id === id)?.minZoom ?? 0;
    expect(zoom('defibrillator')).toBeLessThan(zoom('hydrant'));
  });

  it('tell what is known of them, and nothing for what is blank', () => {
    expect(
      aidFacts({ kind: 'defibrillator', where: 'Recepción', hours: '24/7', access: ' ' }),
    ).toEqual({
      where: 'Recepción',
      hours: '24/7',
      access: null,
      type: null,
    });
  });
});
