<!-- Shows a coordinator the invitation to a group: whether the person joins as member or
     coordinator, the QR code to scan, and its link to share, first where the phone can (a
     messaging app is how people pass it on), or to copy. -->
<script lang="ts">
  import type { NodeId, Role } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import CopyButton from '../ui/CopyButton.svelte';
  import QrCode from '../ui/QrCode.svelte';
  import { invitationFor, type StoredGroup } from './group.ts';
  import { invitationLink } from './join-link.ts';
  import { ROLE_LABELS } from './role-label.ts';

  interface Props {
    t: Translate;
    group: StoredGroup;
    issuer: NodeId;
    onclose: () => void;
  }

  let { t, group, issuer, onclose }: Props = $props();

  const ROLES: readonly Role[] = ['member', 'coordinator'];
  let role: Role = $state('member');
  const canShare = 'share' in navigator;

  const link = $derived(
    invitationLink(
      window.location.origin,
      import.meta.env.BASE_URL,
      invitationFor(group, role, issuer),
    ),
  );

  async function share(text: string): Promise<void> {
    try {
      await navigator.share({ title: t('inviteTitle', { group: group.name }), url: text });
    } catch {
      // The user closed the share sheet.
    }
  }
</script>

<div class="stack section">
  <h3>{t('inviteTitle', { group: group.name })}</h3>
  <div class="chips roles" role="radiogroup" aria-label={t('inviteRole')}>
    <span>{t('inviteRole')}</span>
    {#each ROLES as option (option)}
      <button
        class="chip"
        role="radio"
        aria-checked={role === option}
        onclick={() => (role = option)}
      >
        {t(ROLE_LABELS[option])}
      </button>
    {/each}
  </div>

  {#if link.ok}
    <QrCode text={link.value} label={t('invitationQr')} />
    <p class="hint">{t('inviteWarning')}</p>
    <input
      class="link"
      value={link.value}
      aria-label={t('invitationLink')}
      readonly
      onfocus={(event) => {
        event.currentTarget.select();
      }}
    />
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
  {:else}
    <!-- The only way building fails: the app was not opened from a secure address (protocol §6). -->
    <p class="warning">{t('invitationNeedsHttps')}</p>
    <div class="row"><button onclick={onclose}>{t('done')}</button></div>
  {/if}
</div>

<style>
  .roles {
    align-items: center;
  }

  .roles button {
    text-transform: capitalize;
  }

  .link {
    font-size: var(--text-small);
    color: var(--muted);
  }
</style>
