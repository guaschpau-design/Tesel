// The app's own IndexedDB database: identity, groups, settings and each group's event log.
// Map tiles live in a separate database (map/tiles/store.ts) so they can be cleared without
// touching anything else.

import type { NodeId, WeatherWarnings } from '@tesel/protocol';
import { openDB, unwrap, type DBSchema, type IDBPDatabase } from 'idb';

import type { StoredGroup } from '../groups/group.ts';
import type { LocalIdentity } from '../identity/identity.ts';
import type { StoredRadioText } from '../radio/radio-texts.ts';
import type { RelayPosition } from '../sync/relay-client.ts';
import { IGNORE_VERSION_CHANGE, type VersionChange } from './version-change.ts';

/** An event of a group, by the group and the event's reference: how the log and outbox key it. */
export interface GroupEventRef {
  readonly groupId: string;
  readonly origin: NodeId;
  readonly seq: number;
}

/** An event of a group as received or created: its encoded bytes, keyed by group and ref. */
interface StoredEvent extends GroupEventRef {
  readonly bytes: Uint8Array;
}

/**
 * An event waiting for the group's server to confirm it stored it (protocol §8): one of this
 * device's own, or one of another member that this device heard by radio and forwards.
 */
export interface OutboxEntry extends GroupEventRef {
  /** Own events only: sent over LoRa already, so a radio linked later need not send it again. */
  readonly aired?: true;
}

export type SettingKey =
  | 'activeGroupId'
  /** The group in use when a practice of the app's past started (ADR-0083, groups/group-store.ts). */
  | 'beforePractice'
  | 'positionMode'
  | 'profile'
  | 'dutyStatus'
  | 'equipment'
  | 'coordinateFormat'
  | 'baseMap'
  | 'relief'
  | 'grid'
  /** The grid's switch before it was renamed `grid`; moved by settings/preferences.ts. */
  | 'mgrsGrid'
  | 'radar'
  | 'cadastre'
  | 'hiddenLayers'
  | 'energySaving'
  | 'keepScreenOn'
  | 'fullscreen'
  | 'language'
  | 'alarmSound'
  | 'notifications'
  | 'radioChannelsToFree'
  /** The SOS calls the alarm was raised for, by group (incidents/alarmed-sos.ts). */
  | 'alarmedSos';

export type EventKey = [groupId: string, origin: NodeId, seq: number];

/** A group and the server it syncs with. */
type CursorKey = [groupId: string, server: string];

interface AppSchema extends DBSchema {
  /** A single record under the key `self`. */
  identity: { key: 'self'; value: LocalIdentity };
  groups: { key: string; value: StoredGroup };
  /** The active group and the preferences of this device (settings/preferences.ts). */
  settings: { key: SettingKey; value: unknown };
  /**
   * The next sequence number this device will use (ARCHITECTURE.md §3.3), and the time of its
   * last event, below which no later event is stamped (protocol §3.1).
   */
  sequence: { key: 'next' | 'lastTime'; value: number };
  events: { key: EventKey; value: StoredEvent; indexes: { byGroup: string } };
  outbox: { key: EventKey; value: OutboxEntry; indexes: { byGroup: string } };
  /** How far this device has read each group's envelopes on its server, and in which store. */
  cursors: { key: CursorKey; value: RelayPosition };
  /** Text messages of other apps (MeshCore or Meshtastic chat) heard by the radio, oldest first. */
  radioTexts: { key: number; value: StoredRadioText };
  /** The weather warnings last read from the server, under the key `latest` (protocol §8.2). */
  weather: { key: 'latest'; value: WeatherWarnings };
}

export type AppDb = IDBPDatabase<AppSchema>;

const DB_NAME = 'tesel';
const DB_VERSION = 7;

export async function openAppDb(
  name: string = DB_NAME,
  change: VersionChange = IGNORE_VERSION_CHANGE,
): Promise<AppDb> {
  const db: AppDb = await openDB<AppSchema>(name, DB_VERSION, {
    blocked: change.onBlocked,
    blocking() {
      db.close();
      change.onReplaced();
    },
    upgrade(database, oldVersion) {
      // Each step upgrades from the previous version; a new install runs all of them.
      if (oldVersion < 1) {
        database.createObjectStore('identity');
        database.createObjectStore('groups', { keyPath: 'id' });
        database.createObjectStore('settings');
      }
      if (oldVersion < 2) {
        database.createObjectStore('sequence');
        const events = database.createObjectStore('events', {
          keyPath: ['groupId', 'origin', 'seq'],
        });
        events.createIndex('byGroup', 'groupId');
        const outbox = database.createObjectStore('outbox', {
          keyPath: ['groupId', 'origin', 'seq'],
        });
        outbox.createIndex('byGroup', 'groupId');
        database.createObjectStore('cursors');
      }
      if (oldVersion < 3) {
        database.createObjectStore('radioTexts', { autoIncrement: true });
      }
      if (oldVersion < 4) {
        // Cursors are now kept per server; old ones are dropped and the backlog fetched again.
        // Version 4 also added a store, gone since version 7, of what servers said about themselves.
        database.deleteObjectStore('cursors');
        database.createObjectStore('cursors');
      }
      if (oldVersion < 5) {
        database.createObjectStore('weather');
      }
      if (oldVersion < 6) {
        // Cursors now name the server's store (protocol §8); old ones, of an unknown store, are
        // dropped and the backlog fetched again.
        database.deleteObjectStore('cursors');
        database.createObjectStore('cursors');
      }
      if (oldVersion < 7) {
        // What servers said about themselves served to choose between a server and its command
        // posts, which are no more (ADR-0058). The store is not in the schema any longer.
        const stores = unwrap(database);
        if (stores.objectStoreNames.contains('servers')) stores.deleteObjectStore('servers');
      }
    },
  });
  return db;
}
