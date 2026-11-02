// A slice is one part of the group state with the events that shape it. The group state is
// composed of slices (reducer.ts), so a new kind of event adds or extends one slice and nothing
// else (ARCHITECTURE.md §3.4).

import type { EventType, TeselEvent } from '@tesel/protocol';

export type EventOfType<T extends EventType> = Extract<TeselEvent, { readonly type: T }>;

export interface Slice<S, T extends EventType> {
  /** The event types this slice reads. */
  readonly handles: readonly T[];
  /** The slice of a group with no events yet. */
  readonly empty: S;
  /**
   * The slice after one more event. Must be idempotent and order-independent (ADR-0003), and
   * return `state` itself when nothing changes, so that unchanged slices keep their identity.
   */
  apply(state: S, event: EventOfType<T>): S;
  /**
   * The slice after several more events at once, exactly as applying them one by one would leave
   * it: for slices whose single update copies a collection that grows with the operation, so that
   * opening a long operation is not quadratic. Optional; without it they are applied one by one.
   */
  applyAll?(state: S, events: readonly EventOfType<T>[]): S;
}

/** Declares a slice; the event types are inferred from `handles`. */
export function defineSlice<S, const T extends EventType>(slice: Slice<S, T>): Slice<S, T> {
  return slice;
}
