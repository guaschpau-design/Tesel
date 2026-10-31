<!-- Confirms joining the group of an invitation the app was opened with or that was scanned. -->
<script lang="ts">
  import type { Invitation } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { ROLE_LABELS } from './role-label.ts';
  import { Submission } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    /** The invitation, or null if the link was damaged. */
    invitation: Invitation | null;
    onjoin: (invitation: Invitation) => Promise<void>;
    ondismiss: () => void;
  }

  let { t, invitation, onjoin, ondismiss }: Props = $props();

  const submission = new Submission();
</script>

<Dialog title={t('joinTitle')} oncancel={ondismiss}>
  <div class="stack">
    {#if invitation}
      <p>
        {t('joinQuestion', { group: invitation.groupName, role: t(ROLE_LABELS[invitation.role]) })}
      </p>
      <p class="hint">{t('joinWarning')}</p>
      <div class="row">
        <button
          class="primary"
          disabled={submission.busy}
          onclick={() => void submission.run(() => onjoin(invitation))}>{t('join')}</button
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
