<!-- On an SOS card (ADR-0127): for one's own call, calling 112, which sends the phone's position
     with the call, and sending one's location to whoever has no Tesel from the phone's share menu
     (WhatsApp, SMS…); for someone else's, sending theirs. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';
  import { sendOutside } from './tell-outside.ts';

  interface Props {
    t: Translate;
    /** The text to send, as outsideText writes it. */
    text: string;
    /** This device's own call. */
    mine: boolean;
  }

  let { t, text, mine }: Props = $props();

  function send(): void {
    attempt(async () => {
      if ((await sendOutside(text)) === 'copied') notices.show(t('locationCopied'));
    }, t('copyFailed'));
  }
</script>

<div class="row">
  {#if mine}
    <a class="call" href="tel:112">{t('call112')}</a>
  {/if}
  <button onclick={send}>{mine ? t('sendMyLocation') : t('sendTheirLocation')}</button>
</div>

<style>
  /* A link, as it opens the phone's dialer, that looks and is as large as a button. */
  .call {
    display: inline-flex;
    align-items: center;
    min-height: var(--control-size);
    padding: 0.5rem 0.8rem;
    font-weight: 700;
    color: var(--on-danger);
    text-decoration: none;
    background: var(--danger-fill);
    border-radius: var(--radius-control);
  }
</style>
