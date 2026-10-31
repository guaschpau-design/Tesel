<!-- A member of the group: first how far they are and the way there, then what they tell the team
     about themselves (MemberSheet): status, profile, battery, position, equipment and tasks, and
     when something of theirs last reached this device, and how. -->
<script lang="ts">
  import { teamOf, type GroupState } from '@tesel/core';
  import type { NodeId } from '@tesel/protocol';

  import CoordinateLine from '../coordinates/CoordinateLine.svelte';
  import type { CoordinateFormat } from '../coordinates/coordinates.ts';
  import { formatAgo, formatTime } from '../format.ts';
  import { ROLE_LABELS } from '../groups/role-label.ts';
  import type { Locale, Translate } from '../i18n/index.ts';
  import type { Heard } from '../links/heard.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { Preference } from '../settings/preference.svelte.ts';
  import { pendingFor } from '../tasks/tasks.ts';
  import Actions from '../ui/Actions.svelte';
  import { clockEvery } from '../ui/now.svelte.ts';
  import Panel from '../ui/Panel.svelte';
  import { aliasOf } from './alias.ts';
  import MemberSheet from './MemberSheet.svelte';
  import SheetPart from './SheetPart.svelte';

  interface Props {
    t: Translate;
    locale: Locale;
    groupState: GroupState;
    /** This device: the tasks shown are in its list's order. */
    self: NodeId;
    heard: Heard;
    id: NodeId;
    format: Preference<CoordinateFormat>;
    /** Guide this device there; the name says where to. */
    onnavigate: (name: string) => void;
    onclose: () => void;
  }

  let { t, locale, groupState, self, heard, id, format, onnavigate, onclose }: Props = $props();

  /** What a member who has said nothing is taken to be. */
  const UNTOLD = {
    profile: 'unspecified',
    status: 'active',
    battery: null,
    equipment: [],
  } as const;

  const alias = $derived(aliasOf(groupState, id));
  const role = $derived(groupState.members.get(id)?.role);
  const state = $derived(groupState.memberStates.get(id) ?? UNTOLD);
  const report = $derived(groupState.positions.get(id));
  const now = clockEvery(15_000);
  const channels = $derived(heard.get(id) ?? {});
  /** When something of theirs last came, by the server and by radio: "2 min ago by internet". */
  const lastHeard = $derived(
    [
      channels.internet !== undefined &&
        t('heardInternet', { ago: formatAgo(channels.internet, locale, now.seconds) }),
      channels.radio !== undefined &&
        t('heardRadio', { ago: formatAgo(channels.radio, locale, now.seconds) }),
    ]
      .filter((part) => part !== false)
      .join(' · ') || t('heardNothing'),
  );
</script>

<Panel title={alias} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    {#if role === 'coordinator'}<p class="hint">{t(ROLE_LABELS[role])}</p>{/if}
    {#if report?.type === 'position'}
      <FromHere {t} {locale} at={{ lat: report.lat, lon: report.lon }} />
      <Actions
        actions={[
          {
            icon: 'heading',
            label: t('guideMe'),
            run: () => {
              onnavigate(alias);
            },
          },
        ]}
        moreLabel={t('moreActions')}
      />
    {/if}
    <MemberSheet
      {t}
      {state}
      team={teamOf(groupState.teams, id)}
      tasks={pendingFor(groupState, id, self)}
    >
      {#snippet position()}
        {#if report?.type === 'position'}
          {@const at = { lat: report.lat, lon: report.lon }}
          <p class="hint">{t('positionAt', { time: formatTime(report.time * 1000, locale) })}</p>
          <CoordinateLine {t} {at} {format} />
        {:else}
          <p class="hint">{t('memberNoPosition')}</p>
        {/if}
      {/snippet}
      {#snippet more()}
        <SheetPart title={t('heardTitle')} inline>
          <p>{lastHeard}</p>
        </SheetPart>
      {/snippet}
    </MemberSheet>
  </div>
</Panel>
