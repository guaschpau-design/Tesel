<!-- Calling for help: the SOS dialog while `open`, and a notice of what became of the call once
     sent (protocol §3.8). Once sent, any open panel closes: the call's card, which says who has
     received it and cancels it, must be in view. -->
<script lang="ts">
  import type { LatLon, SosKind } from '@tesel/protocol';

  import type { MessageKey, Translate } from '../i18n/index.ts';
  import type { Delivery } from '../sync/group-sync.svelte.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { closePanel } from '../ui/panels.svelte.ts';
  import type { WorkspaceGroup } from '../workspace/workspace.ts';
  import { callForHelp } from './call-for-help.ts';
  import SosDialog from './SosDialog.svelte';

  interface Props {
    t: Translate;
    group: WorkspaceGroup;
    /** The dialog is open: the dock's SOS button and "I need help" open it. */
    open: boolean;
    /** Closes the dialog: the call was sent, or the user cancelled it. */
    onclose: () => void;
  }

  let { t, group, open, onclose }: Props = $props();

  async function send(
    kind: SosKind,
    at: LatLon | null,
    accuracy: number | null,
    text: string,
  ): Promise<void> {
    await callForHelp(group.feed, kind, at === null ? null : { at, accuracy }, text);
    onclose();
    closePanel();
    notices.show(t(OUTCOMES[group.feed.delivery]));
  }

  /** What became of the call: it is with the group, on its way by radio, or waiting. */
  const OUTCOMES: Readonly<Record<Delivery, MessageKey>> = {
    group: 'sosSent',
    radio: 'sosByRadio',
    waiting: 'sosWaiting',
  };
</script>

{#if open}
  <SosDialog {t} onsend={send} oncancel={onclose} />
{/if}
