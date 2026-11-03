<!-- Offers a new version of the app, which waits for the user: reloading by surprise in the middle
     of an incident is worse than running a slightly older version. While an own SOS is open the
     offer waits; with a radio linked it warns that reloading drops the radio. Another window the
     update reaches reloads by itself only when neither holds it, and offers to otherwise. That
     the app works offline once installed goes unsaid: on a first launch it is noise. An app left
     open asks for new versions every hour and when shown again; once one waits, it loads ahead
     the parts it loads on first use, so a window kept on its version still has them (updates.ts). -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';

  import type { Translate } from '../i18n/index.ts';
  import { useStandingNotice } from '../ui/notices.svelte.ts';
  import { checkForUpdates, loadLazyParts } from './updates.ts';

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
    let stopChecking: (() => void) | undefined;
    updateServiceWorker = registerSW({
      onRegisteredSW: (_url, registration) => {
        if (registration) stopChecking = checkForUpdates(registration, document);
      },
      onNeedRefresh: () => {
        needRefresh = true;
        void loadLazyParts();
      },
      // The new version takes over every window at once, but a window with an own SOS open or a
      // radio linked must not reload by surprise.
      onNeedReload: () => {
        if (requested) reload();
        else needReload = true;
      },
    });
    return () => stopChecking?.();
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
