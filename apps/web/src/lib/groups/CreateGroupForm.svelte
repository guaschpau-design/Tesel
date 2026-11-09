<!-- Creating a group: only its name is asked. The server it uses is proposed and can be changed
     under "Advanced options", which most people never open: folded, it says only whether it is
     Tesel's. Creating it shares the position there, as it says (ADR-0128). -->
<script lang="ts">
  import { GROUP_NAME_MAX_BYTES } from '@tesel/protocol';

  import { defaultServerUrl } from '../config.ts';
  import type { Translate } from '../i18n/index.ts';
  import type { Session } from '../session.svelte.ts';
  import { NAME_FAULT_MESSAGES } from '../names/names.ts';
  import Fold from '../ui/Fold.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { groupNameFault, normalizeGroupName, normalizeServerUrl } from './group.ts';

  interface Props {
    t: Translate;
    session: Session;
    /** The group was created and is the one in use: the position is shared in it. */
    oncreated: () => Promise<void>;
    /** Leaves the form: created, or given up. */
    onclose: () => void;
  }

  let { t, session, oncreated, onclose }: Props = $props();

  let newName = $state('');
  const groupName = $derived(normalizeGroupName(newName));
  const nameFault = $derived(newName.trim() === '' ? null : groupNameFault(newName));
  const proposed = defaultServerUrl() ?? '';
  let serverText = $state(proposed);
  const server = $derived(normalizeServerUrl(serverText, window.location.hostname));
  const serverSummary = $derived.by(() => {
    const typed = serverText.trim();
    if (typed === '') return t('serverNone');
    return typed === proposed ? t('serverDefault') : typed;
  });

  const submission = new Submission();

  async function create(): Promise<void> {
    if (groupName === null || server === undefined) return;
    const name = groupName;
    const chosen = server;
    const created = await submission.run(async () => {
      await session.createGroup(name, chosen);
      await oncreated();
    });
    if (created) onclose();
  }
</script>

<form
  class="stack section"
  onsubmit={(event) => {
    event.preventDefault();
    void create();
  }}
>
  <h3>{t('createGroup')}</h3>
  <label>
    {t('groupName')}
    <!-- svelte-ignore a11y_autofocus -->
    <input bind:value={newName} maxlength={GROUP_NAME_MAX_BYTES} autofocus />
  </label>
  {#if nameFault}<p class="warning">{t(NAME_FAULT_MESSAGES[nameFault])}</p>{/if}
  <Fold title={t('advancedOptions')} summary={serverSummary} open={server === undefined}>
    <label>
      {t('server')}
      <input bind:value={serverText} inputmode="url" autocomplete="off" placeholder="https://" />
    </label>
    <p class:warning={server === undefined} class:hint={server !== undefined}>
      {server === undefined ? t('serverInvalid') : t('serverHint')}
    </p>
  </Fold>
  <p class="hint">{t('sharesOnEntering')}</p>
  {#if submission.failed}<p class="warning">{t('sendFailed')}</p>{/if}
  <div class="row">
    <button
      type="submit"
      class="primary"
      disabled={submission.busy || groupName === null || server === undefined}
    >
      {t('create')}
    </button>
    <button type="button" onclick={onclose}>{t('cancel')}</button>
  </div>
</form>
