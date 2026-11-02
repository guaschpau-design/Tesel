<!-- The safety check-in (protocol §3.17), while the group has it on and this member is active: it
     watches quietly for taps and moves, asks "Are you OK?" after the group's time without either,
     and calls for help if the question goes unanswered. Time with the app off screen does not
     count: a browser cannot tell what the member did meanwhile. A call that could not be sent shows
     as such, draws attention and is tried again until it goes out; only then does the card say so. -->
<script lang="ts">
  import { onMount } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { callAttention } from '../power/attention.ts';
  import { deviceLocation } from '../position/device-location.svelte.ts';
  import type { Placed } from '../position/movement.ts';
  import MapCard from '../ui/MapCard.svelte';
  import { CheckIn, hasMoved, type CheckInStep } from './check-in.ts';

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

  /** Shows where the check-in stands at `now`. */
  function show(now: number): void {
    step = check.step;
    left = Math.max(0, Math.ceil(((check.deadline ?? now) - now) / 1000));
  }

  /** Something the member, or anyone near them, must notice now. */
  function drawAttention(): void {
    if ('vibrate' in navigator) navigator.vibrate([300, 200, 300]);
    callAttention();
  }

  function activity(): void {
    check.activity(Date.now());
    show(Date.now());
  }

  function call(): void {
    onsos().then(
      () => {
        check.sent();
        show(Date.now());
      },
      (error: unknown) => {
        console.warn('The check-in could not call for help', error);
        check.failed(Date.now());
        show(Date.now());
        if (check.step === 'failed') drawAttention();
      },
    );
  }

  function tick(): void {
    const now = Date.now();
    const due = check.tick(now, minutes * 60_000);
    if (due === 'ask') drawAttention();
    if (due === 'call') call();
    show(now);
  }

  onMount(() => {
    let anchor: Placed | null = null;
    const release = deviceLocation.use((fix) => {
      if (anchor !== null && !hasMoved(anchor, fix)) return;
      anchor = fix;
      activity();
    });
    const visible = () => {
      if (document.visibilityState === 'visible') check.back(Date.now());
      else check.away();
      show(Date.now());
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
    {#if step === 'failed'}
      <p class="warning">{t('checkInFailed', { when: timeLeft })}</p>
    {:else}
      <p class="hint">
        {#if step === 'asking'}
          {t('checkInAsking', { when: timeLeft })}
        {:else if step === 'calling'}
          {t('checkInCalling')}
        {:else}
          {t('checkInCalled')}
        {/if}
      </p>
    {/if}
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
