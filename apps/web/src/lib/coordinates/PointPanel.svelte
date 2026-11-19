<!-- A point of the map, picked by a long press, found by its coordinates or tapped as a public
     service: how far it is from here, what else is known of it and what can be done there first,
     then its coordinates, small, to copy. What can be seen from it is shown on the map while asked
     for, with a line on how it was worked out (ADR-0152). -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';
  import type { Snippet } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import FromHere from '../navigation/FromHere.svelte';
  import type { Preference } from '../settings/preference.svelte.ts';
  import type { Action } from '../ui/action.ts';
  import Actions from '../ui/Actions.svelte';
  import Pictogram from '../ui/Pictogram.svelte';
  import Panel from '../ui/Panel.svelte';
  import { formatDistance } from '../format.ts';
  import { VIEW_RADIUS_M } from '../terrain/viewshed.ts';
  import type { ViewshedState } from '../terrain/viewshed.ts';
  import CoordinateLine from './CoordinateLine.svelte';
  import type { CoordinateFormat } from './coordinates.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    /** "Map point", or the name of the service tapped. */
    title: string;
    at: LatLon;
    format: Preference<CoordinateFormat>;
    onnavigate: () => void;
    /** Present when the point can be marked for the group. */
    onmark: (() => void) | null;
    /** Present when a task can be added there for the group. */
    ontask: (() => void) | null;
    /** What can be seen from the point: off, or how its working out goes. */
    viewshed: ViewshedState;
    /** Present when what can be seen from the point can be worked out: shows or hides it. */
    onviewshed: (() => void) | null;
    onclose: () => void;
    /** What else is known of the point, such as the weather warnings there. */
    about?: Snippet;
  }

  let {
    t,
    locale,
    title,
    at,
    format,
    onnavigate,
    onmark,
    ontask,
    viewshed,
    onviewshed,
    onclose,
    about,
  }: Props = $props();

  const actions: Action[] = $derived([
    { icon: 'heading', label: t('guideMe'), run: onnavigate },
    ...(onmark ? [{ icon: 'pin', label: t('markHere'), run: onmark } as const] : []),
    ...(ontask ? [{ icon: 'task', label: t('taskHere'), run: ontask } as const] : []),
  ]);
</script>

<Panel {title} closeLabel={t('close')} {onclose}>
  <div class="stack section">
    <FromHere {t} {locale} {at} />
    <Actions {actions} moreLabel={t('moreActions')} />
    <!-- Seldom wanted, so not among the actions, whose room goes to marking and tasks. -->
    {#if onviewshed && viewshed === 'off'}
      <button class="view" onclick={onviewshed}>
        <Pictogram name="eye" size={18} />
        {t('seenFromHere')}
      </button>
    {/if}
    {#if viewshed !== 'off'}
      <p class="viewshed">
        <span>
          {#if viewshed === 'working'}
            {t('viewshedWorking')}
          {:else if viewshed === 'shown'}
            {t('viewshedShown', { distance: formatDistance(VIEW_RADIUS_M, locale) })}
          {:else}
            {t('viewshedUnknown')}
          {/if}
        </span>
        {#if onviewshed}
          <button onclick={onviewshed}>{t('hideViewshed')}</button>
        {/if}
      </p>
    {/if}
    {@render about?.()}
    <CoordinateLine {t} {at} {format} />
  </div>
</Panel>

<style>
  .view {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-self: start;
  }

  .viewshed {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    justify-content: space-between;
    margin: 0;
    font-size: var(--text-secondary);
  }
</style>
