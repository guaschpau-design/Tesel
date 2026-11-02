// What takes the taps on the map instead of what is drawn on it: drawing a map object, or a tool
// (measuring, planning a sweep, picking a task's place). One at a time: starting one ends the other
// and closes the panel open, so that the map is in view.

import type { LatLon } from '@tesel/protocol';
import { untrack } from 'svelte';

import { navigation, stopNavigating } from '../navigation/navigation.svelte.ts';
import type { DraftKind } from '../objects/draft.ts';
import { Drawing } from '../objects/drawing.svelte.ts';
import { closePanel } from '../ui/panels.svelte.ts';
import type { MapTool } from './workspace.ts';

export interface MapTools {
  readonly drawing: Drawing;
  /** The tool in use, if any. */
  readonly tool: MapTool | null;
  /** Drawing or a tool: taps on the map add points instead of opening what they hit. */
  readonly drawingOrMeasuring: boolean;
  readonly startDrawing: (kind: DraftKind) => void;
  /** Starts a marker at a point and goes straight to describing it. */
  readonly markAt: (at: LatLon) => void;
  readonly startTool: (next: MapTool) => void;
  readonly closeTool: () => void;
}

/**
 * Drawing and the tools of the map for the active group, by its id, while the calling component
 * lives.
 */
export function useMapTools(groupId: () => string | null): MapTools {
  const drawing = new Drawing();
  let tool: MapTool | null = $state.raw(null);
  const drawingOrMeasuring = $derived(drawing.draft !== null || tool !== null);

  // What was drawn, picked or followed in one group means nothing in another: changing groups, or
  // leaving the last one, ends it. Guidance to a point of the map goes on.
  let shownGroup: string | null = null;
  $effect(() => {
    const id = groupId();
    untrack(() => {
      if (id === shownGroup) return;
      shownGroup = id;
      drawing.stop();
      tool = null;
      if (navigation.target !== null && navigation.target.kind !== 'point') stopNavigating();
    });
  });

  function startDrawing(kind: DraftKind): void {
    closePanel();
    tool = null;
    drawing.start(kind);
  }

  return {
    drawing,
    get tool() {
      return tool;
    },
    get drawingOrMeasuring() {
      return drawingOrMeasuring;
    },
    startDrawing,
    markAt: (at) => {
      startDrawing('marker');
      drawing.add(at);
    },
    startTool: (next) => {
      closePanel();
      drawing.stop();
      tool = next;
    },
    closeTool: () => {
      tool = null;
    },
  };
}
