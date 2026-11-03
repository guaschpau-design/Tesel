<!-- The app's shell: the top bar, the map with the group's workspace and the device's panels on it,
     and the dialogs of the first launch, invitations, updates and a failed start. -->
<script lang="ts">
  import type { Invitation, ProtocolError, Result } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { onMount } from 'svelte';

  import { connection, watchConnection } from './lib/links/connection.svelte.ts';
  import type { JoinOutcome } from './lib/groups/group.ts';
  import JoinDialog from './lib/groups/JoinDialog.svelte';
  import { invitationInAddress, usableInvitation } from './lib/groups/join-link.ts';
  import { resolveLocale, translator, type Locale, type MessageKey } from './lib/i18n/index.ts';
  import Onboarding from './lib/identity/Onboarding.svelte';
  import { radioLinkOf } from './lib/links/links.ts';
  import { ground } from './lib/map/ground.svelte.ts';
  import { mapLibreLocale } from './lib/map/style/maplibre-locale.ts';
  import MapView from './lib/map/MapView.svelte';
  import { activity } from './lib/power/activity.svelte.ts';
  import RestScreen from './lib/power/RestScreen.svelte';
  import UpdatePrompt from './lib/pwa/UpdatePrompt.svelte';
  import { hasOwnSos } from './lib/incidents/incidents.ts';
  import { useSosElsewhere } from './lib/incidents/sos-elsewhere.svelte.ts';
  import Announcer from './lib/ui/Announcer.svelte';
  import ConfirmDialog from './lib/ui/ConfirmDialog.svelte';
  import StartupProblem from './lib/ui/StartupProblem.svelte';
  import { radio } from './lib/radio/radio.svelte.ts';
  import { terrain } from './lib/terrain/terrain.svelte.ts';
  import { Startup } from './lib/storage/startup.svelte.ts';
  import { useActiveGroupFeed } from './lib/sync/active-group-feed.svelte.ts';
  import { closePanel, openPanel } from './lib/ui/panels.svelte.ts';
  import { notices } from './lib/ui/notices.svelte.ts';
  import { useStorageFullNotice } from './lib/ui/submission.svelte.ts';
  import type { MapTheme } from './lib/ui/theme.ts';
  import DevicePanels from './lib/workspace/DevicePanels.svelte';
  import MapWorkspace from './lib/workspace/MapWorkspace.svelte';
  import TopBar from './lib/workspace/TopBar.svelte';

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let theme: MapTheme = $state(darkQuery.matches ? 'dark' : 'light');

  // Read an invitation link before anything else, then remove the secret from the address bar
  // and the history (ADR-0012). This runs before the map takes over the URL fragment.
  const fromAddress = invitationInAddress(window.location, import.meta.env.BASE_URL);
  if (fromAddress !== null) window.history.replaceState(null, '', import.meta.env.BASE_URL);
  let incoming: Result<Invitation, ProtocolError> | null = $state.raw(
    fromAddress && usableInvitation(fromAddress, window.location.hostname),
  );

  /** The databases and what waits for them, each as it opens. */
  const startup = new Startup();
  $effect(() => {
    terrain.reader = startup.preferences?.relief.value ? startup.elevations : null;
  });
  /** The language chosen in More, or the browser's until preferences are read. */
  const locale: Locale = $derived(
    resolveLocale(startup.preferences?.language.value ?? 'auto', navigator.languages),
  );
  const t = $derived(translator(locale));
  let map: MapLibreMap | undefined = $state();
  /** The map opened on its wide view, not on one the address gave: it may frame the group. */
  let mapOpenedWide = $state(false);

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
    const stopStarting = startup.start();

    return () => {
      stopWatching();
      stopStarting();
      darkQuery.removeEventListener('change', onScheme);
    };
  });

  function onMapReady(instance: MapLibreMap, openedWide: boolean): void {
    mapOpenedWide = openedWide;
    map = instance;
  }

  const active = useActiveGroupFeed(startup, () => t);
  const feed = $derived(active.feed);

  /** How this device reaches its group now (lib/links). */
  const linkInput = $derived({
    server: feed?.status ?? null,
    radio: radioLinkOf(radio),
    browserOnline: connection.online,
  });

  // The radio follows the active group: its channel, its events. Derived first, so that reloading
  // the list of groups does not configure the radio again.
  const radioFeed = $derived(feed ?? null);
  $effect(() => {
    void radio.useFeed(radioFeed);
  });

  // An SOS heard by radio for a group that is not open sounds too, and says which group it is.
  useSosElsewhere(() => ({
    t,
    session: startup.session,
    choices: startup.preferences && {
      sound: startup.preferences.alarmSound.value,
      notifications: startup.preferences.notifications.value,
    },
  }));

  /** An SOS of this device not cancelled yet: nothing may reload the app meanwhile. */
  const ownSosOpen = $derived(
    feed !== undefined && startup.session?.identity
      ? hasOwnSos(feed.state, startup.session.identity.nodeId)
      : false,
  );
  // Nor may a newer version in another window take the databases from it, or from a linked radio.
  $effect(() => {
    startup.hold(ownSosOpen || radio.linked);
  });

  const workspaceGroup = $derived(
    feed && startup.sharing && startup.session?.identity && startup.session.activeGroup
      ? {
          feed,
          sharing: startup.sharing,
          self: startup.session.identity.nodeId,
          role: startup.session.activeGroup.role,
        }
      : null,
  );

  /**
   * The first launch. Arriving through an invitation, it joins its group in the same step; without
   * one, it goes straight on to the ways into a group, rather than leave the user on an empty map.
   */
  async function createIdentity(alias: string): Promise<void> {
    await startup.session?.createIdentity(alias);
    if (incoming?.ok) await join(incoming.value, false);
    else openPanel({ name: 'groups', start: 'home' });
  }

  async function rename(alias: string): Promise<void> {
    await startup.session?.renameIdentity(alias);
    await feed?.rename(alias);
  }

  /**
   * Joins the group of an invitation. When `pause`, sharing the position is paused first, so that
   * none reaches the group joined before the user chooses to share it there (ADR-0110).
   */
  async function join(invitation: Invitation, pause: boolean): Promise<void> {
    const session = startup.session;
    if (!session) return;
    if (pause) await startup.sharing?.setMode('paused');
    const { group, outcome } = await session.join(invitation);
    incoming = null;
    const notice = pause ? 'joinedNotSharing' : JOIN_NOTICES[outcome];
    notices.show(t(notice, { group: session.nameOfGroup(group) }));
  }

  function received(invitation: Invitation): void {
    closePanel();
    incoming = usableInvitation({ ok: true, value: invitation }, window.location.hostname);
  }

  $effect(() => {
    document.documentElement.lang = locale;
  });
