<!-- Telling someone who has no Tesel where a member is (tell-outside.ts, ADR-0122): one button that
     opens the ways to send the text, by SMS, which needs no data, by WhatsApp, through the phone's
     share sheet, or copied. Nothing is sent until the member sends it from the app it opens. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import CopyButton from '../ui/CopyButton.svelte';
  import { smsLink, whatsAppLink } from './tell-outside.ts';

  interface Props {
    t: Translate;
    /** The text to send, as outsideText writes it. */
    text: string;
  }

  let { t, text }: Props = $props();

  let open = $state(false);
  const canShare = 'share' in navigator;

  async function share(): Promise<void> {
    try {
      await navigator.share({ text });
    } catch {
      // The user closed the share sheet.
    }
  }
</script>

<div class="tell">
  <button aria-expanded={open} onclick={() => (open = !open)}>{t('tellOutside')}</button>
  {#if open}
    <p class="hint">{t('tellOutsideHint')}</p>
    <div class="row">
      <button
        class="primary"
        onclick={() => {
          window.location.href = smsLink(text);
        }}>{t('sendSms')}</button
      >
      <button
        onclick={() => {
          window.open(whatsAppLink(text), '_blank', 'noopener');
        }}>WhatsApp</button
      >
      {#if canShare}
        <button onclick={share}>{t('share')}</button>
      {/if}
      <CopyButton
        {text}
        label={t('copy')}
        copiedLabel={t('copied')}
        failedLabel={t('copyFailed')}
      />
    </div>
  {/if}
</div>

<style>
  .tell {
    display: grid;
    gap: 0.4rem;
  }

  .tell > button {
    justify-self: start;
  }

  .hint {
    margin: 0;
    font-size: var(--text-secondary);
  }
</style>
