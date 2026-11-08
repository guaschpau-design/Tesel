// What the user can show or hide on the map, in the layers panel's order. This device and
// SOS calls are always shown.

import type { MessageKey } from '../i18n/index.ts';
import type { GlyphName } from '../ui/glyphs.ts';

/** Layers shown unless the user hides them; the hidden ones are a preference. */
export const MAP_LAYERS = [
  'members',
  'trails',
  'objects',
  'tasks',
  'reports',
  'services',
  'weather',
] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/** Layers off unless the user turns them on, each a preference of its own. */
export const MAP_FLAGS = ['relief', 'cadastre', 'fires', 'floods', 'grid', 'radar'] as const;
export type MapFlag = (typeof MAP_FLAGS)[number];

export type LayerSwitch = MapLayer | MapFlag;

export interface LayerSwitchInfo {
  readonly name: LayerSwitch;
  readonly label: MessageKey;
  readonly icon: GlyphName;
}

/**
 * Every switch of the layers panel, in its order and in two groups: what the group puts on the map,
 * then what the map itself can tell about the place.
 */
export const LAYER_GROUPS: readonly {
  readonly label: MessageKey;
  readonly switches: readonly LayerSwitchInfo[];
}[] = [
  {
    label: 'layersOfGroup',
    switches: [
      { name: 'members', label: 'layerMembers', icon: 'person' },
      { name: 'objects', label: 'layerObjects', icon: 'pin' },
      { name: 'tasks', label: 'layerTasks', icon: 'task' },
      { name: 'reports', label: 'layerReports', icon: 'pushpin' },
      { name: 'trails', label: 'layerTrails', icon: 'trail' },
    ],
  },
  {
    label: 'layersOfMap',
    switches: [
      { name: 'services', label: 'layerServices', icon: 'cross' },
      { name: 'weather', label: 'layerWeather', icon: 'cloud' },
      { name: 'relief', label: 'layerRelief', icon: 'relief' },
      { name: 'cadastre', label: 'layerCadastre', icon: 'parcel' },
      { name: 'fires', label: 'layerFires', icon: 'flame' },
      { name: 'floods', label: 'layerFloods', icon: 'waves' },
      { name: 'radar', label: 'layerRadar', icon: 'radar' },
      { name: 'grid', label: 'layerGrid', icon: 'grid' },
    ],
  },
];

export function isFlag(name: LayerSwitch): name is MapFlag {
  return (MAP_FLAGS as readonly string[]).includes(name);
}
