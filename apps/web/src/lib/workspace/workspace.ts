// What the workspace's parts share: the active group as they see it, and the tools that take taps
// on the map.

import type { NodeId, Role } from '@tesel/protocol';

import type { PositionSharing } from '../position/position-sharing.svelte.ts';
import type { TaskEditing } from '../tasks/tasks.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';

/** The active group's feed and this device's place in it. */
export interface WorkspaceGroup {
  readonly feed: GroupFeed;
  readonly self: NodeId;
  readonly role: Role;
  readonly sharing: PositionSharing;
}

/** The name this device goes by, which Me shows and changes. */
export interface SelfName {
  readonly alias: string;
  /** Changes it; rejects if it could not be saved. */
  readonly rename: (alias: string) => Promise<void>;
}

/**
 * A tool in use on the map, which takes its taps: measuring, or planning the
 * sweep of a search area, by its key.
 */
export type MapTool =
  | { readonly kind: 'measure' }
  | { readonly kind: 'sweep'; readonly area: string }
  /** Picking the place of the task being edited, which the tasks panel opens on again. */
  | { readonly kind: 'task-place'; readonly editing: TaskEditing };
