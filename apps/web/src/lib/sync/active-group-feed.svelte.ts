// The feed of the active group, open while the calling component lives. Position sharing follows
// it, and if it cannot be opened the user is told and can try again.

import { untrack } from 'svelte';

import type { Translate } from '../i18n/index.ts';
import type { PositionSharing } from '../position/position-sharing.svelte.ts';
import type { Session } from '../session.svelte.ts';
import type { AppDb } from '../storage/app-db.ts';
import { storageRefusals } from '../storage/storage-space.svelte.ts';
import { notices } from '../ui/notices.svelte.ts';
import { GroupFeed } from './group-feed.svelte.ts';

/** What opening a group waits for, as starting up provides it (storage/startup.svelte.ts). */
interface Started {
  readonly db: AppDb | undefined;
  readonly session: Session | undefined;
  readonly sharing: PositionSharing | undefined;
}

/** Opens the active group's feed, and again whenever the group or this device's identity change. */
export function useActiveGroupFeed(
  startup: Started,
  t: () => Translate,
): { readonly feed: GroupFeed | undefined } {
  let feed: GroupFeed | undefined = $state.raw();
  /** Bumped to open the group again after opening it failed. */
  let openings = $state(0);

  // One feed for the active group. It is reopened only when what it depends on changes, not
  // whenever the list of groups is reloaded, or when the user tries again after it failed.
  const feedKey = $derived.by(() => {
    const group = startup.session?.activeGroup;
    const identity = startup.session?.identity;
    if (!group || !identity) return null;
    // Not the alias: a new name is told to the open group (rename), without opening it again.
    return [group.id, group.server ?? '', group.role, identity.nodeId, openings].join('|');
  });

  $effect(() => {
    if (feedKey === null) return;
    const group = untrack(() => startup.session?.activeGroup);
    const identity = untrack(() => startup.session?.identity);
    const database = startup.db;
    const positions = startup.sharing;
    if (!database || !positions || !group || !identity) return;
    let opened: GroupFeed | undefined;
    let failure: number | undefined;
    let cancelled = false;
    GroupFeed.open(database, group, identity).then(
      (created) => {
        if (cancelled) {
          created.close();
          return;
        }
        opened = created;
        feed = created;
        positions.attach(created);
      },
      (error: unknown) => {
        console.warn('The group could not be opened', error);
        if (cancelled || storageRefusals.note(error)) return;
        const translate = t();
        failure = notices.show(translate('groupOpenFailed'), {
          stays: true,
          action: { label: translate('tryAgain'), run: () => openings++ },
        });
      },
    );
    return () => {
      cancelled = true;
      if (failure !== undefined) notices.withdraw(failure);
      positions.detach();
      opened?.close();
      feed = undefined;
    };
  });

  return {
    get feed() {
      return feed;
    },
  };
}
