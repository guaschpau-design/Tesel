// The radio link on show (ADR-0159): set by the panel that worked it out, drawn on the map by
// RadioLinkLayer.svelte while that panel is open; and the antennas' height chosen, kept for the
// next link.

import type { LatLon } from '@tesel/protocol';

import type { AntennaHeight, RadioLink } from './radio-link.ts';

export interface ShownLink {
  readonly from: LatLon;
  readonly to: LatLon;
  readonly link: RadioLink;
}

interface RadioLinks {
  shown: ShownLink | null;
  antenna: AntennaHeight;
}

export const radioLinks: RadioLinks = $state({ shown: null, antenna: 1.5 });
