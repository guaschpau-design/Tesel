<!-- The panels about this device, with or without a group: its offline maps, its settings, how it
     reaches its group, and its groups. -->
<script lang="ts">
  import type { Invitation } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';

  import type { StoredGroup } from '../groups/group.ts';
  import GroupsPanel from '../groups/GroupsPanel.svelte';
  import type { Locale, Translate } from '../i18n/index.ts';
  import { connection } from '../links/connection.svelte.ts';
  import ConnectionsPanel from '../links/ConnectionsPanel.svelte';
  import type { LinkInput } from '../links/links.ts';
  import type { OfflineMaps } from '../offline/offline-maps.ts';
  import OfflineAreasPanel from '../offline/OfflineAreasPanel.svelte';
  import { radio } from '../radio/radio.svelte.ts';
  import type { Session } from '../session.svelte.ts';
  import type { Preferences } from '../settings/preferences.ts';
  import SettingsPanel from '../settings/SettingsPanel.svelte';
  import type { GroupFeed } from '../sync/group-feed.svelte.ts';
  import { closePanel, isOpen, panels } from '../ui/panels.svelte.ts';
  import { attempt } from '../ui/submission.svelte.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** Each of these is missing until the app has opened it. */
    map: MapLibreMap | undefined;
    offline: OfflineMaps | undefined;
    preferences: Preferences | undefined;
    session: Session | undefined;
    /** The active group's feed, for its members. */
    feed: GroupFeed | undefined;
    /** How this device reaches its group now (lib/links). */
    linkInput: LinkInput;
    /** An invitation was pasted or scanned; the caller asks the user to confirm it. */
    oninvitation: (invitation: Invitation) => void;
    /** A group was created: the position is shared in it. */
    oncreated: () => Promise<void>;
  }

  let {
    t,
    locale,
    map,
    offline,
    preferences,
    session,
    feed,
    linkInput,
    oninvitation,
    oncreated,
  }: Props = $props();
</script>

{#if map && offline && isOpen('offline')}
  <OfflineAreasPanel {t} {locale} {map} {offline} onclose={closePanel} />
{/if}

{#if preferences && isOpen('settings')}
  <SettingsPanel {t} {preferences} {locale} onclose={closePanel} />
{/if}

{#if isOpen('connections')}
  <ConnectionsPanel
    {t}
    input={linkInput}
    network={connection.network}
    groupName={session?.activeGroup ? session.nameOfGroup(session.activeGroup) : null}
    onclose={closePanel}
  />
{/if}

{#if session && panels.open?.name === 'groups'}
  {#key panels.open.start}
    <GroupsPanel
      {t}
      {session}
      activeFeed={feed}
      {oninvitation}
      {oncreated}
      onleft={(group: StoredGroup) => {
        attempt(() => radio.forgetGroup(group.secret), t('actionFailed'));
      }}
      start={panels.open.start}
      onclose={closePanel}
    />
  {/key}
{/if}
