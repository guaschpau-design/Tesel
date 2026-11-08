<!-- Shows a coordinator the invitation to a group: first the QR code to scan and the ways to pass its
     link on, sharing first where the phone can (a messaging app is how people pass it on), or
     copying it. Below, the seldom choice of inviting someone as coordinator, and the link itself,
     folded, for whoever wants to see it. -->
<script lang="ts">
  import type { NodeId, Role } from '@tesel/protocol';

  import { invitationAppUrl } from '../config.ts';
  import type { Translate } from '../i18n/index.ts';
  import CopyButton from '../ui/CopyButton.svelte';
  import Fold from '../ui/Fold.svelte';
  import QrCode from '../ui/QrCode.svelte';
  import SwitchRow from '../ui/SwitchRow.svelte';
  import { invitationFor, type StoredGroup } from './group.ts';
  import { invitationLink } from './join-link.ts';

  interface Props {
    t: Translate;
    group: StoredGroup;
    /** What the group is called, told apart from others of the same name. */
    name: string;
    issuer: NodeId;
    onclose: () => void;
  }

  let { t, group, name, issuer, onclose }: Props = $props();

  let role: Role = $state('member');
  const canShare = 'share' in navigator;

  const link = $derived(invitationLink(invitationAppUrl(), invitationFor(group, role, issuer)));

  async function share(text: string): Promise<void> {
    try {
      await navigator.share({ title: t('inviteTitle', { group: name }), url: text });
    } catch {
      // The user closed the share sheet.
    }
  }
</script>

<div class="stack section">
  <h3>{t('inviteTitle', { group: name })}</h3>

  {#if link.ok}
    <QrCode text={link.value} label={t('invitationQr')} />
    <p class="hint">{t('inviteWarning')}</p>
    <div class="row">
      {#if canShare}
        <button class="primary" onclick={() => share(link.value)}>{t('share')}</button>
      {/if}
      <CopyButton
        text={link.value}
        label={t('copyLink')}
        copiedLabel={t('copied')}
        failedLabel={t('copyFailed')}
      />
      <button onclick={onclose}>{t('done')}</button>
    </div>
    <SwitchRow
      icon="person"
      label={t('inviteAsCoordinator')}
      hint={{
        text: t('inviteAsCoordinatorHint'),
        label: t('aboutThis', { name: t('inviteAsCoordinator') }),
      }}
      on={role === 'coordinator'}
      onclick={() => (role = role === 'coordinator' ? 'member' : 'coordinator')}
    />
    <Fold title={t('invitationLink')} summary={t('invitationLinkSummary')}>
      <input
        class="link"
        value={link.value}
        aria-label={t('invitationLink')}
        readonly
        onfocus={(event) => {
          event.currentTarget.select();
        }}
      />
    </Fold>
  {:else}
    <!-- The only way building fails: the app was not opened from a secure address (protocol §6). -->
    <p class="warning">{t('invitationNeedsHttps')}</p>
    <div class="row"><button onclick={onclose}>{t('done')}</button></div>
  {/if}
</div>

<style>
  .link {
    font-size: var(--text-small);
    color: var(--muted);
  }
</style>
