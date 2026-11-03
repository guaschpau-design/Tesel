<!-- Confirms joining the group of an invitation the app was opened with or that was scanned. It says
     which server the group uses, warns when the device is in another group of a name that looks
     the same, and, if the device shares its position, asks whether to share it in the new group:
     whoever sent the invitation may not be who the name says (ADR-0110). -->
<script lang="ts">
  import type { Invitation } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { shownText } from '../text.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { groupId, lookAlikeGroup, type StoredGroup } from './group.ts';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    /** The invitation, or null if the link was damaged. */
    invitation: Invitation | null;
    /** The groups this device belongs to. */
    groups: readonly StoredGroup[];
    /** Whether this device shares its position now. */
    sharing: boolean;
    /** Joins; `pause` says whether to pause sharing the position first, so none reaches it. */
    onjoin: (invitation: Invitation, pause: boolean) => Promise<void>;
    ondismiss: () => void;
  }

  let { t, invitation, groups, sharing, onjoin, ondismiss }: Props = $props();

  const submission = new Submission();
  /** Sharing the position in a group not joined yet is asked for, never taken for granted. */
  let share = $state(false);
</script>

<Dialog title={t('joinTitle')} oncancel={ondismiss}>
  <div class="stack">
    {#if invitation}
      {@const name = shownText(invitation.groupName)}
      {@const lookAlike = lookAlikeGroup(groups, invitation)}
      {@const isNew = !groups.some((group) => group.id === groupId(invitation.secret))}
      <p>{t('joinQuestion', { group: name, role: t(ROLE_LABELS[invitation.role]) })}</p>
      <p>
        {invitation.server === null
          ? t('joinNoServer')
          : t('joinServer', { server: new URL(invitation.server).host })}
      </p>
      {#if lookAlike}
        <p class="warning look-alike" role="alert">{t('joinSameName', { group: name })}</p>
      {/if}
      <p class="hint">{t('joinWarning')}</p>
      {#if sharing && isNew}
        <label class="check">
          <input type="checkbox" bind:checked={share} />
          {t('joinShare')}
        </label>
      {/if}
      <div class="row">
        <button
          class="primary"
          disabled={submission.busy}
          onclick={() => void submission.run(() => onjoin(invitation, sharing && isNew && !share))}
          >{t('join')}</button
        >
        <button onclick={ondismiss}>{t('notNow')}</button>
      </div>
    {:else}
      <p class="warning">{t('invitationDamaged')}</p>
      <div class="row">
        <button onclick={ondismiss}>{t('close')}</button>
      </div>
    {/if}
  </div>
</Dialog>

<style>
  .look-alike {
    padding: 0.5rem 0.6rem;
    font-weight: 600;
    border: 2px solid currentcolor;
    border-radius: var(--radius-card);
  }

  .check {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
</style>
