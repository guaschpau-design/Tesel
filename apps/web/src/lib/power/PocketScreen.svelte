<!-- Pocket mode (ADR-0097, ADR-0127): black, which costs a phone's OLED screen almost nothing,
     with the time and how the device is linked to its group; while guiding, the way to go in large.
     A touch does nothing but show how to leave: sliding the handle at the foot brings the app back
     where it was. The app keeps working meanwhile. -->
<script lang="ts">
  import { formatBearing, formatDistance, formatTime } from '../format.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { linkOf, linkWord, type LinkInput } from '../links/links.ts';
  import { navigation } from '../navigation/navigation.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { activity } from './activity.svelte.ts';
  import SlideOut from './SlideOut.svelte';

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

  /** How long the way out stands out after a touch that did nothing, in milliseconds. */
  const CALLED_MS = 2500;
  let called = $state(false);
  let seen = activity.nudges;
  $effect(() => {
    if (activity.nudges === seen) return;
    seen = activity.nudges;
    called = true;
    const timer = setTimeout(() => (called = false), CALLED_MS);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

<div class="rest" role="dialog" aria-modal="true" aria-label={t('pocketMode')}>
  <span class="title"><Pictogram name="lock" size={16} />{t('pocketMode')}</span>
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
  <div class="out">
    <SlideOut
      label={t('pocketSlide')}
      {called}
      onout={() => {
        activity.wake();
      }}
    />
  </div>
</div>

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
    color: #83878c;
    background: #000;
    /* Nothing in it scrolls, zooms or selects: a hand in a pocket finds nothing to do. */
    touch-action: none;
    user-select: none;
  }

  .title {
    position: absolute;
    top: max(1.5rem, env(safe-area-inset-top));
    display: flex;
    gap: 0.4rem;
    align-items: center;
    font-size: 0.9rem;
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
    color: #b9bcbf;
  }

  .way strong {
    font-size: 2.6rem;
  }

  .arrow {
    display: block;
  }

  .link {
    font-size: 0.95rem;
  }

  .out {
    position: absolute;
    right: 1rem;
    bottom: max(2rem, env(safe-area-inset-bottom));
    left: 1rem;
    display: flex;
    justify-content: center;
  }
</style>
