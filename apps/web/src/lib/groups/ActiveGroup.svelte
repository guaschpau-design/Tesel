<!-- The group in use: its name and this device's role, who is in it, and inviting. Whoever
     coordinates organises it in a fold below, seldom needed: the teams and the safety check-in. -->
<script lang="ts">
  import type { NodeId, TeamEvent } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { CHECK_IN_MINUTES } from '../me/check-in.ts';
  import MemberList from '../members/MemberList.svelte';
  import type { GroupFeed, TeamFields } from '../sync/group-feed.svelte.ts';
  import { dissolveTeam, saveTeam } from '../teams/team-actions.ts';
  import TeamForm from '../teams/TeamForm.svelte';
  import Fold from '../ui/Fold.svelte';
  import { openPanel } from '../ui/panels.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { attempt } from '../ui/submission.svelte.ts';
  import SwitchRow from '../ui/SwitchRow.svelte';
  import { canInvite, type StoredGroup } from './group.ts';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    group: StoredGroup;
    /** The group's feed, for its members; undefined while it opens. */
    feed: GroupFeed | undefined;
    self: NodeId;
    oninvite: () => void;
  }

  let { t, group, feed, self, oninvite }: Props = $props();

  const coordinator = $derived(group.role === 'coordinator');
  /** The team being created (null) or changed, while its form is open. */
  let editing: { readonly team: TeamEvent | null } | null = $state(null);
</script>

<section class="group" aria-label={group.name}>
  <header>
    <strong>{group.name}</strong>
    <span class="badge role">{t(group.practice ? 'practice' : ROLE_LABELS[group.role])}</span>
  </header>
  {#if feed}
    <MemberList
      {t}
      groupState={feed.state}
      heard={feed.heard}
      {self}
      onmember={(id: NodeId) => {
        openPanel(id === self ? 'me' : { name: 'member', member: id });
      }}
      onteam={coordinator ? (team: TeamEvent) => (editing = { team }) : undefined}
    />
  {/if}
  {#if canInvite(group)}
    <button class="primary invite" onclick={oninvite}>
      <Pictogram name="qr" size={20} />
      {t('invite')}
    </button>
  {/if}
</section>

{#if feed && coordinator}
  {@const current = feed}
  {@const checkIn = (current.state.checkIn?.minutes ?? 0) > 0}
  <Fold
    title={t('organize')}
    summary={checkIn ? t('organizeSummaryCheckIn') : t('organizeSummary')}
  >
    <button class="new-team" onclick={() => (editing = { team: null })}>{t('teamNew')}</button>
    <SwitchRow
      icon="person"
      label={t('checkInSwitch')}
      hint={t('checkInHint', { minutes: CHECK_IN_MINUTES })}
      on={checkIn}
      onclick={() => {
        attempt(() => current.setCheckInTimer(checkIn ? 0 : CHECK_IN_MINUTES), t('actionFailed'));
      }}
    />
  </Fold>
  {#if editing}
    <TeamForm
      {t}
      groupState={current.state}
      team={editing.team}
      onsave={(team: TeamFields) => saveTeam(current, team)}
      ondissolve={(team: TeamEvent) => dissolveTeam(current, team)}
      onclose={() => (editing = null)}
    />
  {/if}
{/if}

<style>
  .group {
    display: grid;
    gap: 0.75rem;
    padding: 0.85rem;
    border: 2px solid var(--accent-line);
    border-radius: var(--radius-card);
  }

  header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    font-size: var(--text-title);
  }

  .role {
    text-transform: capitalize;
  }

  .invite {
    display: inline-flex;
    gap: 0.45rem;
    align-items: center;
    justify-self: start;
  }

  .new-team {
    justify-self: start;
  }
</style>
