<!-- Among the map's controls: declutters the map, or shows again everything the layers panel
     shows (ADR-0151). Decluttered, only the team, threats and calls for help are drawn, with the
     names of places. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import type { Preference } from '../settings/preference.svelte.ts';
  import Pictogram from '../ui/Pictogram.svelte';

  interface Props {
    t: Translate;
    declutter: Preference<boolean>;
  }

  let { t, declutter }: Props = $props();
</script>

<button
  aria-label={t('declutter')}
  title={t('declutter')}
  aria-pressed={declutter.value}
  onclick={() => {
    void declutter.set(!declutter.value);
  }}
>
  <Pictogram name="funnel" size={18} />
</button>

<style>
  /* On the ink of the map's controls, filled in lime while pressed, as the 3D button. */
  button[aria-pressed='true'],
  button[aria-pressed='true']:hover {
    color: var(--on-accent);
    background: var(--signal);
  }
</style>
