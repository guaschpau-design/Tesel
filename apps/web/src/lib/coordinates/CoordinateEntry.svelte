<!-- Typing a point's coordinates, as they were dictated, in any format the app writes: on a tool's
     card on the map, in place of a tap (drawing, picking a task's place). The field is cleared for
     the next point once one is taken. -->
<script lang="ts">
  import type { LatLon } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { parseCoordinate } from './coordinates.ts';

  interface Props {
    t: Translate;
    /** What the button does with the point: add it, or use it. */
    action: string;
    onpoint: (at: LatLon) => void;
  }

  let { t, action, onpoint }: Props = $props();

  let typed = $state('');
  let unreadable = $state(false);

  function take(event: SubmitEvent): void {
    event.preventDefault();
    const found = parseCoordinate(typed);
    unreadable = found === null;
    if (found === null) return;
    typed = '';
    onpoint(found);
  }
</script>

<form class="entry" onsubmit={take}>
  <input
    bind:value={typed}
    oninput={() => (unreadable = false)}
    aria-label={t('coordinates')}
    placeholder="39.47, -0.37 · 30S 725695 4372210"
    autocomplete="off"
    autocapitalize="characters"
    spellcheck="false"
  />
  <button type="submit" disabled={typed.trim() === ''}>{action}</button>
</form>
{#if unreadable}<p class="warning">{t('coordinateUnreadable')}</p>{/if}

<style>
  /* The field takes the width there is, and no more, its button beside it. */
  .entry {
    display: flex;
    gap: 0.35rem;
    min-width: 0;
  }

  .entry input {
    flex: 1 1 0;
    width: 0;
    min-width: 0;
  }
</style>
