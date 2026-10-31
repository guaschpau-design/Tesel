<!-- Adds a task or changes one: only the text is needed, typed or, under it, picked from the
     common ones in a drop-down; who and the place are optional. The place is picked on the map: the form steps
     aside meanwhile and comes back as it was left. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import {
    eventRefKey,
    TASK_TEXT_MAX_BYTES,
    utf8ByteLength,
    type EventRef,
    type NodeId,
    type TaskStatus,
  } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import { formatCoordinate, type CoordinateFormat } from '../coordinates/coordinates.ts';
  import type { MessageKey, Translate } from '../i18n/index.ts';
  import AssigneeSelect from '../members/AssigneeSelect.svelte';
  import { objectName } from '../objects/object-names.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import type { TaskEditing } from './tasks.ts';
  import { TASK_PRESETS } from './task-presets.ts';
  import { fieldsOf, type TaskFields } from './tasks.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    editing: TaskEditing;
    format: Preference<CoordinateFormat>;
    /** Sends the task; `task` is null for a new one. Rejects if it could not be saved. */
    onsave: (task: EventRef | null, fields: TaskFields) => Promise<void>;
    /** Leaves the form to pick the task's place on the map, with what it holds so far. */
    onpickplace: (draft: TaskFields) => void;
    /** Back to the list. */
    /** Leaves the form: saved, or given up. */
    onclose: () => void;
  }

  let { t, groupState, self, editing, format, onsave, onpickplace, onclose }: Props = $props();

  const STATUSES: readonly { status: TaskStatus; label: MessageKey }[] = [
    { status: 'open', label: 'taskOpen' },
    { status: 'in-progress', label: 'taskInProgress' },
    { status: 'done', label: 'taskDone' },
  ];

  // The form starts from the task as it is when it opens; later changes by others do not move
  // what is being typed.
  const existing = untrack(() =>
    editing.kind === 'existing' ? groupState.tasks.get(editing.key) : undefined,
  );
  const initial: TaskFields = untrack(() => {
    if (existing) return fieldsOf(existing);
    return {
      status: 'open',
      assignee: null,
      place: editing.kind === 'new' ? editing.place : null,
      text: '',
    };
  });
  /** What the form holds: as it was left to pick a place, or the task as it starts. */
  const start: TaskFields = untrack(() => editing.draft ?? initial);

  let text = $state(start.text);
  let status = $state(start.status);
  /** The assignee's node ID, or '' for anyone. */
  let assignee: string = $state(start.assignee ?? '');
  let place = $state.raw(start.place);
  const submission = new Submission();

  /** The place in words: its coordinates, or the object it follows. */
  const placeText = $derived.by(() => {
    if (place === null) return null;
    if (place.kind === 'point') {
      return formatCoordinate(place.at, format.value) ?? formatCoordinate(place.at, 'decimal');
    }
    const object = groupState.objects.get(eventRefKey(place.object));
    if (object === undefined || object.type === 'object-delete') return t('taskPlaceGone');
    return objectName(object, groupState.objects, t);
  });
  const size = $derived(utf8ByteLength(text.trim()));
  const tooLong = $derived(size > TASK_TEXT_MAX_BYTES);

  async function save(fields: TaskFields): Promise<void> {
    if (await submission.run(() => onsave(existing?.task ?? null, fields))) onclose();
  }

  function fields(): TaskFields {
    return {
      status,
      assignee: assignee === '' ? null : (assignee as NodeId),
      place,
      text: text.trim(),
    };
  }

  async function cancelTask(): Promise<void> {
    const question = t('confirmCancelTask', { text: initial.text });
    if (!(await confirmations.ask({ text: question, confirm: t('taskCancel') }))) return;
    await save({ ...fields(), text: text.trim() || initial.text, status: 'cancelled' });
  }
</script>

<form
  class="stack section"
  onsubmit={(event) => {
    event.preventDefault();
    void save(fields());
  }}
>
  <h3>{existing ? t('editTask') : t('newTask')}</h3>
  <label>
    {t('taskText')}
    <!-- svelte-ignore a11y_autofocus -->
    <textarea bind:value={text} rows="2" required autofocus={!existing}></textarea>
  </label>
  {#if tooLong}<p class="warning">{t('taskTooLong')}</p>{/if}
  {#if !existing}
    <!-- One line, whatever the screen: the phone's own picker lists the common tasks. -->
    <label>
      {t('taskPresets')}
      <select
        value=""
        onchange={(event) => {
          const preset = event.currentTarget.value;
          if (preset !== '') text = preset;
          event.currentTarget.value = '';
        }}
      >
        <option value="">{t('taskPresetPick')}</option>
        {#each TASK_PRESETS as preset (preset)}
          <option value={t(preset)}>{t(preset)}</option>
        {/each}
      </select>
    </label>
  {/if}
  <label>
    {t('taskAssignee')}
    <AssigneeSelect
      {t}
      {groupState}
      {self}
      value={assignee}
      onchange={(value: string) => (assignee = value)}
    />
  </label>
  {#if existing}
    <fieldset>
      <legend>{t('taskStatus')}</legend>
      <div class="chips">
        {#each STATUSES as option (option.status)}
          <label class="chip">
            <input type="radio" name="status" value={option.status} bind:group={status} />
            {t(option.label)}
          </label>
        {/each}
      </div>
    </fieldset>
  {/if}
  <div class="place">
    <span>{t('taskPlace')}: <span class="where">{placeText ?? t('taskNoPlace')}</span></span>
    <span class="row">
      <button
        type="button"
        onclick={() => {
          onpickplace(fields());
        }}
      >
        <Pictogram name="pin" size={18} />
        {placeText ? t('taskChangePlace') : t('taskPickPlace')}
      </button>
      {#if placeText}
        <button type="button" class="ghost" onclick={() => (place = null)}
          >{t('taskRemovePlace')}</button
        >
      {/if}
    </span>
  </div>
  {#if submission.failed}<p class="warning">{t('taskNotSent')}</p>{/if}
  <div class="row">
    <button type="submit" class="primary" disabled={submission.busy || size === 0 || tooLong}
      >{t('save')}</button
    >
    <button type="button" onclick={onclose}>{t('cancel')}</button>
    {#if existing}
      <button type="button" class="danger-text" disabled={submission.busy} onclick={cancelTask}>
        {t('taskCancel')}
      </button>
    {/if}
  </div>
</form>

<style>
  textarea,
  select {
    display: block;
    width: 100%;
    margin-top: 0.25rem;
  }

  .place {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.75rem;
    align-items: center;
    font-size: var(--text-secondary);
  }

  .place button {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
  }

  .where {
    font-variant-numeric: tabular-nums;
  }
</style>
