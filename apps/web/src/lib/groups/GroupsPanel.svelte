<!-- The groups: the one in use, the others, and two big buttons to create or join one. With a group
     in use, the others and the ways to a new one fold under
     it, and leaving it comes last, apart: both are seldom needed during an operation. Creating,
     joining, inviting and scanning each open in the panel and come back here; the welcome card on
     the map opens it straight on one of them (`start`). -->
<script lang="ts">
  import type { Invitation } from '@tesel/protocol';

  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import type { Session } from '../session.svelte.ts';
  import type { GroupsStart } from '../ui/panels.svelte.ts';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { confirmations } from '../ui/confirmations.svelte.ts';
  import Fold from '../ui/Fold.svelte';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import ActiveGroup from './ActiveGroup.svelte';
  import CreateGroupForm from './CreateGroupForm.svelte';
  import type { StoredGroup } from './group.ts';
  import InviteView from './InviteView.svelte';
  import JoinGroup from './JoinGroup.svelte';
  import QrScanner from './QrScanner.svelte';
  import { attempt } from '../ui/submission.svelte.ts';
  import { hideOnLeaving } from '../position/hide-on-leaving.ts';

  interface Props {
    t: Translate;
    session: Session;
    /** The active group's feed, for its members. */
    activeFeed: GroupFeed | undefined;
    /** An invitation was pasted or scanned; the caller asks the user to confirm it. */
    oninvitation: (invitation: Invitation) => void;
    /** A group was left: its channel goes from the radio. */
    onleft: (group: StoredGroup) => void;
    /** Where the panel opens: its list, or straight on creating or joining. */
    start: GroupsStart;
    onclose: () => void;
  }

  let { t, session, activeFeed, oninvitation, onleft, start, onclose }: Props = $props();

  type View = { kind: GroupsStart | 'scan' } | { kind: 'invite'; group: StoredGroup };
  let view: View = $state.raw(untrack(() => ({ kind: start })));

  const home = () => (view = { kind: 'home' });
  const others = $derived(session.groups.filter((group) => group.id !== session.activeGroupId));

  function scanned(invitation: Invitation): void {
    home();
    oninvitation(invitation);
  }

  async function leave(group: StoredGroup): Promise<void> {
    const text = t('confirmLeave', { group: group.name });
    if (!(await confirmations.ask({ text, confirm: t('leave') }))) return;
    attempt(async () => {
      if (activeFeed?.groupId === group.id) await hideOnLeaving(activeFeed);
      await session.leave(group.id);
      onleft(group);
    }, t('actionFailed'));
  }
</script>

{#snippet elsewhere()}
  {#if others.length > 0}
    <ul class="others" aria-label={t('otherGroups')}>
      {#each others as group (group.id)}
        <li>
          <span>{group.name}</span>
          <button onclick={() => session.activate(group.id)}>{t('use')}</button>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="actions">
    <button onclick={() => (view = { kind: 'create' })}>
      <Pictogram name="plus" size={26} />
      {t('createGroup')}
    </button>
    <button onclick={() => (view = { kind: 'join' })}>
      <Pictogram name="qr" size={26} />
      {t('joinGroup')}
    </button>
  </div>
{/snippet}

<Panel title={t('groups')} closeLabel={t('close')} {onclose}>
  {#if view.kind === 'create'}
    <CreateGroupForm {t} {session} onclose={home} />
  {:else if view.kind === 'join'}
    <JoinGroup {t} {oninvitation} onscan={() => (view = { kind: 'scan' })} oncancel={home} />
  {:else if view.kind === 'scan'}
    <QrScanner {t} onresult={scanned} oncancel={home} />
  {:else if view.kind === 'invite' && session.identity}
    <InviteView {t} group={view.group} issuer={session.identity.nodeId} onclose={home} />
  {:else}
    <div class="stack section">
      {#if session.activeGroup && session.identity}
        {@const group = session.activeGroup}
        <ActiveGroup
          {t}
          {group}
          feed={activeFeed}
          self={session.identity.nodeId}
          oninvite={() => (view = { kind: 'invite', group })}
        />
      {:else if session.groups.length === 0}
        <p class="hint">{t('noGroups')}</p>
      {/if}

      {#if session.activeGroup}
        <Fold
          title={t('otherGroups')}
          summary={others.length > 0
            ? others.map((group) => group.name).join(', ')
            : t('createOrJoin')}
        >
          {@render elsewhere()}
        </Fold>
      {:else}
        {@render elsewhere()}
      {/if}

      {#if session.activeGroup}
        {@const group = session.activeGroup}
        <button
          class="danger-text leave"
          onclick={() => {
            void leave(group);
          }}
        >
          {t('leaveGroup')}
        </button>
      {/if}
    </div>
  {/if}
</Panel>

<style>
  .others {
    display: grid;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .others li {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.4rem 0.4rem 0.85rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-card);
  }

  .actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .actions button {
    display: grid;
    gap: 0.35rem;
    place-items: center;
    padding: 0.9rem 0.5rem;
    font-weight: 600;
  }

  .leave {
    justify-self: end;
    margin-top: 0.5rem;
  }
</style>
