<!-- Among the map's controls: pocket mode at once (ADR-0127), for a phone going into a pocket or
     onto a table: the screen almost black, touches doing nothing until the user slides out. -->
<script lang="ts">
  import type { Translate } from '../i18n/index.ts';
  import Pictogram from '../ui/Pictogram.svelte';
  import { activity } from './activity.svelte.ts';

  interface Props {
    t: Translate;
  }

  let { t }: Props = $props();
</script>

<button
  aria-label={t('pocketMode')}
  title={t('pocketMode')}
  onclick={() => {
    activity.pocket();
  }}
>
  <Pictogram name="lock" size={18} />
</button>
