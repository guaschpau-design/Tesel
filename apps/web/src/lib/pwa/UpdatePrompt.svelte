<!-- Offers a new version of the app, which waits for the user: reloading by surprise in the middle
     of an incident is worse than running a slightly older version. While an own SOS is open the
     offer waits; with a radio linked it warns that reloading drops the radio. Another window the
     update reaches reloads by itself only when neither holds it, and offers to otherwise. That
     the app works offline once installed goes unsaid: on a first launch it is noise. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';

  import type { Translate } from '../i18n/index.ts';
  import { useStandingNotice } from '../ui/notices.svelte.ts';

  interface Props {
    t: Translate;
    /** An own SOS is open: nothing may reload the app now. */
    hold: boolean;
    /** A radio is linked: reloading drops it until the user connects it again. */
    radioLinked: boolean;
  }

  let { t, hold, radioLinked }: Props = $props();

  let needRefresh = $state(false);
  /** The new version took over, from another window: this one reloads once nothing holds it. */
  let needReload = $state(false);
  /** The user asked for the new version here: this window reloads as soon as it takes over. */
  let requested = false;
  let updateServiceWorker: ((reload?: boolean) => Promise<void>) | undefined;

  onMount(() => {
    updateServiceWorker = registerSW({
      onNeedRefresh: () => (needRefresh = true),
      // The new version takes over every window at once, but a window with an own SOS open or a
      // radio linked must not reload by surprise.
      onNeedReload: () => {
        if (requested) reload();
        else needReload = true;
      },
    });
  });

  function reload(): void {
    window.location.reload();
  }

  function update(): void {
    requested = true;
    void updateServiceWorker?.(true);
  }

  $effect(() => {
    if (needReload && !hold && !radioLinked) reload();
  });

  useStandingNotice(() => {
    if (!(needRefresh || needReload) || hold) return null;
    return {
      text: radioLinked ? t('updateAvailableRadio') : t('updateAvailable'),
      action: {
        label: t('update'),
        run: needReload ? reload : update,
      },
    };
  });
</script>
