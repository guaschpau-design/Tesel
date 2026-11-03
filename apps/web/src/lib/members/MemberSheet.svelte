<!-- What a member tells the team about themselves, the same for this device (in Me, where it is
     set) and for anyone tapped on the map: first what matters during an operation, their status,
     position and tasks; then their profile, battery, whether a LoRa radio is linked (which keeps
     them in touch without coverage) and equipment. On someone else's card all is in view, a line
     each; in Me, where these are choices and the equipment a long list, they fold under one line
     that sums them up. -->
<script lang="ts" module>
  import type { DutyStatus, Equipment, Profile } from '@tesel/protocol';

  /** How this device's own sheet changes what it tells. */
  export interface SheetEdits {
    onprofile: (profile: Profile) => void;
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
  import Fold from '../ui/Fold.svelte';
  import StatusDot from '../ui/StatusDot.svelte';
  import {
    DUTY_STATUSES,
    EQUIPMENT,
    EQUIPMENT_GROUPS,
    PROFILES,
    profileLabel,
  } from './member-catalog.ts';
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
    /** Further parts (SheetPart), after the tasks. */
    more?: Snippet;
  }

  let { t, state, team, edits, batteryNote, tasks, position, more }: Props = $props();

  /** At or under this, the battery is shown as running out. */
  const LOW_BATTERY = 20;

  const status = $derived(DUTY_STATUSES[state.status]);
  const batteryText = $derived(
    state.battery === null ? t('batteryUnknown') : t('batteryPercent', { percent: state.battery }),
  );
  const lora = $derived(state.equipment.includes('lora'));
  const carried = $derived(EQUIPMENT.filter((item) => state.equipment.includes(item.value)));
  /** Profile, battery and radio in one line, for the fold that holds them in Me. */
  const aboutSummary = $derived(
    [t(profileLabel(state.profile)), batteryText, ...(lora ? [t('loraSign')] : [])].join(' · '),
  );
  const equipmentSummary = $derived(
    carried.length === 0 ? t('equipmentNone') : carried.map((item) => t(item.label)).join(', '),
  );

  function toggle(item: Equipment): void {
    const next = state.equipment.includes(item)
      ? state.equipment.filter((value) => value !== item)
      : [...state.equipment, item];
    edits?.onequipment(next);
  }
</script>

{#snippet about()}
  <SheetPart title={t('profileLabel')} inline>
    {#if edits}
      {@const { onprofile } = edits}
      <select
        aria-label={t('profileLabel')}
        value={state.profile}
        onchange={(event) => {
          const chosen = PROFILES.find((item) => item.value === event.currentTarget.value);
          if (chosen) onprofile(chosen.value);
        }}
      >
        {#each PROFILES as item (item.value)}
          <option value={item.value}>{t(item.label)}</option>
        {/each}
      </select>
    {:else}
      <p>{t(profileLabel(state.profile))}</p>
    {/if}
  </SheetPart>
  <SheetPart title={t('sheetBattery')} inline>
    <p class="line">
      {#if state.battery !== null}
        <StatusDot tone={state.battery <= LOW_BATTERY ? 'poor' : 'good'} />
      {/if}
      {batteryText}
    </p>
    {#if batteryNote}<p class="hint">{batteryNote}</p>{/if}
  </SheetPart>
  <SheetPart title={t('sheetRadio')} inline>
    <p class="line">
      {#if lora}
        <StatusDot tone="good" />
        {t('loraLinked')}
      {:else}
        <span class="hint">{t('loraNotLinked')}</span>
        {#if edits}
          <button class="small" onclick={edits.onconnectradio} aria-label={t('radioConnect')}
            >{t('connect')}</button
          >
        {/if}
      {/if}
    </p>
  </SheetPart>
  <SheetPart title={t('sheetEquipment')}>
    {#if edits}
      {#each EQUIPMENT_GROUPS as group (group.label)}
        <fieldset>
          <legend>{t(group.label)}</legend>
          <div class="chips">
            {#each group.items as item (item.value)}
              <button
                class="chip"
                aria-pressed={state.equipment.includes(item.value)}
                onclick={() => {
                  toggle(item.value);
                }}>{t(item.label)}</button
              >
            {/each}
          </div>
        </fieldset>
      {/each}
    {:else}
      <p>{equipmentSummary}</p>
    {/if}
  </SheetPart>
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

  <SheetPart title={t('sheetPosition')}>
    {@render position()}
  </SheetPart>
  {#if tasks}
    <SheetPart title={t('sheetTasks')} inline={tasks.length === 0}>
      {#if tasks.length === 0}
        <p class="hint">{t('tasksNone')}</p>
      {:else}
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
            </li>
          {/each}
        </ul>
      {/if}
    </SheetPart>
  {/if}
  {#if edits}
    <Fold title={t('sheetAbout')} summary={aboutSummary}>{@render about()}</Fold>
  {:else}
    {@render about()}
  {/if}
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

  .line .small {
    margin-left: auto;
  }

  /* The groups of equipment are named small, under the part's own title. */
  legend {
    color: var(--muted);
    font-size: var(--text-small);
  }

  .swatch {
    width: 0.8rem;
    height: 0.8rem;
    background: var(--swatch);
    border-radius: 50%;
  }

  .tasks {
    display: grid;
    gap: 0.3rem;
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
