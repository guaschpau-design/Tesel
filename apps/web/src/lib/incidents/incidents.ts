// SOS calls as the interface shows them: who, what, where, and who has acknowledged them.

import { compareEvents, openSosCalls, type GroupState } from '@tesel/core';
import { eventRefKey, sosPlace, type LatLon, type NodeId, type SosEvent } from '@tesel/protocol';

import { aliasOf } from '../members/alias.ts';
import { STALE_AFTER_S } from '../members/member-features.ts';

interface Acknowledgement {
  /** Members who acknowledged, by alias. */
  readonly by: readonly string[];
  readonly bySelf: boolean;
}

/**
 * Where the caller of an SOS is: where they called from; or, for a call made without a position,
 * the position they shared since, or shortly before; or nowhere known yet.
 */
export type SosWhere =
  | { readonly kind: 'called'; readonly at: LatLon }
  | { readonly kind: 'shared'; readonly at: LatLon; readonly time: number }
  | { readonly kind: 'unknown' };

export interface SosView extends Acknowledgement {
  /** The call's own key, which tells it apart from a rival under the same reference. */
  readonly key: string;
  /** The call's reference key, which cancellations and acknowledgements point to. */
  readonly ref: string;
  readonly event: SosEvent;
  readonly author: string;
  readonly mine: boolean;
  readonly where: SosWhere;
}

export function whereSos(state: Pick<GroupState, 'positions'>, event: SosEvent): SosWhere {
  const called = sosPlace(event);
  if (called !== null) return { kind: 'called', at: called };
  const shared = state.positions.get(event.origin);
  // A position shared long before the call says little of where the caller is now.
  return shared?.type === 'position' && shared.time >= event.time - STALE_AFTER_S
    ? { kind: 'shared', at: { lat: shared.lat, lon: shared.lon }, time: shared.time }
    : { kind: 'unknown' };
}

/** SOS calls not cancelled yet, newest first, in the same order on every device (protocol §3.10). */
export function activeSos(state: GroupState, self: NodeId): SosView[] {
  const views: SosView[] = [];
  for (const [key, event] of openSosCalls(state)) {
    const ref = eventRefKey(event);
    views.push({
      key,
      ref,
      event,
      author: aliasOf(state, event.origin),
      mine: event.origin === self,
      where: whereSos(state, event),
      ...acknowledgement(state, ref, self),
    });
  }
  return views.sort((a, b) => compareEvents(b.event, a.event));
}

/** Whether `self` has an SOS not cancelled yet: nothing may reload or close its group meanwhile. */
export function hasOwnSos(state: GroupState, self: NodeId): boolean {
  return activeSos(state, self).some((call) => call.mine);
}

function acknowledgement(state: GroupState, ref: string, self: NodeId): Acknowledgement {
  const acks = state.acks.get(ref);
  if (acks === undefined) return { by: [], bySelf: false };
  return {
    by: [...acks.keys()].map((id) => aliasOf(state, id)).sort((a, b) => a.localeCompare(b)),
    bySelf: acks.has(self),
  };
}
