<!-- What a member tells the team about themselves, the same for this device (in Me, where it is
     set) and for anyone tapped on the map, read from the top (ADR-0133): their status and tasks,
     then a card each for where they are and what they carry, and last two small ones for their
     battery and whether a LoRa radio is linked (which keeps them in touch without coverage). Their
     profile is a tag beside their name, over the sheet (ProfileTag). In Me the equipment shows
     what is carried, each with a way to drop it, and the rest is picked in a dialog. -->
<script lang="ts" module>
  import type { DutyStatus, Equipment } from '@tesel/protocol';

  /** How this device's own sheet changes what it tells. */
  export interface SheetEdits {
    onstatus: (status: DutyStatus) => void;
    onequipment: (equipment: readonly Equipment[]) => void;
    /** Opens where a LoRa radio is linked. */
    onconnectradio: () => void;
  }
</script>

<script lang="ts">
  import type { MemberStateEvent, TeamEvent } from '@tesel/protocol';
  import type { Snippet } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { editTask } from '../tasks/task-editor.ts';
  import type { TaskRow } from '../tasks/tasks.ts';
  import { TEAM_COLOURS } from '../teams/teams.ts';
  import { shownText } from '../text.ts';
  import Explained from '../ui/Explained.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import CarriedEquipment from './CarriedEquipment.svelte';
  import { DUTY_STATUSES, EQUIPMENT } from './member-catalog.ts';
  import SheetPart from './SheetPart.svelte';

  interface Props {
    t: Translate;
    state: Pick<MemberStateEvent, 'profile' | 'status' | 'battery' | 'equipment'>;
    /** The team they are in, if any. */
    team: TeamEvent | null;
    /** Set for this device's own sheet. */
    edits?: SheetEdits | undefined;
    /** Under the battery: why it may be unknown. */
    batteryNote?: string | undefined;
    /** Their tasks still to do; none without a group. */
    tasks: readonly TaskRow[] | null;
    /** Where they are. */
    position: Snippet;
    /** Under each task, how far they are with it (tasks/TaskProgress.svelte). */
    taskNote?: Snippet<[TaskRow]>;
    /** Further parts (SheetPart), after the tasks. */
    more?: Snippet;
  }

  let { t, state, team, edits, batteryNote, tasks, taskNote, position, more }: Props = $props();

  /** At or under this, the battery is shown as running out. */
  const LOW_BATTERY = 20;

  const status = $derived(DUTY_STATUSES[state.status]);
  const batteryText = $derived(
    state.battery === null ? t('batteryUnknown') : t('batteryPercent', { percent: state.battery }),
  );
  const lora = $derived(state.equipment.includes('lora'));
  const carried = $derived(EQUIPMENT.filter((item) => state.equipment.includes(item.value)));
  const equipmentSummary = $derived(
    carried.length === 0 ? t('equipmentNone') : carried.map((item) => t(item.label)).join(', '),
  );
</script>

{#snippet battery()}
  <p class="line">
    {#if state.battery !== null}
      <StatusDot tone={state.battery <= LOW_BATTERY ? 'poor' : 'good'} />
    {/if}
    {batteryText}
  </p>
{/snippet}

<div class="sheet">
  {#if team}
    <p class="line">
      <span class="swatch" style:--swatch="var(--tone-{TEAM_COLOURS[team.colour].tone})"></span>
      {t('teamOf', { name: shownText(team.name) })}
    </p>
  {/if}
  {#if edits}
    {@const { onstatus } = edits}
    <div class="segments" role="radiogroup" aria-label={t('dutyLabel')}>
      {#each Object.entries(DUTY_STATUSES) as [value, item] (value)}
        <button
          role="radio"
          aria-checked={state.status === value}
          onclick={() => {
            onstatus(value as DutyStatus);
          }}
        >
          <StatusDot tone={item.tone} />
          {t(item.label)}
        </button>
      {/each}
    </div>
  {:else}
    <p class="line">
      <StatusDot tone={status.tone} />
      {t(status.label)}
    </p>
  {/if}
  {#if tasks}
    {#if tasks.length === 0}
      <!-- Nothing to do is a line, not a card. -->
      <p class="line hint"><Pictogram name="check" size={16} />{t('tasksNoneLine')}</p>
    {:else}
      <SheetPart title={t('sheetTasks')}>
        <ul class="tasks">
          {#each tasks as row (row.key)}
            <li>
              <button
                onclick={() => {
                  editTask(row.key);
                }}
              >
                <span>{shownText(row.fields.text)}</span>
                {#if row.fields.status === 'in-progress'}
                  <span class="hint">{t('taskInProgress')}</span>
                {/if}
              </button>
              {@render taskNote?.(row)}
            </li>
          {/each}
        </ul>
      </SheetPart>
    {/if}
  {/if}

  <SheetPart title={t('sheetPosition')}>
    {@render position()}
  </SheetPart>
  <SheetPart title={t('sheetEquipment')}>
    {#if edits}
      <CarriedEquipment
        {t}
        profile={state.profile}
        equipment={state.equipment}
        onequipment={edits.onequipment}
      />
    {:else}
      <p>{equipmentSummary}</p>
    {/if}
  </SheetPart>
  <!-- The device: looked at seldom, two small cards side by side. -->
  <div class="device">
    <SheetPart title={t('sheetBattery')}>
      <!-- Why it may be unknown: behind an (i), read once (ADR-0101). -->
      {#if batteryNote}
        <Explained label={t('aboutBattery')} text={batteryNote}>{@render battery()}</Explained>
      {:else}
        {@render battery()}
      {/if}
    </SheetPart>
    <SheetPart title={t('sheetRadio')}>
      {#if lora}
        <p class="line"><StatusDot tone="good" />{t('loraLinked')}</p>
      {:else}
        <p class="hint">{t('loraNotLinked')}</p>
        {#if edits}
          <button
            class="small connect"
            onclick={edits.onconnectradio}
            aria-label={t('radioConnect')}>{t('connect')}</button
          >
        {/if}
      {/if}
    </SheetPart>
  </div>
  {@render more?.()}
</div>

<style>
  /* One column as wide as the panel: a long line wraps, never widens it. */
  .sheet {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.65rem;
  }

  .line {
    display: flex;
    gap: 0.45rem;
    align-items: center;
    margin: 0;
  }

  /* Each the same: the device's two cards, side by side. */
  .device {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .connect {
    justify-self: start;
  }

  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    background: var(--swatch);
    border-radius: 50%;
  }

  .tasks {
    display: grid;
    gap: 0.45rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tasks button {
    display: flex;
    gap: 0.5rem;
    justify-content: space-between;
    width: 100%;
    text-align: left;
  }
</style>
