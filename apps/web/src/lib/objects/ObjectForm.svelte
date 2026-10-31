<!-- Describes a drawn object (label, and symbol or style; a route is always a route) before it is
     shared with the group: a step of the drawing that must end, saved or cancelled, before
     anything else is done. Opened on an object of the map, it changes them. A search area cleared
     by its sweep is not drawn so: it is offered only to an area that is one already. The operation
     area says what choosing it does. -->
<script lang="ts">
  import {
    MARKER_LABEL_MAX_BYTES,
    SHAPE_LABEL_MAX_BYTES,
    ShapeStyleCode,
    utf8ByteLength,
  } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import { UnencodableEvent } from '../events/event-log.ts';
  import type { Translate } from '../i18n/index.ts';
  import Dialog from '../ui/Dialog.svelte';
  import { Submission } from '../ui/submission.svelte.ts';
  import { areaStyles, SYMBOLS } from './catalog.ts';
  import { DRAFT_TITLES, type DraftKind } from './draft.ts';
  import SymbolIcon from './SymbolIcon.svelte';

  interface Props {
    t: Translate;
    kind: DraftKind;
    /** The label to start from, such as a route's name in the file it came from. */
    label: string;
    /** The symbol or style to start from, when changing an object; none for a new one. */
    code?: number | undefined;
    /** What the dialog says it does: by default, that a new object of `kind` is described. */
    title?: string | undefined;
    /** This device coordinates: its areas can mark the operation area. */
    coordinator: boolean;
    /** Saves the object; rejects if it does not fit in a radio message. */
    onsave: (code: number, label: string) => Promise<void>;
    oncancel: () => void;
  }

  let {
    t,
    kind,
    label: initialLabel,
    code: initialCode,
    title,
    coordinator,
    onsave,
    oncancel,
  }: Props = $props();

  const isMarker = $derived(kind === 'marker');
  const maxBytes = $derived(isMarker ? MARKER_LABEL_MAX_BYTES : SHAPE_LABEL_MAX_BYTES);

  const startCode = untrack(() => initialCode ?? (kind === 'route' ? ShapeStyleCode.ROUTE : 0));
  let code = $state(startCode);
  const styles = $derived(
    areaStyles(coordinator).filter(
      (style) =>
        style.code !== ShapeStyleCode.SEARCH_CLEARED || startCode === ShapeStyleCode.SEARCH_CLEARED,
    ),
  );
  let label = $state(untrack(() => initialLabel));
  const submission = new Submission();
  const tooLong = $derived(utf8ByteLength(label.trim()) > maxBytes);
</script>

<Dialog title={title ?? t(DRAFT_TITLES[kind])} {oncancel}>
  <form
    class="stack"
    onsubmit={(event) => {
      event.preventDefault();
      void submission.run(() => onsave(code, label.trim()));
    }}
  >
    {#if kind !== 'route'}
      <fieldset>
        <legend>{isMarker ? t('symbol') : t('shapeType')}</legend>
        <div class="choices">
          {#if isMarker}
            {#each SYMBOLS as symbol (symbol.code)}
              <label class="choice">
                <input type="radio" name="code" value={symbol.code} bind:group={code} />
                <SymbolIcon code={symbol.code} size={30} />
                <span>{t(symbol.label)}</span>
              </label>
            {/each}
          {:else}
            {#each styles as style (style.code)}
              <label class="choice">
                <input type="radio" name="code" value={style.code} bind:group={code} />
                <span class="swatch" style:--swatch="var(--tone-{style.tone})"></span>
                <span>{t(style.label)}</span>
              </label>
            {/each}
          {/if}
        </div>
      </fieldset>
      {#if code === ShapeStyleCode.OPERATION_AREA}
        <p class="hint">{t('operationAreaHint')}</p>
      {/if}
    {/if}
    <label>
      {t('objectLabel')}
      <input bind:value={label} autocomplete="off" />
    </label>
    {#if tooLong}<p class="warning">{t('nameInvalid')}</p>{/if}
    {#if submission.failed}
      <p class="warning">
        {submission.failure instanceof UnencodableEvent ? t('objectTooBig') : t('sendFailed')}
      </p>
    {/if}
    <div class="row">
      <button type="submit" class="primary" disabled={submission.busy || tooLong}
        >{t('save')}</button
      >
      <button type="button" onclick={oncancel}>{t('cancel')}</button>
    </div>
  </form>
</Dialog>

<style>
  /* A grid of tiles, a pictogram over a short name, so every choice is in view at once. */
  .choices {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.35rem;
  }

  .choice {
    position: relative;
    display: grid;
    gap: 0.25rem;
    justify-items: center;
    padding: 0.4rem 0.25rem;
    font-size: var(--text-small);
    line-height: 1.2;
    text-align: center;
    cursor: pointer;
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
  }

  .choice:has(input:checked) {
    font-weight: 600;
    border-color: var(--accent-line);
    box-shadow: inset 0 0 0 1px var(--accent-line);
  }

  .choice:has(input:focus-visible) {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  /* The radio button is the whole card, invisible: it keeps keyboards, screen readers and taps
     working, and the frame shows the choice. */
  .choice input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }

  .swatch {
    flex-shrink: 0;
    width: 1.6rem;
    height: 0.9rem;
    background: color-mix(in srgb, var(--swatch) 25%, transparent);
    border: 2.5px solid var(--swatch);
    border-radius: 0.2rem;
  }
</style>
