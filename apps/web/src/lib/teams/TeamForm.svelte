<!-- Creates a team or changes one: its name, its colour and who is in it. A member ticked here leaves
     the team they were in. -->
<script lang="ts">
  import { teamOf, type GroupState } from '@tesel/core';
  import {
    TEAM_MAX_MEMBERS,
    TEAM_NAME_MAX_BYTES,
    utf8ByteLength,
    type NodeId,
    type TeamColour,
    type TeamEvent,
  } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import type { TeamFields } from '../sync/event-fields.ts';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { newTeamId, nextColour, TEAM_COLOURS } from './teams.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    /** The team changed, or null for a new one. */
    team: TeamEvent | null;
    onsave: (team: TeamFields) => Promise<void>;
    ondissolve: (team: TeamEvent) => Promise<void>;
    onclose: () => void;
  }

  let { t, groupState, team, onsave, ondissolve, onclose }: Props = $props();

  // The form starts from the team as it is when it opens.
  const initial = untrack(() => team);
  let name = $state(initial?.name ?? '');
  let colour: TeamColour = $state(initial?.colour ?? untrack(() => nextColour(groupState.teams)));
  let chosen: NodeId[] = $state([...(initial?.members ?? [])]);
  const submission = new Submission();

  const tooLong = $derived(utf8ByteLength(name.trim()) > TEAM_NAME_MAX_BYTES);
  /** No one more fits in the team (§3.15). */
  const full = $derived(chosen.length >= TEAM_MAX_MEMBERS);
  /** More than fit: a team written when events could be larger, before radio frames were sealed. */
  const overFull = $derived(chosen.length > TEAM_MAX_MEMBERS);
  /** Everyone the group knows, by alias, with the team each is in now. */
  const people = $derived(
    [...new Set<NodeId>([...groupState.members.keys(), ...groupState.positions.keys()])]
      .map((id) => ({ id, alias: aliasOf(groupState, id), team: teamOf(groupState.teams, id) }))
      .sort((a, b) => a.alias.localeCompare(b.alias)),
  );

  function toggle(id: NodeId): void {
    chosen = chosen.includes(id) ? chosen.filter((member) => member !== id) : [...chosen, id];
  }

  function save(): void {
    void submission.run(async () => {
      await onsave({
        team: initial?.team ?? newTeamId(groupState),
        colour,
        dissolved: false,
        members: chosen,
        name: name.trim(),
      });
      onclose();
    });
  }

  async function dissolve(existing: TeamEvent): Promise<void> {
    const text = t('confirmDissolveTeam', { name: existing.name });
    if (!(await confirmations.ask({ text, confirm: t('teamDissolve') }))) return;
    void submission.run(async () => {
      await ondissolve(existing);
      onclose();
    });
  }
</script>

<Dialog title={initial ? t('teamEdit') : t('teamNew')} oncancel={onclose}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      save();
    }}
  >
    <label>
      {t('teamName')}
      <input bind:value={name} required autocomplete="off" />
    </label>
    {#if tooLong}<p class="warning">{t('nameInvalid')}</p>{/if}
    <fieldset>
      <legend>{t('teamColour')}</legend>
      <div class="colours">
        {#each Object.entries(TEAM_COLOURS) as [value, look] (value)}
          <label class="colour" style:--swatch="var(--tone-{look.tone})">
            <input
              type="radio"
              name="colour"
              {value}
              aria-label={t(look.label)}
              bind:group={colour}
            />
          </label>
        {/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>{t('teamMembers')}</legend>
      <ul class="people">
        {#each people as person (person.id)}
          <li>
            <label>
              <input
                type="checkbox"
                checked={chosen.includes(person.id)}
                disabled={full && !chosen.includes(person.id)}
                onchange={() => {
                  toggle(person.id);
                }}
              />
              {person.alias}
              {#if person.team && person.team.team !== initial?.team}
                <span class="hint">· {person.team.name}</span>
              {/if}
            </label>
          </li>
        {/each}
      </ul>
      {#if full}<p class="hint">{t('teamFull', { count: TEAM_MAX_MEMBERS })}</p>{/if}
    </fieldset>
    {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
    <div class="row">
      <button
        type="submit"
        class="primary"
        disabled={submission.busy || name.trim() === '' || tooLong || overFull}>{t('save')}</button
      >
      <button type="button" onclick={onclose}>{t('cancel')}</button>
      {#if initial}
        {@const existing = initial}
        <button
          type="button"
          class="danger-text"
          disabled={submission.busy}
          onclick={() => void dissolve(existing)}>{t('teamDissolve')}</button
        >
      {/if}
    </div>
  </form>
</Dialog>

<style>
  .colours {
    display: flex;
    gap: 0.5rem;
  }

  .colour {
    position: relative;
    width: 2.2rem;
    height: 2.2rem;
    cursor: pointer;
    background: var(--swatch);
    border-radius: 50%;
  }

  .colour:has(input:checked) {
    box-shadow:
      0 0 0 3px var(--surface),
      0 0 0 5px var(--accent-line);
  }

  .colour:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 4px;
  }

  /* The radio button is the whole swatch, invisible: the ring shows the choice. */
  .colour input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }

  .people {
    display: grid;
    gap: 0.35rem;
    max-height: 14rem;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
  }

  .people label {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
