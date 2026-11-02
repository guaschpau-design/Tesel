<!-- Finds coordinates on the map as they were dictated, in any format the app writes. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import Explained from '../ui/Explained.svelte';
  import Panel from '../ui/Panel.svelte';
  import { parseCoordinate } from './coordinates.ts';

  interface Props {
    t: Translate;
    onfind: (at: LatLon) => void;
    onclose: () => void;
  }

  let { t, onfind, onclose }: Props = $props();

  let typed = $state('');
  let unreadable = $state(false);

  function find(event: SubmitEvent): void {
    event.preventDefault();
    const found = parseCoordinate(typed);
    unreadable = found === null;
    if (found) onfind(found);
  }
  const field = $props.id();
</script>

<Panel title={t('findCoordinate')} closeLabel={t('close')} {onclose}>
  <form class="stack section" onsubmit={find}>
    <div class="field">
      <Explained label={t('aboutCoordinates')} text={t('coordinatesIntro')}>
        <label for={field}>{t('coordinates')}</label>
      </Explained>
      <input
        id={field}
        bind:value={typed}
        oninput={() => (unreadable = false)}
        placeholder="39.47, -0.37 · 30S 725695 4372210"
        autocomplete="off"
        autocapitalize="characters"
        spellcheck="false"
      />
    </div>
    {#if unreadable}<p class="warning">{t('coordinateUnreadable')}</p>{/if}
    <div class="row"><button type="submit" disabled={typed.trim() === ''}>{t('find')}</button></div>
  </form>
</Panel>

<style>
  .field {
    display: grid;
    gap: 0.25rem;
  }
</style>
