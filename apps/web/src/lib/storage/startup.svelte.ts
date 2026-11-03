// Starting the app: opening its two databases, the tile store and the app's own, and what waits
// for each (offline maps and relief; preferences, the session, position sharing, the radio's texts
// and weather warnings). What it opens is reactive, so that what waits for it runs whatever order
// it comes in. A database another window holds, or has taken over, stops the app with a reason
// (version-change.ts) instead of leaving it waiting; one a newer window wants is handed over only
// once nothing holds this window (`hold`).

import { SvelteSet } from 'svelte/reactivity';

import { basemapUrl, defaultServerUrl } from '../config.ts';
import { alarmedSos } from '../incidents/alarmed-sos.ts';
import { registerContourProtocol } from '../map/style/contours.ts';
import { findTile, registerTileProtocol, tileArchives } from '../map/tiles/protocol.ts';
import { openTileStore } from '../map/tiles/store.ts';
import type { OfflineMaps } from '../offline/offline-maps.ts';
import { keepOverview } from '../offline/overview.ts';
import { deviceLocation } from '../position/device-location.svelte.ts';
import { hideInOtherGroups } from '../position/hide-position.ts';
import { PositionSharing } from '../position/position-sharing.svelte.ts';
import { radio } from '../radio/radio.svelte.ts';
import { Session } from '../session.svelte.ts';
import { loadPreferences, type Preferences } from '../settings/preferences.ts';
import { ElevationReader } from '../terrain/elevation.ts';
import { fullscreenAtFirstTap, fullscreenSupported } from '../ui/fullscreen.svelte.ts';
import { WeatherFeed } from '../weather/weather-feed.svelte.ts';
import { openAppDb, type AppDb } from './app-db.ts';
import { makeRoomWith } from './storage-space.svelte.ts';
import type { StartupFailure, VersionChange } from './version-change.ts';

export class Startup {
  /** Downloaded maps, once their database is open. */
  offline: OfflineMaps | undefined = $state.raw();
  /** Heights of the ground, read from the tile store once it is open. */
  elevations: ElevationReader | null = $state.raw(null);
  db: AppDb | undefined = $state.raw();
  session: Session | undefined = $state();
  preferences: Preferences | undefined = $state.raw();
  sharing: PositionSharing | undefined = $state.raw();
  /** Official weather warnings from the app's own server, once the database is open. */
  weather: WeatherFeed | null = $state.raw(null);
  /** Why the app cannot start, while it cannot. */
  failure: StartupFailure | null = $state(null);

  readonly #archives = tileArchives(basemapUrl());
  /** Whether this window must not stop now (`hold`). */
  #holding = false;
  /** Databases a newer window waits for, handed over once nothing holds this window. */
  #handOver: (() => void)[] = [];

  /**
   * Says whether this window must not stop now: an own SOS is open or a radio is linked. A newer
   * version of the app in another window then waits for the databases, and says so there, until
   * neither holds this one, as reloads wait (ADR-0093, ADR-0111).
   */
  hold(holding: boolean): void {
    this.#holding = holding;
    if (holding) return;
    const handOver = this.#handOver;
    this.#handOver = [];
    for (const letGo of handOver) letGo();
  }

  /** Opens both databases and what waits for them; returns what stops what was started. */
  start(): () => void {
    /** The databases waiting for another window to let them go. */
    const blocked = new SvelteSet<string>();
    const versionChange = (database: string): VersionChange => ({
      onBlocked: () => {
        blocked.add(database);
        this.failure = 'blocked';
      },
      onReplaced: (letGo) => {
        const handOver = () => {
          letGo();
          this.failure = 'replaced';
        };
        if (this.#holding) this.#handOver.push(handOver);
        else handOver();
      },
    });
    const failed = (error: unknown) => {
      console.error('Tesel could not start', error);
      this.failure = 'failed';
    };
    /** A database that waited for another window opened: the app goes on once none waits. */
    const opened = (database: string) => {
      blocked.delete(database);
      if (blocked.size === 0 && this.failure === 'blocked') this.failure = null;
    };

    const archives = this.#archives;
    openTileStore(undefined, versionChange('tiles')).then((store) => {
      opened('tiles');
      registerTileProtocol(store, archives);
      registerContourProtocol(store, archives);
      this.elevations = new ElevationReader((tile) => findTile('terrain', tile, store, archives));
      this.offline = { store, archives };
      makeRoomWith(() => store.forgetViewed());
      void keepOverview(store, archives);
    }, failed);
    const server = defaultServerUrl();
    let stopWaitingForTap: (() => void) | undefined;
    openAppDb(undefined, versionChange('app'))
      .then(async (database) => {
        opened('app');
        this.db = database;
        if (server !== null) this.weather = WeatherFeed.start(database, server);
        await radio.useStorage(database);
        // Before any group opens: what was alarmed for before does not sound again.
        await alarmedSos.useStorage(database);
        const preferences = await loadPreferences(database);
        this.preferences = preferences;
        if (fullscreenSupported && preferences.fullscreen.value) {
          stopWaitingForTap = fullscreenAtFirstTap();
        }
        // Hiding the position reaches the other groups too, through the session as it is then.
        this.sharing = new PositionSharing(preferences.positionMode, deviceLocation, async () => {
          const { session } = this;
          const identity = session?.identity;
          if (session && identity) {
            await hideInOtherGroups(database, session.groups, identity, session.activeGroupId);
          }
        });
        this.session = await Session.load(database);
      })
      .catch(failed);

    return () => {
      stopWaitingForTap?.();
      this.weather?.stop();
    };
  }
}
