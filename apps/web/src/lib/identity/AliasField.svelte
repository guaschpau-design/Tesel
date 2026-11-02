<!-- The name the group sees this person by: typed on first launch (Onboarding) and changed in Me.
     Says when it is too long for the protocol, or holds a broken character, half of an emoji cut
     off by the field's length. -->
<script lang="ts">
  import { ALIAS_MAX_BYTES, isWellFormedText } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { normalizeAlias } from './identity.ts';

  interface Props {
    t: Translate;
    text: string;
    ontext: (text: string) => void;
  }

  let { t, text, ontext }: Props = $props();

  const invalid = $derived(text.trim() !== '' && normalizeAlias(text) === null);
</script>

<label>
  {t('aliasLabel')}
  <!-- Whatever shows this field shows it to type in: focusing it helps. -->
  <!-- svelte-ignore a11y_autofocus -->
  <input
    value={text}
    oninput={(event) => {
      ontext(event.currentTarget.value);
    }}
    maxlength={ALIAS_MAX_BYTES}
    autocomplete="nickname"
    autofocus
  />
</label>
<p class:warning={invalid} class:hint={!invalid}>
  {#if !invalid}
    {t('aliasHint')}
  {:else if isWellFormedText(text)}
    {t('nameInvalid')}
  {:else}
    {t('nameBroken')}
  {/if}
</p>
