<!-- While the chat is closed, a notice for a line from another member: who, how it starts, and
     "View", which opens the chat. One at a time: a newer line takes the place of the one before,
     and opening the chat withdraws it.
     Lines from before the group opened, or caught up on after a while away, are not news. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { eventRefKey, type NodeId } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import { RECENT_S } from '../groups/group-news.ts';
  import type { Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import { shorten } from '../text.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { openPanel } from '../ui/panels.svelte.ts';
  import { CHAT } from './chat-tabs.ts';

  interface Props {
    t: Translate;
    chat: GroupState['chat'];
    members: GroupState['members'];
    self: NodeId;
    /** The chat is open: its lines are in view. */
    open: boolean;
  }

  let { t, chat, members, self, open }: Props = $props();

  /** The longest start of a line a notice shows. */
  const PREVIEW = 60;

  let seen = untrack(() => new Set(chat.map(eventRefKey)));
  let shown: number | null = null;

  function withdraw(): void {
    if (shown !== null) notices.withdraw(shown);
    shown = null;
  }

  $effect(() => {
    if (open) withdraw();
  });

  $effect(() => {
    const now = Date.now() / 1000;
    const latest = chat.findLast(
      (line) => !seen.has(eventRefKey(line)) && line.origin !== self && now - line.time <= RECENT_S,
    );
    seen = new Set(chat.map(eventRefKey));
    if (latest === undefined || untrack(() => open)) return;
    const said = t('chatNotice', {
      name: aliasOf({ members }, latest.origin),
      text: shorten(latest.text, PREVIEW),
    });
    withdraw();
    shown = notices.show(said, {
      action: {
        label: t('view'),
        run: () => {
          openPanel(CHAT);
        },
      },
    });
  });
</script>
