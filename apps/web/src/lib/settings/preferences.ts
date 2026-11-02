// Every preference this device remembers, in one place: what it is, its choices and its default.

import { COORDINATE_FORMATS } from '../coordinates/coordinates.ts';
import { LANGUAGE_CHOICES } from '../i18n/index.ts';
import { MAP_LAYERS } from '../map/layers.ts';
import { BASE_MAPS } from '../map/style/style.ts';
import { DUTY_STATUSES, EQUIPMENT, PROFILES } from '../members/member-catalog.ts';
import { POSITION_MODES } from '../position/position-mode.ts';
import type { AppDb } from '../storage/app-db.ts';
import { choice, flag, Preference, subset, type PreferenceSpec } from './preference.svelte.ts';

const PREFERENCES = {
  /** How this device shares its position: hidden until the user chooses otherwise. */
  positionMode: choice('positionMode', POSITION_MODES, 'hidden'),
  /** What this person does, as the team sees it: unspecified until chosen in Me. */
  profile: choice(
    'profile',
    PROFILES.map((item) => item.value),
    'unspecified',
  ),
  /** Whether this person can be counted on now: active, until changed in Me. */
  dutyStatus: choice(
    'dutyStatus',
    Object.keys(DUTY_STATUSES) as (keyof typeof DUTY_STATUSES)[],
    'active',
  ),
  /** What this person carries: nothing marked at first. */
  equipment: subset(
    'equipment',
    EQUIPMENT.map((item) => item.value),
    [],
  ),
  /** How coordinates are written: decimal degrees, as phones and 112 apps share them. */
  coordinateFormat: choice('coordinateFormat', COORDINATE_FORMATS, 'decimal'),
  /** The map under everything: the street map, which covers everywhere and is the lightest. */
  baseMap: choice('baseMap', BASE_MAPS, 'streets'),
  /** Shading of the terrain: off at first, as it downloads elevation data. */
  relief: flag('relief', false),
  /** The MGRS grid over the map: off, for those who coordinate in it. */
  grid: flag('grid', false),
  /** The radar around this device: off, as it keeps the GPS on. */
  radar: flag('radar', false),
  /** The cadastre's parcels: off, as it asks a public service for a picture of every view. */
  cadastre: flag('cadastre', false),
  /** Map layers the user has hidden: none at first. */
  hiddenLayers: subset('hiddenLayers', MAP_LAYERS, []),
  /**
   * Saving energy: the screen goes dark after a minute untouched and the GPS runs at intervals
   * after ten, the app still working (power/). On, since phones must last an operation.
   */
  energySaving: flag('energySaving', true),
  /** Keep the screen on while the app is open: off, to spare the battery. */
  keepScreenOn: flag('keepScreenOn', false),
  /** The app over the whole screen, where a browser tab allows it: on, until switched off in More. */
  fullscreen: flag('fullscreen', true),
  /** A tone for an SOS of someone else: on, since it must not be missed. */
  alarmSound: flag('alarmSound', true),
  /** System notifications for them while the app is not on screen: off until the user allows them. */
  notifications: flag('notifications', false),
  /** The interface's language: the browser's, until one is chosen in More. */
  language: choice('language', LANGUAGE_CHOICES, 'auto'),
};

type Specs = typeof PREFERENCES;
type ValueOf<S> = S extends PreferenceSpec<infer T> ? T : never;

/** The preferences the interface reads and changes as the user works: one for each above. */
export type Preferences = { readonly [K in keyof Specs]: Preference<ValueOf<Specs[K]>> };

/** Reads every preference in one transaction. */
export async function loadPreferences(db: AppDb): Promise<Preferences> {
  await moveRenamed(db);
  const settings = db.transaction('settings').store;
  const entries = await Promise.all(
    Object.entries(PREFERENCES).map(async ([name, spec]: [string, PreferenceSpec<unknown>]) => {
      const preference = Preference.fromStored(db, spec, await settings.get(spec.key));
      return [name, preference] as const;
    }),
  );
  // Each entry was made from the spec under the same name, which is what the type says.
  return Object.fromEntries(entries) as Preferences;
}

/**
 * Moves settings stored under an older name to their present one, so each user keeps the choice
 * made before the rename: the MGRS grid's switch was `mgrsGrid` until it took the layer's name.
 */
async function moveRenamed(db: AppDb): Promise<void> {
  const settings = db.transaction('settings', 'readwrite').store;
  const grid = await settings.get('mgrsGrid');
  if (grid !== undefined) {
    await settings.put(grid, 'grid');
    await settings.delete('mgrsGrid');
  }
}
