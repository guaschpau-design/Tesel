<!-- The screen at rest (ADR-0097): black, which costs a phone's OLED screen almost nothing, with
     the time, how the device is linked to its group and "Tap to come back"; while guiding, the way
     to go in large. Any touch brings the app back where it was; the app keeps working meanwhile. -->
<script lang="ts">
  import { formatBearing, formatDistance, formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { linkOf, linkWord, type LinkInput } from '../links/links.ts';
  import { navigation } from '../navigation/navigation.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { activity } from './activity.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** How this device reaches its group now (lib/links). */
    linkInput: LinkInput;
  }

  let { t, locale, linkInput }: Props = $props();

  /** The clock moves on a few times a minute: often enough to read, rarely enough to save. */
  const CLOCK_MS = 15_000;
  let now = $state(Date.now());
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), CLOCK_MS);
    return () => {
      clearInterval(timer);
    };
  });

  const link = $derived(linkOf(linkInput));
  const leg = $derived(navigation.leg);
</script>

<button
  class="rest"
  aria-label={t('restTapToWake')}
  onclick={() => {
    activity.wake();
  }}
>
  <span class="time">{formatTime(now, locale, now)}</span>
  {#if leg}
    <span class="way">
      <span class="arrow" style:rotate="{leg.bearing}deg"
        ><Pictogram name="heading" size={96} /></span
      >
      <strong>{formatDistance(leg.metres, locale)}</strong>
      <span>{formatBearing(leg.bearing, locale)}</span>
    </span>
  {/if}
  <span class="link">{t(linkWord(link))}</span>
  <span class="hint">{t('restTapToWake')}</span>
</button>

<style>
  /* Pure black lights no pixel of an OLED screen; the words are dim, enough to read at night. */
  .rest {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 2rem 1rem;
    color: #7d8c92;
    background: #000;
    border: 0;
    border-radius: 0;
    font: inherit;
    cursor: pointer;
  }

  .time {
    font-size: 3.5rem;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
  }

  .way {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    color: #b5c2c6;
  }

  .way strong {
    font-size: 2.6rem;
  }

  .arrow {
    display: block;
  }

  .link,
  .hint {
    font-size: 0.95rem;
  }

  .hint {
    position: absolute;
    bottom: max(2rem, env(safe-area-inset-bottom));
  }
</style>