</script>

<div class="app">
  <TopBar {t} session={startup.session} {linkInput} />

  <main>
    {#if startup.offline && startup.preferences}
      <MapView
        choice={{
          base: startup.preferences.baseMap.value,
          relief: startup.preferences.relief.value,
          threeD: ground.raised,
          theme,
          lang: locale,
        }}
        locale={mapLibreLocale(t)}
        onready={onMapReady}
      />
    {/if}

    {#if map && startup.offline && startup.preferences}
      <MapWorkspace
        {t}
        {locale}
        {map}
        {mapOpenedWide}
        group={workspaceGroup}
        groupless={startup.session?.identity !== undefined &&
          startup.session.activeGroup === undefined}
        selfName={startup.session?.identity
          ? { alias: startup.session.identity.alias, rename }
          : null}
        preferences={startup.preferences}
        offline={startup.offline}
        weather={startup.weather}
      />
    {/if}

    <DevicePanels
      {t}
      {locale}
      {map}
      offline={startup.offline}
      preferences={startup.preferences}
      session={startup.session}
      {feed}
      {linkInput}
      oninvitation={received}
    />

    {#if startup.session && !startup.session.identity}
      <Onboarding {t} invitation={incoming?.ok ? incoming.value : null} oncreate={createIdentity} />
    {:else if startup.session && incoming}
      <JoinDialog
        {t}
        invitation={incoming.ok ? incoming.value : null}
        groups={startup.session.groups}
        sharing={startup.sharing?.mode === 'sharing'}
        onjoin={join}
        ondismiss={() => (incoming = null)}
      />
    {/if}

    <ConfirmDialog {t} />
    <Announcer />
    <UpdatePrompt
      {t}
      hold={feed !== undefined && startup.session?.identity !== undefined && ownSosOpen}
      radioLinked={radio.linked}
    />
    {#if startup.failure}
      <StartupProblem {t} failure={startup.failure} />
    {/if}
  </main>
  {#if startup.preferences?.energySaving.value && activity.rest !== 'awake'}
    <RestScreen {t} {locale} {linkInput} />
  {/if}
</div>

<style>
  .app {
    display: grid;
    /* minmax(0, …) lets the bar shrink to the screen; long group names are cut, not overflowed. */
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
    height: 100dvh;
  }

  /* A size container: menus and panels on the map measure themselves against it (cqh). */
  main {
    position: relative;
    overflow: hidden;
    container-type: size;
  }
</style>
