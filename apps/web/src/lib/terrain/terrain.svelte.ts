// The elevation readers, one for the device (ADR-0048). `reader` is for the climbs shown on their
// own (the guidance card, a point's distance): null while the relief is off, so that nothing asks
// for elevation tiles by itself; the app sets it as the relief is switched. `onDemand` is for what
// the user opens to see, an elevation profile (ADR-0115): there as soon as elevations can be read.

import type { ElevationReader } from './elevation.ts';

export const terrain = $state({
  reader: null as ElevationReader | null,
  onDemand: null as ElevationReader | null,
});
