// SOS calls as the interface shows them: who, what, where, and who has acknowledged them.

import { openSosCalls, type GroupState } from '@tesel/core';
import { sosPlace, type LatLon, type NodeId, type SosEvent } from '@tesel/protocol';

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
  readonly key: string;
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

/** SOS calls not cancelled yet, newest first. */
export function activeSos(state: GroupState, self: NodeId): SosView[] {
  const views: SosView[] = [];
  for (const [key, event] of openSosCalls(state)) {
    views.push({
      key,
      event,
      author: aliasOf(state, event.origin),
      mine: event.origin === self,
      where: whereSos(state, event),
      ...acknowledgement(state, key, self),
    });
  }
  return views.sort((a, b) => b.event.time - a.event.time);
}

function acknowledgement(state: GroupState, key: string, self: NodeId): Acknowledgement {
  const acks = state.acks.get(key);
  if (acks === undefined) return { by: [], bySelf: false };
  return {
    by: [...acks.keys()].map((id) => aliasOf(state, id)).sort((a, b) => a.localeCompare(b)),
    bySelf: acks.has(self),
  };
}
