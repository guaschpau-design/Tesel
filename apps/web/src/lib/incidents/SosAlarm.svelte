<!-- Raises the alarm (alarm.ts) for an SOS of someone else in the open group, whatever is on
     screen: drawing, a panel or another app. Each call sounds once (alarmed-sos.ts): one that came
     in while the group was closed sounds as it opens, but not one heard by radio and alarmed for
     then (sos-elsewhere.svelte.ts), nor one that sounded before a reload. Screen readers hear it
     too (ui/announcer.svelte.ts), and what would cover its card steps aside (`oninterrupt`): the
     chat fills the screen. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import { onMount, untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { activity } from '../power/activity.svelte.ts';
  import { announcer } from '../ui/announcer.svelte.ts';
  import { alarmedSos } from './alarmed-sos.ts';
  import { prepareAlarmSound, raiseAlarm, type AlarmChoices, type AlarmMessage } from './alarm.ts';
  import { activeSos } from './incidents.ts';
  import { SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    groupId: string;
    groupState: GroupState;
    self: NodeId;
    choices: AlarmChoices;
    /** A new SOS arrived: what covers its card should step aside. */
    oninterrupt: () => void;
  }

  let { t, groupId, groupState, self, choices, oninterrupt }: Props = $props();

  onMount(prepareAlarmSound);

  /** The SOS calls of others, each tagged with its event's key. */
  const calls = $derived(
    activeSos(groupState, self)
      .filter((call) => !call.mine)
      .map((call): AlarmMessage => ({
        title: `${t('sos')} · ${call.author}`,
        body: [t(SOS_KINDS[call.event.kind].label), call.event.text].filter(Boolean).join(' · '),
        tag: call.key,
      })),
  );

  $effect(() => {
    const current = calls;
    const unheard = new Set(
      alarmedSos.claim(
        groupId,
        current.map(({ tag }) => tag),
      ),
    );
    const fresh = current.filter(({ tag }) => unheard.has(tag));
    if (fresh.length === 0) return;
    raiseAlarm(fresh, choices);
    // A screen at rest lights up for it (power/).
    activity.wake();
    announcer.say(fresh.map(({ title, body }) => `${title}. ${body}`).join(' '));
    untrack(oninterrupt);
  });
</script>
