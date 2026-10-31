<!-- The safety check-in (protocol §3.17), while the group has it on and this member is active: it
     watches quietly for taps and moves, asks "Are you OK?" after the group's time without either,
     and calls for help if the question goes unanswered. Time with the app off screen does not
     count: a browser cannot tell what the member did meanwhile. -->
<script lang="ts">
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { CheckIn, hasMoved, type CheckInStep, type Whereabouts } from './check-in.ts';

  interface Props {
    t: Translate;
    /** Minutes without a tap or a move before asking. */
    minutes: number;
    /** Calls for help, from where this device last was. */
    onsos: () => Promise<void>;
  }

  let { t, minutes, onsos }: Props = $props();

  /** How often the watch looks at the time, in milliseconds. */
  const TICK_MS = 5_000;

  const check = new CheckIn(Date.now());
  let step: CheckInStep = $state('quiet');
  let left = $state(0);

  /** The time left, as it is read at a glance: "2 minutes", then the last seconds. */
  const timeLeft = $derived(
    left > 60 ? t('inMinutes', { count: Math.ceil(left / 60) }) : t('inSeconds', { count: left }),
  );

  function activity(): void {
    check.activity(Date.now());
    step = check.step;
  }

  function tick(): void {
    const now = Date.now();
    const due = check.tick(now, minutes * 60_000);
    if (due === 'ask' && 'vibrate' in navigator) navigator.vibrate([300, 200, 300]);
    if (due === 'call') {
      onsos().catch((error: unknown) => {
        console.warn('The check-in could not call for help', error);
      });
    }
    step = check.step;
    left = Math.max(0, Math.ceil(((check.deadline ?? now) - now) / 1000));
  }

  onMount(() => {
    let anchor: Whereabouts | null = null;
    const release = deviceLocation.use((fix) => {
      if (anchor !== null && !hasMoved(anchor, fix)) return;
      anchor = fix;
      activity();
    });
    const visible = () => {
      if (document.visibilityState === 'visible') check.back(Date.now());
      else check.away();
      step = check.step;
    };
    window.addEventListener('pointerdown', activity);
    window.addEventListener('keydown', activity);
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      release();
      window.removeEventListener('pointerdown', activity);
      window.removeEventListener('keydown', activity);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(timer);
    };
  });
</script>

{#if step !== 'quiet'}
  <MapCard label={t('checkInTitle')} edge="var(--warning)">
    <p class="question">{t('checkInTitle')}</p>
    <p class="hint">
      {step === 'asking' ? t('checkInAsking', { when: timeLeft }) : t('checkInCalled')}
    </p>
    <div class="row">
      <button class="primary" onclick={activity}>{t('checkInFine')}</button>
    </div>
  </MapCard>
{/if}

<style>
  .question {
    font-weight: 600;
  }
</style>
