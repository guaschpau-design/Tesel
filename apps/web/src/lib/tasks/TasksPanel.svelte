<!-- The team's tasks: what is pending, by whom it is for (this device first), with one button to
     move along each task this device may (its own and those for anyone), and what is done. A task
     along a route starts by following it. Tapping a task opens it to change who, where or what. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { eventRefKey, type EventRef, type NodeId, type Place } from '@tesel/protocol';

  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import { objectDestination } from '../navigation/target.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import ActionButton from '../ui/ActionButton.svelte';
  import Fold from '../ui/Fold.svelte';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import { attempt } from '../ui/submission.svelte.ts';
  import { editTask, newTask, stopEditingTask } from './task-editor.ts';
  import TaskForm from './TaskForm.svelte';
  import {
    advance,
    byDoer,
    canMove,
    doerOf,
    placePoint,
    taskList,
    type TaskDoer,
    type TaskEditing,
    type TaskFields,
    type TaskRow,
  } from './tasks.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    format: Preference<CoordinateFormat>;
    /** The task being edited, or null for the list. */
    editing: TaskEditing | null;
    onsave: (task: EventRef | null, fields: TaskFields) => Promise<void>;
    /** Leaves the panel to pick on the map the place of the task being edited. */
    onpickplace: (editing: TaskEditing) => void;
    /** Shows a task's place on the map, with its panel. */
    onplace: (place: Place) => void;
    /** Follows the route a task of this device is along, starting the task if it was not. */
    onfollow: (row: TaskRow) => void;
    onclose: () => void;
  }

  let {
    t,
    groupState,
    self,
    format,
    editing,
    onsave,
    onpickplace,
    onplace,
    onfollow,
    onclose,
  }: Props = $props();

  const list = $derived(taskList(groupState, self));

  /** Whether a task's place is a line of the map to follow: a route, or a strip of a sweep. */
  function isRoute(place: Place): boolean {
    if (place.kind !== 'object') return false;
    const object = groupState.objects.get(eventRefKey(place.object));
    return objectDestination(object, groupState.objects)?.kind === 'route';
  }

  function isStrip(place: Place | null): boolean {
    if (place?.kind !== 'object') return false;
    return groupState.objects.get(eventRefKey(place.object))?.type === 'sweep';
  }

  function doerName(doer: TaskDoer): string {
    if (doer.kind === 'you') return t('taskForYou');
    return t('taskFor', { name: doer.kind === 'named' ? doer.name : t('anyone') });
  }

  const NEXT: Readonly<Record<TaskFields['status'], MessageKey>> = {
    open: 'taskStart',
    'in-progress': 'taskFinish',
    done: 'taskReopen',
    cancelled: 'taskReopen',
  };
</script>

<!-- A task: its text, and in the list of done ones whom it was for; its place, and its button. -->
{#snippet item(row: TaskRow, showDoer: boolean)}
  {@const place = row.fields.place}
  {@const route = place !== null && isRoute(place)}
  {@const moves = canMove(row)}
  <li class:mine={row.mine} class:done={row.fields.status === 'done'}>
    <button
      class="open"
      onclick={() => {
        editTask(row.key);
      }}
    >
      <span class="text">{row.fields.text}</span>
      {#if showDoer || row.fields.status === 'in-progress'}
        <span class="meta">
          {#if showDoer}{doerName(doerOf(row))}{/if}
          {#if row.fields.status === 'in-progress'}<strong>{t('taskInProgress')}</strong>{/if}
        </span>
      {/if}
    </button>
    <span class="actions">
      {#if place && placePoint(place, groupState.objects)}
        <button
          class="icon"
          aria-label={t('taskShowPlace')}
          title={t('taskShowPlace')}
          onclick={() => {
            onplace(place);
          }}
        >
          <Pictogram name={route ? 'route' : 'pin'} size={18} />
        </button>
      {/if}
      {#if moves && route && row.fields.status === 'open'}
        <!-- Along a route or a strip, starting is following it. -->
        <button
          class="next"
          onclick={() => {
            onfollow(row);
          }}
        >
          {t(isStrip(place) ? 'followStrip' : 'followRoute')}
        </button>
      {:else if moves}
        <button
          class="next"
          onclick={() => {
            attempt(() => onsave(row.task, advance(row.fields, self)), t('actionFailed'));
          }}
        >
          {t(NEXT[row.fields.status])}
        </button>
      {/if}
    </span>
  </li>
{/snippet}

<Panel title={t('tasks')} closeLabel={t('close')} {onclose}>
  {#if editing}
    {#key editing}
      {@const edited = editing}
      <TaskForm
        {t}
        {groupState}
        {self}
        {editing}
        {format}
        {onsave}
        onpickplace={(draft: TaskFields) => {
          onpickplace({ ...edited, draft });
        }}
        onclose={stopEditingTask}
      />
    {/key}
  {:else}
    <div class="stack section">
      {#if list.pending.length === 0}
        <p class="hint">{t('tasksEmpty')}</p>
      {/if}
      {#each byDoer(list.pending) as part (doerName(part.doer))}
        <section class="part">
          <h3>{doerName(part.doer)}</h3>
          <ul class="cards">
            {#each part.rows as row (row.key)}{@render item(row, false)}{/each}
          </ul>
        </section>
      {/each}
      {#if list.done.length > 0}
        <Fold title={t('tasksDone', { count: list.done.length })} summary="">
          <ul class="cards">
            {#each list.done as row (row.key)}{@render item(row, true)}{/each}
          </ul>
        </Fold>
      {/if}
      <div class="row">
        <ActionButton
          icon="plus"
          label={t('newTask')}
          onclick={() => {
            newTask(null);
          }}
        />
      </div>
    </div>
  {/if}
</Panel>

<style>
  .part {
    display: grid;
    gap: 0.35rem;
  }

  /* Whom a part of the list is for, as small as the titles of a member's sheet. */
  .part h3 {
    color: var(--muted);
    font-size: var(--text-secondary);
    font-weight: 600;
  }

  .cards > li {
    grid-template-columns: 1fr auto;
    align-items: center;
    padding: 0.4rem 0.4rem 0.4rem 0.75rem;
  }

  .cards > li.mine {
    border-color: var(--accent-line);
    box-shadow: inset 3px 0 0 var(--accent-line);
  }

  .open {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
    padding: 0.2rem 0;
    text-align: left;
    color: inherit;
    background: none;
    border: none;
  }

  .text {
    overflow-wrap: anywhere;
  }

  .done .text {
    color: var(--muted);
    text-decoration: line-through;
  }

  .meta {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
    font-size: var(--text-small);
    color: var(--muted);
  }

  .actions {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  .next {
    white-space: nowrap;
  }
</style>
