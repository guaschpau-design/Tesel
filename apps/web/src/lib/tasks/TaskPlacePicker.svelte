<!-- Picking a task's place on the map, from the task's form: the form steps aside, a tap on the
     map, or coordinates typed on the card, is the place, and the form opens again as it was left,
     with the place in it. Closing the card goes back to the form as it was. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import { onMount } from 'svelte';

  import CoordinateEntry from '../coordinates/CoordinateEntry.svelte';
  import type { Translate } from '../i18n/index.ts';
  import type { MapTaps } from '../map/taps.ts';
  import ToolButton from '../ui/ToolButton.svelte';
  import ToolCard from '../ui/ToolCard.svelte';
  import { openPanel } from '../ui/panels.svelte.ts';
  import type { TaskEditing } from './tasks.ts';

  interface Props {
    t: Translate;
    taps: MapTaps;
    /** The task being edited, with what its form held. */
    editing: TaskEditing;
    /** Ends the picking. */
    onclose: () => void;
  }

  let { t, taps, editing, onclose }: Props = $props();

  /** Back to the task's form, with the place picked if any. */
  function back(at: LatLon | null): void {
    const { draft } = editing;
    const picked =
      at === null || draft === undefined
        ? editing
        : { ...editing, draft: { ...draft, place: { kind: 'point' as const, at } } };
    onclose();
    openPanel({ name: 'tasks', editing: picked });
  }

  /** Whether the field for the place's coordinates is open. */
  let typing = $state(false);

  onMount(() =>
    taps.takeAll((at) => {
      back(at);
    }),
  );
</script>

<ToolCard
  label={t('taskPickPlace')}
  closeLabel={t('cancel')}
  onclose={() => {
    back(null);
  }}
>
  {#snippet tools()}
    <ToolButton
      icon="grid"
      label={t('coordinates')}
      name={t('typeCoordinates')}
      expanded={typing}
      onclick={() => (typing = !typing)}
    />
  {/snippet}
  <p>{t('taskPickPlaceHint')}</p>
  {#if typing}
    <CoordinateEntry {t} action={t('use')} onpoint={back} />
  {/if}
</ToolCard>
