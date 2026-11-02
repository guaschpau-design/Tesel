// How many chat lines and reports of others in the active group are new here (unread.ts), and
// keeping them seen while the chat is open.

import type { NodeId } from '@tesel/protocol';
import { untrack } from 'svelte';

import { storageRefusals } from '../storage/storage-space.svelte.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { isOpen } from '../ui/panels.svelte.ts';
import { fromOthers } from './unread.ts';

/**
 * The count of what is new in the chat of `group`, none without one, kept up to date while the
 * calling component lives.
 */
export function useChatUnread(
  group: () => { readonly feed: GroupFeed; readonly self: NodeId } | null,
): { readonly count: number } {
  /** Chat lines and reports of others in the group. */
  const chatFromOthers = $derived.by(() => {
    const current = group();
    return current ? fromOthers(current.feed.state, current.self) : 0;
  });
  const count = $derived.by(() => {
    const current = group();
    return current ? Math.max(0, chatFromOthers - current.feed.chatSeen) : 0;
  });

  // While the chat is open, what arrives in it is seen.
  $effect(() => {
    const current = group();
    if (current === null || !isOpen('chat')) return;
    const { feed } = current;
    const seen = chatFromOthers;
    untrack(() => feed.markChatSeen(seen)).catch((error: unknown) => {
      storageRefusals.note(error);
      console.warn('Keeping what the chat has shown failed', error);
    });
  });

  return {
    get count() {
      return count;
    },
  };
}
