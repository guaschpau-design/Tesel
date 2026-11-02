// Drawing a map object: tapping its points (`draft`), typing their coordinates, or reading a route
// or an area from a file, then describing it (`describing`) before it is shared with the group.

import type { LatLon } from '@tesel/protocol';

import {
  addPoint,
  fits,
  isFull,
  startDraft,
  undoPoint,
  type Draft,
  type DraftKind,
} from './draft.ts';
import type { ImportedShape } from './shape-import.ts';

export class Drawing {
  draft: Draft | null = $state.raw(null);
  describing = $state(false);
  /** The route or area read from a file, when the draft came from one. */
  imported: ImportedShape | null = $state.raw(null);

  /** Placing its points on the map, before describing. */
  get placingPoints(): boolean {
    return this.draft !== null && !this.describing;
  }

  start(kind: DraftKind): void {
    this.draft = startDraft(kind);
    this.describing = false;
    this.imported = null;
  }

  /** Takes a shape read from a file as the draft, to be looked over on the map and finished. */
  load(shape: ImportedShape): void {
    this.draft = { kind: shape.kind, points: shape.points };
    this.describing = false;
    this.imported = shape;
  }

  /**
   * Adds a tapped point; once no more fit, the object is ready to be described, unless it is too
   * wide to send, which the drawing bar says.
   */
  add(at: LatLon): void {
    if (this.draft === null) return;
    this.draft = addPoint(this.draft, at);
    if (isFull(this.draft) && fits(this.draft)) this.describing = true;
  }

  undo(): void {
    if (this.draft !== null) this.draft = undoPoint(this.draft);
  }

  finish(): void {
    this.describing = true;
  }

  stop(): void {
    this.draft = null;
    this.describing = false;
    this.imported = null;
  }
}
