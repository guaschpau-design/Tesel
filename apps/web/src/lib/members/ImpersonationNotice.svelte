<!-- Tells the user, once for each member, that someone writes as that member: another event arrived
     under one of theirs, or one under this device's name took a number it had not used yet
     (ADR-0103). The notice stays until closed, since what seems to come from that member may not. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { aliasOf } from './alias.ts';

  interface Props {
    t: Translate;
    /** Members someone else writes as (sync/group-intake.ts). */
    impersonated: ReadonlySet<NodeId>;
    members: GroupState['members'];
    self: NodeId;
  }

  let { t, impersonated, members, self }: Props = $props();

  /** Who the user has been told of. */
  let told: readonly NodeId[] = [];

  $effect(() => {
    const fresh = [...impersonated].filter((id) => !told.includes(id));
    if (fresh.length === 0) return;
    told = [...told, ...fresh];
    untrack(() => {
      for (const id of fresh) {
        const text =
          id === self
            ? t('impersonatedSelf')
            : t('impersonated', { name: aliasOf({ members }, id) });
        notices.show(text, { stays: true });
      }
    });
  });
</script>
