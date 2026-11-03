<!-- Who should do something: anyone, a team, this device, or another member of the group by alias.
     Its value is the team's or the member's ID, or empty for anyone. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { activeTeams } from '../teams/teams.ts';
  import { shownText } from '../text.ts';
  import { aliasOf } from './alias.ts';

  interface Props {
    t: Translate;
    groupState: GroupState;
    self: NodeId;
    value: string;
    onchange: (value: string) => void;
  }

  let { t, groupState, self, value, onchange }: Props = $props();

  const teams = $derived(activeTeams(groupState.teams));
  /** This device first, then everyone else the group knows, by alias. */
  const people = $derived(
    [...new Set<NodeId>([self, ...groupState.members.keys()])]
      .map((id) => ({ id, alias: aliasOf(groupState, id) }))
      .sort(
        (a, b) => Number(b.id === self) - Number(a.id === self) || a.alias.localeCompare(b.alias),
      ),
  );
</script>

<select
  {value}
  onchange={(event) => {
    onchange(event.currentTarget.value);
  }}
>
  <option value="">{t('anyoneOption')}</option>
  {#if teams.length > 0}
    <optgroup label={t('teamsTitle')}>
      {#each teams as team (team.team)}
        <option value={team.team}>{shownText(team.name)}</option>
      {/each}
    </optgroup>
  {/if}
  <optgroup label={t('peopleTitle')}>
    {#each people as person (person.id)}
      <option value={person.id}>
        {person.id === self ? `${person.alias} (${t('you')})` : person.alias}
      </option>
    {/each}
  </optgroup>
</select>

<style>
  select {
    display: block;
    width: 100%;
    margin-top: 0.25rem;
  }
</style>
