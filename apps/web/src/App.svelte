<script lang="ts">
  import type { Invitation, ProtocolError, Result } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount, untrack } from 'svelte';

  // The logo comes from brand/, built by brand/build.py; the header is always ink, hence pale.
  import lockupUrl from '../../../brand/lockup-pale.svg';
  import markUrl from '../../../brand/mark.svg';
  import { basemapUrl, defaultServerUrl } from './lib/config.ts';
  import { connection, watchConnection } from './lib/links/connection.svelte.ts';
  import type { JoinOutcome, StoredGroup } from './lib/groups/group.ts';
  import GroupsPanel from './lib/groups/GroupsPanel.svelte';
  import JoinDialog from './lib/groups/JoinDialog.svelte';
  import { invitationInAddress } from './lib/groups/join-link.ts';
  import { resolveLocale, translator, type Locale, type MessageKey } from './lib/i18n/index.ts';
  import Onboarding from './lib/identity/Onboarding.svelte';
  import ConnectionsPanel from './lib/links/ConnectionsPanel.svelte';
  import SettingsPanel from './lib/settings/SettingsPanel.svelte';
  import LinkButton from './lib/links/LinkButton.svelte';
  import { linkOf, networkStatus, radioLinkOf } from './lib/links/links.ts';
  import { mapLibreLocale } from './lib/map/style/maplibre-locale.ts';
  import MapView from './lib/map/MapView.svelte';
  import { registerContourProtocol } from './lib/map/style/contours.ts';
  import { findTile, registerTileProtocol, tileArchives } from './lib/map/tiles/protocol.ts';
  import { openTileStore } from './lib/map/tiles/store.ts';
  import type { OfflineMaps } from './lib/offline/offline-maps.ts';
  import OfflineAreasPanel from './lib/offline/OfflineAreasPanel.svelte';
  import { keepOverview } from './lib/offline/overview.ts';
  import { deviceLocation } from './lib/position/device-location.svelte.ts';
  import { PositionSharing } from './lib/position/position-sharing.svelte.ts';
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
  import { activeSos } from './lib/incidents/incidents.ts';
  import Announcer from './lib/ui/Announcer.svelte';
  import ConfirmDialog from './lib/ui/ConfirmDialog.svelte';
  import Pictogram from './lib/ui/Pictogram.svelte';
  import StartupProblem from './lib/ui/StartupProblem.svelte';
  import type { StartupFailure, VersionChange } from './lib/storage/version-change.ts';
  import { radio } from './lib/radio/radio.svelte.ts';
  import { loadPreferences, type Preferences } from './lib/settings/preferences.ts';
  import { Session } from './lib/session.svelte.ts';
  import { ElevationReader } from './lib/terrain/elevation.ts';
  import { terrain } from './lib/terrain/terrain.svelte.ts';
  import { openAppDb, type AppDb } from './lib/storage/app-db.ts';
  import { storageRefusals } from './lib/storage/storage-space.svelte.ts';
  import { GroupFeed } from './lib/sync/group-feed.svelte.ts';
  import { fullscreenAtFirstTap, fullscreenSupported } from './lib/ui/fullscreen.svelte.ts';
  import { closePanel, isOpen, openPanel, panels, togglePanel } from './lib/ui/panels.svelte.ts';
  import { notices } from './lib/ui/notices.svelte.ts';
  import { attempt, useStorageFullNotice } from './lib/ui/submission.svelte.ts';
  import type { MapTheme } from './lib/ui/theme.ts';
  import { WeatherFeed } from './lib/weather/weather-feed.svelte.ts';
  import MapWorkspace from './lib/workspace/MapWorkspace.svelte';

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let theme: MapTheme = $state(darkQuery.matches ? 'dark' : 'light');

  // Read an invitation link before anything else, then remove the secret from the address bar
  // and the history (ADR-0012). This runs before the map takes over the URL fragment.
  const fromAddress = invitationInAddress(window.location, import.meta.env.BASE_URL);
  if (fromAddress !== null) window.history.replaceState(null, '', import.meta.env.BASE_URL);
  let incoming: Result<Invitation, ProtocolError> | null = $state.raw(fromAddress);

  const archives = tileArchives(basemapUrl());
  let elevations: ElevationReader | null = $state.raw(null);
  $effect(() => {
    terrain.reader = preferences?.relief.value ? elevations : null;
  });
  /** Downloaded maps, once their database is open. */
  let offline: OfflineMaps | undefined = $state.raw();
  // What starting up opens is reactive, so that what waits for it runs whatever order it comes in.
  let db: AppDb | undefined = $state.raw();
  let session: Session | undefined = $state();
  let preferences: Preferences | undefined = $state.raw();
  /** Why the app cannot start, while it cannot. */
  let startupFailure: StartupFailure | null = $state(null);
  /** The language chosen in More, or the browser's until preferences are read. */
  const locale: Locale = $derived(
    resolveLocale(preferences?.language.value ?? 'auto', navigator.languages),
  );
  const t = $derived(translator(locale));
  let sharing: PositionSharing | undefined = $state.raw();
  let feed: GroupFeed | undefined = $state.raw();
  let map: MapLibreMap | undefined = $state();
  /** The map opened on its wide view, not on one the address gave: it may frame the group. */
  let mapOpenedWide = $state(false);
  /** Official weather warnings from the app's own server, once the database is open. */
  let weather: WeatherFeed | null = $state.raw(null);
  /** How this device reaches its group now (lib/links). */
  // A practice syncs with nothing: the indicator shows this device's own connection, as without a
  // group.
  const linkInput = $derived({
    server: session?.activeGroup?.practice !== undefined ? null : (feed?.status ?? null),
    radio: radioLinkOf(radio),
    browserOnline: connection.online,
  });
  const link = $derived(linkOf(linkInput));

  // Downloaded maps are what can be deleted to make room for the group's log (ADR-0056).
  useStorageFullNotice(() => ({
    text: t('storageFull'),
    action: {
      label: t('offlineAreas'),
      run: () => {
        openPanel('offline');
      },
    },
  }));

  const JOIN_NOTICES: Readonly<Record<JoinOutcome, MessageKey>> = {
    joined: 'joined',
    promoted: 'promoted',
    'already-member': 'alreadyMember',
  };

  onMount(() => {
    const stopWatching = watchConnection();
    const onScheme = (event: MediaQueryListEvent) => (theme = event.matches ? 'dark' : 'light');
    darkQuery.addEventListener('change', onScheme);

    const versionChange: VersionChange = {
      onBlocked: () => (startupFailure = 'blocked'),
      onReplaced: () => (startupFailure = 'replaced'),
    };
    const failed = (error: unknown) => {
      console.error('Tesel could not start', error);
      startupFailure = 'failed';
    };
    /** A database that waited for another window opened in the end: nothing blocks any more. */
    const opened = () => {
      if (startupFailure === 'blocked') startupFailure = null;
    };

    openTileStore(undefined, versionChange).then((store) => {
      opened();
      registerTileProtocol(store, archives);
      registerContourProtocol(store, archives);
      elevations = new ElevationReader((tile) => findTile('terrain', tile, store, archives));
      offline = { store, archives };
      void keepOverview(store, archives);
    }, failed);
    const server = defaultServerUrl();
    let stopWaitingForTap: (() => void) | undefined;
    openAppDb(undefined, versionChange)
      .then(async (database) => {
        opened();
        db = database;
        if (server !== null) weather = WeatherFeed.start(database, server);
        await radio.useStorage(database);
        preferences = await loadPreferences(database);
        if (fullscreenSupported && preferences.fullscreen.value) {
          stopWaitingForTap = fullscreenAtFirstTap();
        }
        sharing = new PositionSharing(preferences.positionMode, deviceLocation);
        session = await Session.load(database);
      })
      .catch(failed);

    return () => {
      stopWatching();
      stopWaitingForTap?.();
      weather?.stop();
      darkQuery.removeEventListener('change', onScheme);
    };
  });

  function onMapReady(instance: MapLibreMap, openedWide: boolean): void {
    mapOpenedWide = openedWide;
    map = instance;
  }

  /** Bumped to open the group again after opening it failed. */
  let openings = $state(0);

  // One feed for the active group. It is reopened only when what it depends on changes, not
  // whenever the list of groups is reloaded, or when the user tries again after it failed.
  const feedKey = $derived.by(() => {
    const group = session?.activeGroup;
    const identity = session?.identity;
    if (!group || !identity) return null;
    // Not the alias: a new name is told to the open group (rename), without opening it again.
    return [group.id, group.server ?? '', group.role, identity.nodeId, openings].join('|');
  });

  $effect(() => {
    if (feedKey === null) return;
    const group = untrack(() => session?.activeGroup);
    const identity = untrack(() => session?.identity);
    if (!db || !sharing || !group || !identity) return;
    const database = db;
    const positions = sharing;
    let opened: GroupFeed | undefined;
    let failure: number | undefined;
    let cancelled = false;
    GroupFeed.open(database, group, identity).then(
      (created) => {
        if (cancelled) {
          created.close();
          return;
        }
        opened = created;
        feed = created;
        positions.attach(created);
      },
      (error: unknown) => {
        console.warn('The group could not be opened', error);
        if (cancelled || storageRefusals.note(error)) return;
        failure = notices.show(t('groupOpenFailed'), {
          stays: true,
          action: { label: t('tryAgain'), run: () => openings++ },
        });
      },
    );
    return () => {
      cancelled = true;
      if (failure !== undefined) notices.withdraw(failure);
      positions.detach();
      opened?.close();
      feed = undefined;
    };
  });

  // The radio follows the active group: its channel, its events. A practice stays on this device.
  // Derived first, so that reloading the list of groups does not configure the radio again.
  const radioFeed = $derived(session?.activeGroup?.practice !== undefined ? null : (feed ?? null));
  $effect(() => {
    void radio.useFeed(radioFeed);
  });

  /** An SOS of this device not cancelled yet: nothing may reload the app meanwhile. */
  const ownSosOpen = $derived(
    feed !== undefined && session?.identity
      ? activeSos(feed.state, session.identity.nodeId).some((call) => call.mine)
      : false,
  );

  const workspaceGroup = $derived(
    feed && sharing && session?.identity && session.activeGroup
      ? {
          feed,
          sharing,
          self: session.identity.nodeId,
          role: session.activeGroup.role,
          practice: session.activeGroup.practice ?? null,
        }
      : null,
  );

  /** The first launch; arriving through an invitation, it joins its group in the same step. */
  async function createIdentity(alias: string): Promise<void> {
    await session?.createIdentity(alias);
    if (incoming?.ok) await join(incoming.value);
  }

  async function rename(alias: string): Promise<void> {
    await session?.renameIdentity(alias);
    await feed?.rename(alias);
  }

  async function join(invitation: Invitation): Promise<void> {
    if (!session) return;
    const outcome = await session.join(invitation);
    incoming = null;
    notices.show(t(JOIN_NOTICES[outcome], { group: invitation.groupName }));
  }

  function received(invitation: Invitation): void {
    closePanel();
    incoming = { ok: true, value: invitation };
  }

  $effect(() => {
    document.documentElement.lang = locale;
  });
