<!-- Raises the alarm (alarm.ts) when an SOS of someone else arrives while the app is open, whatever
     is on screen: drawing, a panel or another app. What was already there when the group opened is
     not news. Screen readers hear it too (ui/announcer.svelte.ts), and what would cover its card
     steps aside (`oninterrupt`): the chat fills the screen. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';
  import { onMount, untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { announcer } from '../ui/announcer.svelte.ts';
  import { prepareAlarmSound, raiseAlarm, type AlarmChoices, type AlarmMessage } from './alarm.ts';
  import { activeSos } from './incidents.ts';
  import { SOS_KINDS } from './sos-kinds.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    choices: AlarmChoices;
    /** A new SOS arrived: what covers its card should step aside. */
    oninterrupt: () => void;
  }

  let { t, groupState, self, choices, oninterrupt }: Props = $props();

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

  let known: ReadonlySet<string> | null = null;
  $effect(() => {
    const current = calls;
    const previous = known;
    known = new Set(current.map(({ tag }) => tag));
    if (previous === null) return;
    const fresh = current.find(({ tag }) => !previous.has(tag));
    if (fresh === undefined) return;
    raiseAlarm(fresh, choices);
    announcer.say(`${fresh.title}. ${fresh.body}`);
    untrack(oninterrupt);
  });
</script>
