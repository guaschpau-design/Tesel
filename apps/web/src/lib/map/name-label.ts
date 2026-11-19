// A person's name beside their dot on the map, written the same way for the other members
// (members/MemberLayer.svelte) and for this device (position/SelfLayer.svelte).

import type {
  DataDrivenPropertyValueSpecification,
  FilterSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';

import { themeColor } from '../ui/theme.ts';

export interface NameLabel {
  readonly id: string;
  readonly source: string;
  /** Which points of the source are named. */
  readonly filter: FilterSpecification;
  /** Whether the name shows even where it would cover another. */
  readonly overlap: boolean;
  readonly opacity?: DataDrivenPropertyValueSpecification<number>;
}

/**
 * Names of people close together would pile up into one unreadable word: each name tries below,
 * above and beside its dot, and is left out where none fits, unless it may overlap. The name is
 * the point's `label` property.
 */
export function nameLabel({
  id,
  source,
  filter,
  overlap,
  opacity = 1,
}: NameLabel): SymbolLayerSpecification {
  return {
    id,
    type: 'symbol',
    source,
    filter,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 13,
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 1.1,
      'text-allow-overlap': overlap,
    },
    paint: {
      'text-color': themeColor('map-text'),
      'text-halo-color': themeColor('map-halo'),
      'text-halo-width': 1.5,
      'text-opacity': opacity,
    },
  };
}
