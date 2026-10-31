<!-- The card at the top while drawing: what is drawn, one line of what to do and, once points are
     tapped, how many of the most there may be. A point can be typed as coordinates in place of a
     tap; a route or an area can be read from a file, which is then shown as drawn, to look over
     before finishing. -->
<script lang="ts">
  import { SHAPE_MAX_POINTS, type LatLon } from '@tesel/protocol';

  import { formatDistance } from '../format.ts';
  import type { Locale, MessageKey, Translate } from '../i18n/index.ts';
  import ToolButton from '../ui/ToolButton.svelte';
  import ToolCard from '../ui/ToolCard.svelte';
  import { DRAFT_TITLES, isComplete, type Draft, type DraftKind } from './draft.ts';
  import CoordinateEntry from '../coordinates/CoordinateEntry.svelte';
  import { importShape, type ImportedShape, type ShapeImportError } from './shape-import.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    draft: Draft;
    /** The route or area read from a file, when the draft came from one. */
    imported: ImportedShape | null;
    /** A point typed as coordinates, as if tapped. */
    onpoint: (at: LatLon) => void;
    onundo: () => void;
    onfinish: () => void;
    onimport: (shape: ImportedShape) => void;
    oncancel: () => void;
  }

  let { t, locale, draft, imported, onpoint, onundo, onfinish, onimport, oncancel }: Props =
    $props();

  const HINTS: Readonly<Record<DraftKind, MessageKey>> = {
    marker: 'drawHintMarker',
    route: 'drawHintRoute',
    area: 'drawHintArea',
  };

  const IMPORT_FAILURES: Readonly<Record<ShapeImportError, MessageKey>> = {
    'too-big': 'shapeFileTooBig',
    unreadable: 'shapeFileUnreadable',
    unsupported: 'shapeFileUnsupported',
    'no-line': 'shapeFileNoLine',
    'no-area': 'shapeFileNoArea',
  };

  let picker: HTMLInputElement | undefined = $state();
  let failure: MessageKey | null = $state(null);
  /** Whether the field for a point's coordinates is open. */
  let typing = $state(false);

  async function read(file: File, kind: 'route' | 'area'): Promise<void> {
    const result = await importShape(file, kind);
    failure = result.ok ? null : IMPORT_FAILURES[result.error];
    if (result.ok) onimport(result.value);
  }

  const title = $derived(t(DRAFT_TITLES[draft.kind]));
  /** Near the most points a shape may have, the count says how many there may be. */
  const NEAR_MAX = 5;
  /** A marker is one tap: it needs no count. */
  const progress = $derived.by(() => {
    const count = draft.points.length;
    if (draft.kind === 'marker' || count === 0) return t(HINTS[draft.kind]);
    return count < SHAPE_MAX_POINTS - NEAR_MAX
      ? t('drawPointsCount', { count })
      : t('drawPoints', { count, max: SHAPE_MAX_POINTS });
  });
</script>

<ToolCard
  label={title}
  undo={draft.kind === 'marker'
    ? undefined
    : { label: t('undo'), disabled: draft.points.length === 0, run: onundo }}
  closeLabel={t('cancel')}
  onclose={oncancel}
  finish={draft.kind === 'marker'
    ? undefined
    : { label: t('finish'), disabled: !isComplete(draft), run: onfinish }}
>
  {#snippet tools()}
    <ToolButton
      icon="grid"
      label={t('coordinates')}
      name={t('typeCoordinates')}
      expanded={typing}
      onclick={() => (typing = !typing)}
    />
    {#if draft.kind !== 'marker'}
      {@const kind = draft.kind}
      <ToolButton
        icon="file"
        label={t('file')}
        name={t('shapeImport')}
        onclick={() => picker?.click()}
      />
      <input
        bind:this={picker}
        type="file"
        accept=".gpx,.kml,.geojson,.json"
        hidden
        onchange={(event) => {
          const [file] = event.currentTarget.files ?? [];
          event.currentTarget.value = '';
          if (file) void read(file, kind);
        }}
      />
    {/if}
  {/snippet}
  {#if imported}
    <p>
      <strong>{title}</strong> · {t('shapeImported', {
        name: imported.name,
        points: imported.points.length,
      })}
    </p>
    {#if imported.read > imported.points.length}
      <p class="hint">
        {t('shapeSimplified', {
          read: imported.read,
          deviation: formatDistance(imported.deviation, locale),
        })}
      </p>
    {/if}
  {:else}
    <p><strong>{title}</strong> · {progress}</p>
  {/if}
  {#if typing}
    <CoordinateEntry {t} action={t('add')} {onpoint} />
  {/if}
  {#if failure}<p class="warning">{t(failure)}</p>{/if}
</ToolCard>
