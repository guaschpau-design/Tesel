<!-- The choices of this device, opened from the dock's "More" menu: alarm sound, notifications,
     keeping the screen on, full screen, dark mode, the language and how coordinates are written.
     Each is remembered. Under them, which version of the app this is (ADR-0126). -->
<script lang="ts">
  import { appVersion } from '../config.ts';
  import { COORDINATE_FORMATS, type CoordinateFormat } from '../coordinates/coordinates.ts';
  import {
    LOCALE_NAMES,
    nextLocale,
    type Locale,
    type MessageKey,
    type Translate,
  } from '../i18n/index.ts';
  import {
    BEARING_UNITS,
    NORTHS,
    type BearingUnit,
    type North,
  } from '../navigation/bearings.svelte.ts';
  import {
    enterFullscreen,
    exitFullscreen,
    fullscreenSupported,
    fullscreenView,
  } from '../ui/fullscreen.svelte.ts';
  import { appearance } from '../ui/appearance.svelte.ts';
  import ChoiceRow from '../ui/ChoiceRow.svelte';
  import { notices } from '../ui/notices.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import { screenWakeSupported } from '../ui/screen-awake.svelte.ts';
  import SwitchRow from '../ui/SwitchRow.svelte';
  import { allowNotifications, notificationsSupported } from '../ui/system-notifications.ts';
  import { HANDHELD } from '../platform.ts';
  import type { Preferences } from './preferences.ts';

  interface Props {
    t: Translate;
    preferences: Preferences;
    /** The language shown now. */
    locale: Locale;
    onclose: () => void;
  }

  let { t, preferences, locale, onclose }: Props = $props();

  const FORMAT_NAMES: Readonly<Record<CoordinateFormat, MessageKey>> = {
    decimal: 'formatDecimal',
    dms: 'formatDms',
    utm: 'formatUtm',
    mgrs: 'formatMgrs',
  };
  const UNIT_NAMES: Readonly<Record<BearingUnit, MessageKey>> = {
    degrees: 'bearingDegrees',
    mils: 'bearingMils',
  };
  const NORTH_NAMES: Readonly<Record<North, MessageKey>> = {
    true: 'northTrue',
    magnetic: 'northMagnetic',
  };

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
    {#if notificationsSupported()}
      <SwitchRow
        icon="chat"
        label={t('notifications')}
        on={preferences.notifications.value}
        onclick={() => void toggleNotifications()}
      />
    {/if}
    <!-- A computer has no pocket mode (ADR-0131). -->
    {#if HANDHELD}
      <SwitchRow
        icon="battery"
        label={t('energySaving')}
        hint={{ text: t('energySavingHint'), label: t('aboutThis', { name: t('energySaving') }) }}
        on={preferences.energySaving.value}
        onclick={() => void preferences.energySaving.set(!preferences.energySaving.value)}
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
    <!-- Shown as it is now, the phone's look until chosen here (ADR-0114). -->
    <SwitchRow
      icon="moon"
      label={t('darkMode')}
      hint={{ text: t('darkModeHint'), label: t('aboutThis', { name: t('darkMode') }) }}
      on={appearance.theme === 'dark'}
      onclick={() => void preferences.theme.set(appearance.theme === 'dark' ? 'light' : 'dark')}
    />
    <!-- The next language, round the list. -->
    <button class="language" onclick={() => void preferences.language.set(nextLocale(locale))}>
      <Pictogram name="language" size={20} />
      <span>{t('language')}</span>
      <span class="value">{LOCALE_NAMES[locale]}</span>
    </button>
    <ChoiceRow
      icon="grid"
      label={t('coordinateFormat')}
      preference={preferences.coordinateFormat}
      options={COORDINATE_FORMATS.map((value) => ({ value, label: t(FORMAT_NAMES[value]) }))}
    />
    <!-- Bearings as a compass reads them, for whoever navigates with one (ADR-0145). -->
    <ChoiceRow
      icon="compass"
      label={t('bearingUnit')}
      preference={preferences.bearingUnit}
      options={BEARING_UNITS.map((value) => ({ value, label: t(UNIT_NAMES[value]) }))}
    />
    <ChoiceRow
      icon="heading"
      label={t('bearingNorth')}
      preference={preferences.north}
      options={NORTHS.map((value) => ({ value, label: t(NORTH_NAMES[value]) }))}
    />
  </div>
  <!-- Which version this is, for whoever reports a problem or checks an update arrived. -->
  <p class="version">{t('appVersion', { version: appVersion() })}</p>
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

  .value {
    color: var(--muted);
    font-size: var(--text-secondary);
  }

  .version {
    margin: 0.75rem 0 0;
    color: var(--muted);
    font-size: var(--text-small);
    text-align: center;
  }
</style>
