// When two windows of the app use the same database, as a browser tab and the installed app on
// Android do, a new version in one cannot upgrade the database while the other holds it open.
// Both databases (app-db.ts, map/tiles/store.ts) tell the app so, instead of waiting forever. A
// window with an own SOS open or a radio linked lets them go only once neither holds it
// (ADR-0093, ADR-0111): the new window says it waits meanwhile.

export interface VersionChange {
  /** This window waits to upgrade the database: another window of an older version holds it. */
  readonly onBlocked: () => void;
  /**
   * Another window, of a newer version, wants to upgrade it: this window lets the database go with
   * `letGo`, at once or once nothing holds it, and must then reload to go on.
   */
  readonly onReplaced: (letGo: () => void) => void;
}

/** Nothing to tell anyone: for tests and tools that open the databases on their own. */
export const IGNORE_VERSION_CHANGE: VersionChange = {
  onBlocked: () => undefined,
  onReplaced: (letGo) => {
    letGo();
  },
};

/**
 * Why the app cannot start: its storage is held by an older window (`blocked`), was handed to a
 * newer one (`replaced`), or cannot be opened at all (`failed`).
 */
export type StartupFailure = 'blocked' | 'replaced' | 'failed';