</script>

<div class="app">
  <header class="bar chrome">
    <span class="brand">
      <img class="lockup" src={lockupUrl} alt="Tesel" />
      <img class="mark" src={markUrl} alt="Tesel" />
    </span>
    {#if session?.identity}
      {@const groupLabel = session.activeGroup?.name ?? t('noGroup')}
      <button
        class="group"
        onclick={() => {
          togglePanel({ name: 'groups', start: 'home' });
        }}
        aria-expanded={isOpen('groups')}
        aria-label="{t('group')}: {groupLabel}"
      >
        <span class="caption">{t('group')}</span>
        <span class="name">{groupLabel}</span>
        <Pictogram name="chevron" size={16} />
      </button>
    {/if}
    <LinkButton
      {t}
      {link}
      network={connection.network}
      detail={t(networkStatus(linkInput).label)}
      expanded={isOpen('connections')}
      onclick={() => {
        togglePanel('connections');
      }}
    />
  </header>

  <main>
    {#if offline && preferences}
      <MapView
        choice={{
          base: preferences.baseMap.value,
          relief: preferences.relief.value,
          theme,
          lang: locale,
        }}
        locale={mapLibreLocale(t)}
        onready={onMapReady}
      />
    {/if}

    {#if map && offline && preferences}
      <MapWorkspace
        {t}
        {locale}
        {map}
        {mapOpenedWide}
        group={workspaceGroup}
        groupless={session?.identity !== undefined && session.activeGroup === undefined}
        selfName={session?.identity ? { alias: session.identity.alias, rename } : null}
        {preferences}
        {offline}
        {weather}
        onendpractice={() => {
          const current = session;
          if (current) attempt(() => current.endPractice(), t('actionFailed'));
        }}
      />
    {/if}

    {#if map && offline && isOpen('offline')}
      <OfflineAreasPanel {t} {locale} {map} {offline} onclose={closePanel} />
    {/if}

    {#if preferences && isOpen('settings')}
      <SettingsPanel {t} {preferences} {locale} identity={session?.identity} onclose={closePanel} />
    {/if}

    {#if isOpen('connections')}
      <ConnectionsPanel
        {t}
        input={linkInput}
        network={connection.network}
        groupName={session?.activeGroup?.name ?? null}
        onclose={closePanel}
      />
    {/if}

    {#if session && panels.open?.name === 'groups'}
      {#key panels.open.start}
        <GroupsPanel
          {t}
          {session}
          activeFeed={feed}
          oninvitation={received}
          onleft={(group: StoredGroup) => {
            attempt(() => radio.forgetGroup(group.secret), t('actionFailed'));
          }}
          start={panels.open.start}
          onclose={closePanel}
        />
      {/key}
    {/if}

    {#if session && !session.identity}
      <Onboarding {t} invitation={incoming?.ok ? incoming.value : null} oncreate={createIdentity} />
    {:else if session && incoming}
      <JoinDialog
        {t}
        invitation={incoming.ok ? incoming.value : null}
        onjoin={join}
        ondismiss={() => (incoming = null)}
      />
    {/if}

    <ConfirmDialog {t} />
    <Announcer />
    <UpdatePrompt
      {t}
      hold={feed !== undefined && session?.identity !== undefined && ownSosOpen}
      radioLinked={radio.linked}
    />
    {#if startupFailure}
      <StartupProblem {t} failure={startupFailure} />
    {/if}
  </main>
</div>

<style>
  .app {
    display: grid;
    /* minmax(0, …) lets the bar shrink to the screen; long group names are cut, not overflowed. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    height: 100dvh;
  }

  /* The logo, the group in use, and on the right how this device reaches it. */
  .bar {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    /* Clear of a notch at the top, or at a side when the phone is held sideways. */
    padding: calc(0.3rem + env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) 0.3rem
      max(1rem, env(safe-area-inset-left));
  }

  /* A slim bar leaves the map the room: its two buttons are lower than the others, and alike. */
  .bar :global(button) {
    min-height: 2.5rem;
    border-color: var(--chrome-line);
  }

  .brand {
    display: flex;
    flex-shrink: 0;
  }

  .brand img {
    display: block;
    height: 1.45rem;
    width: auto;
  }

  .brand .mark {
    display: none;
  }

  /* A size container: menus and panels on the map measure themselves against it (cqh). */
  main {
    position: relative;
    overflow: hidden;
    container-type: size;
  }

  /* On narrow screens the mark stands for the name. */
  @media (max-width: 30rem) {
    .brand .lockup {
      display: none;
    }

    .brand .mark {
      display: block;
      height: 1.7rem;
    }
  }

  /* Says what it is above the group's name, which is cut short rather than crowd the bar. */
  .group {
    display: grid;
    grid-template-columns: minmax(0, auto) auto;
    column-gap: 0.4rem;
    align-items: center;
    min-width: 0;
    padding: 0.15rem 0.5rem 0.15rem 0.65rem;
    line-height: 1.15;
    text-align: left;
  }

  .group .caption {
    grid-column: 1;
    color: var(--chrome-muted);
    font-size: var(--text-small);
  }

  .group .name {
    grid-column: 1;
    overflow: hidden;
    font-size: var(--text-secondary);
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .group :global(svg) {
    grid-row: 1 / span 2;
    grid-column: 2;
  }
</style>
