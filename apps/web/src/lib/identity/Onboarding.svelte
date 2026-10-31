<!-- First launch: the user picks an alias and the device creates its identity. Arriving through an
     invitation, the same step joins its group: the invitation was opened on purpose, and asking
     again would be one step too many. -->
<script lang="ts">
  import type { Invitation } from '@tesel/protocol';

  import { ROLE_LABELS } from '../groups/role-label.ts';
  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import AliasField from './AliasField.svelte';
  import { normalizeAlias } from './identity.ts';

  interface Props {
    t: Translate;
    /** The invitation the user arrived through, if any: creating the identity joins its group. */
    invitation: Invitation | null;
    oncreate: (alias: string) => Promise<void>;
  }

  let { t, invitation, oncreate }: Props = $props();

  let text = $state('');
  const submission = new Submission();
  const alias = $derived(normalizeAlias(text));

  function submit(): void {
    const chosen = alias;
    if (chosen !== null) void submission.run(() => oncreate(chosen));
  }
</script>

<Dialog title={t('welcomeTitle')}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      submit();
    }}
  >
    <p class="intro">{t('welcomeIntro')}</p>
    {#if invitation !== null}
      <p>
        {t('invitedTo', {
          group: invitation.groupName,
          role: t(ROLE_LABELS[invitation.role]),
        })}
      </p>
      <p class="hint">{t('joinWarning')}</p>
    {/if}
    <AliasField {t} {text} ontext={(typed: string) => (text = typed)} />
    {#if submission.failed}<p class="warning">{t('actionFailed')}</p>{/if}
    <button type="submit" class="primary" disabled={alias === null || submission.busy}>
      {invitation === null ? t('continue') : t('joinNamed', { group: invitation.groupName })}
    </button>
  </form>
</Dialog>
