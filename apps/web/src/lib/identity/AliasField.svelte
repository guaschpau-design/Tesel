<!-- The name the group sees this person by: typed on first launch (Onboarding) and changed in Me.
     Says when it is too long for the protocol, holds a broken character, half of an emoji cut off
     by the field's length, or one that is not seen (names.ts). -->
<script lang="ts">
  import { ALIAS_MAX_BYTES } from '@tesel/protocol';

  import type { Translate } from '../i18n/index.ts';
  import { NAME_FAULT_MESSAGES } from '../names/names.ts';
  import { aliasFault } from './identity.ts';

  interface Props {
    t: Translate;
    text: string;
    ontext: (text: string) => void;
  }

  let { t, text, ontext }: Props = $props();

  const fault = $derived(text.trim() === '' ? null : aliasFault(text));
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
<p class:warning={fault !== null} class:hint={fault === null}>
  {fault === null ? t('aliasHint') : t(NAME_FAULT_MESSAGES[fault])}
</p>
