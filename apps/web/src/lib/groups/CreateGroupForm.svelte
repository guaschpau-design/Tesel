<!-- Creating a group: only its name is asked. The server it uses is proposed and can be changed
     under "Server", which most people never open: folded, it says only whether it is Tesel's. -->
<script lang="ts">
  import { GROUP_NAME_MAX_BYTES } from '@tesel/protocol';

  import { defaultServerUrl } from '../config.ts';
  import type { Translate } from '../i18n/index.ts';
  import type { Session } from '../session.svelte.ts';
  import Fold from '../ui/Fold.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { normalizeGroupName, normalizeServerUrl } from './group.ts';

  interface Props {
    t: Translate;
    session: Session;
    /** Back to the groups, once created or when giving up. */
    /** Leaves the form: created, or given up. */
    onclose: () => void;
  }

  let { t, session, onclose }: Props = $props();

  let newName = $state('');
  const groupName = $derived(normalizeGroupName(newName));
  const nameTooLong = $derived(newName.trim() !== '' && groupName === null);
  const proposed = defaultServerUrl() ?? '';
  let serverText = $state(proposed);
  const server = $derived(normalizeServerUrl(serverText));
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
    if (await submission.run(() => session.createGroup(name, chosen))) onclose();
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
  {#if nameTooLong}<p class="warning">{t('nameInvalid')}</p>{/if}
  <Fold title={t('server')} summary={serverSummary} open={server === undefined}>
    <input
      bind:value={serverText}
      aria-label={t('server')}
      inputmode="url"
      autocomplete="off"
      placeholder="https://"
    />
    <p class:warning={server === undefined} class:hint={server !== undefined}>
      {server === undefined ? t('serverInvalid') : t('serverHint')}
    </p>
  </Fold>
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
