<!-- The choices of this device, opened from the dock's "More" menu: alarm sound, notifications,
     keeping the screen on, full screen, the language and how coordinates are written. Each is
     remembered. -->
<script lang="ts">
  import { siteUrl } from '../config.ts';
  import CoordinateFormatSelect from '../coordinates/CoordinateFormatSelect.svelte';
  import type { LocalIdentity } from '../identity/identity.ts';
  import { allowNotifications, notificationsSupported } from '../incidents/alarm.ts';
  import { LOCALE_NAMES, nextLocale, type Locale, type Translate } from '../i18n/index.ts';
  import {
    enterFullscreen,
    exitFullscreen,
    fullscreenSupported,
    fullscreenView,
  } from '../ui/fullscreen.svelte.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import { screenWakeSupported } from '../ui/screen-awake.svelte.ts';
  import SwitchRow from '../ui/SwitchRow.svelte';
  import type { Preferences } from './preferences.ts';

  interface Props {
    t: Translate;
    preferences: Preferences;
    /** The language shown now. */
    locale: Locale;
    /** This device, once it has an identity: named at the foot, for whoever has to tell it. */
    identity: LocalIdentity | undefined;
    onclose: () => void;
  }

  let { t, preferences, locale, identity, onclose }: Props = $props();

  /** Now and on every later visit, until switched off again. */
  function toggleFullscreen(): void {
    const on = !fullscreenView.active;
    if (on) enterFullscreen();
    else exitFullscreen();
    void preferences.fullscreen.set(on);
  }

  /** Turning notifications on asks the browser first; a refusal is explained. */
  async function toggleNotifications(): Promise<void> {
    const on = !preferences.notifications.value;
    if (on && !(await allowNotifications())) {
      notices.show(t('notificationsRefused'), { stays: true });
      return;
    }
    await preferences.notifications.set(on);
  }
</script>

<Panel title={t('settings')} closeLabel={t('close')} {onclose}>
  <div class="choices section">
    <SwitchRow
      icon="warning"
      label={t('alarmSound')}
      on={preferences.alarmSound.value}
      onclick={() => void preferences.alarmSound.set(!preferences.alarmSound.value)}
    />
    {#if notificationsSupported}
      <SwitchRow
        icon="chat"
        label={t('notifications')}
        on={preferences.notifications.value}
        onclick={() => void toggleNotifications()}
      />
    {/if}
    {#if screenWakeSupported}
      <SwitchRow
        icon="screen"
        label={t('keepScreenOn')}
        on={preferences.keepScreenOn.value}
        onclick={() => void preferences.keepScreenOn.set(!preferences.keepScreenOn.value)}
      />
    {/if}
    {#if fullscreenSupported}
      <SwitchRow
        icon="fullscreen"
        label={t('fullscreen')}
        on={fullscreenView.active}
        onclick={toggleFullscreen}
      />
    {/if}
    <!-- The next language, round the list. -->
    <button class="language" onclick={() => void preferences.language.set(nextLocale(locale))}>
      <Pictogram name="language" size={20} />
      <span>{t('language')}</span>
      <span class="value">{LOCALE_NAMES[locale]}</span>
    </button>
    <CoordinateFormatSelect {t} format={preferences.coordinateFormat} />
  </div>
  <p class="hint device">
    {#if identity}{identity.alias} · {t('deviceId', { node: identity.nodeId })} ·{/if}
    <a href={siteUrl(t('guidePath'))} target="_blank" rel="noopener">{t('guide')}</a>
  </p>
</Panel>

<style>
  .choices {
    display: grid;
    gap: 0.2rem;
  }

  /* Laid out like the switches above it, with the language shown now in place of a switch. */
  .language {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: 0.75rem;
    align-items: center;
    padding: 0.55rem 0.4rem;
    text-align: left;
    border-color: transparent;
  }

  .device {
    margin-top: 0.5rem;
    font-size: var(--text-small);
  }

  .value {
    color: var(--muted);
    font-size: var(--text-secondary);
  }
</style>
