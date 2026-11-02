<!-- The row that writes in the group's chat: the text box with its microphone, where the browser
     can dictate, and Send; under it, why the last message did not go. What is written lives in
     the panel's ChatDraft (chat-draft.svelte.ts), which outlasts this row. -->
<script lang="ts">
  import { CHAT_MAX_BYTES } from '@tesel/protocol';

  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import type { ChatDraft } from './chat-draft.svelte.ts';
  import type { DictationProblem } from './dictation.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    draft: ChatDraft;
    onsend: (text: string) => Promise<void>;
  }

  let { t, locale, draft, onsend }: Props = $props();

  const DICTATION_PROBLEMS: Readonly<Record<DictationProblem, MessageKey>> = {
    permission: 'dictationPermission',
    network: 'dictationNetwork',
    silence: 'dictationSilence',
    unavailable: 'dictationUnavailable',
  };
</script>

<form
  class="compose"
  onsubmit={(event) => {
    event.preventDefault();
    void draft.send(onsend);
  }}
>
  <div class="field">
    <input
      bind:value={draft.text}
      aria-label={t('message')}
      placeholder={draft.dictation?.listening ? t('dictationListening') : t('message')}
      autocomplete="off"
    />
    {#if draft.dictation}
      <button
        type="button"
        class="dictate"
        aria-pressed={draft.dictation.listening}
        aria-label={draft.dictation.listening ? t('dictationStop') : t('dictate')}
        title={draft.dictation.listening ? t('dictationStop') : t('dictate')}
        onclick={() => {
          draft.toggleDictation(locale);
        }}
      >
        <Pictogram name="mic" size={20} />
      </button>
    {/if}
  </div>
  <button
    type="submit"
    class="primary icon"
    aria-label={t('send')}
    title={t('send')}
    disabled={draft.submission.busy || !draft.fits}
  >
    <Pictogram name="send" size={22} />
  </button>
</form>
{#if draft.submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
{#if draft.size > CHAT_MAX_BYTES}<p class="warning">{t('messageTooLong')}</p>{/if}
{#if draft.dictation?.problem}
  <p class="warning">{t(DICTATION_PROBLEMS[draft.dictation.problem])}</p>
{/if}

<style>
  /* One row: the text with its microphone, and Send. */
  .compose {
    display: grid;
    flex: none;
    grid-template-columns: 1fr auto;
    gap: 0.4rem;
    align-items: center;
  }

  /* Under the row, in the panel's column; a plain `.warning` is the app's error text (app.css). */
  .warning {
    flex: none;
    margin: 0;
  }

  /* The microphone inside the text box, at its end, where the thumb is. */
  .field {
    position: relative;
    display: grid;
    min-width: 0;
  }

  .field input {
    min-width: 0;
    padding-right: calc(var(--control-size) + 0.25rem);
  }

  .dictate {
    position: absolute;
    top: 50%;
    right: 0.15rem;
    display: grid;
    place-items: center;
    width: var(--control-size);
    height: var(--control-size);
    padding: 0;
    color: var(--muted);
    border: 0;
    border-radius: 50%;
    transform: translateY(-50%);
  }

  /* Listening: in the colour of what is live, pulsing gently. */
  .dictate[aria-pressed='true'] {
    color: var(--on-danger);
    background: var(--danger-fill);
    animation: listening 1.4s ease-in-out infinite;
  }

  @keyframes listening {
    50% {
      box-shadow: 0 0 0 0.35rem color-mix(in srgb, var(--danger-fill) 30%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .dictate[aria-pressed='true'] {
      animation: none;
    }
  }
</style>
