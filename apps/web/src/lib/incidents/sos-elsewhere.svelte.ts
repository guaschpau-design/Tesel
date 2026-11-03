// The alarm for an SOS heard by radio for one of this device's groups that is not open, or not
// open yet (ADR-0104): it sounds as for the open group's, says which group it is, and opens that
// group on asking. Each call sounds once (alarmed-sos.ts), so it does not sound again when its
// group opens; a cancellation heard first keeps a late copy of its call from sounding at all.

import { eventRefKey, type NodeId, type SosEvent } from '@tesel/protocol';
import { untrack } from 'svelte';

import type { StoredGroup } from '../groups/group.ts';
import type { Translate } from '../i18n/index.ts';
import { activity } from '../power/activity.svelte.ts';
import type { SosElsewhere } from '../radio/heard-elsewhere.ts';
import { radio } from '../radio/radio.svelte.ts';
import type { Session } from '../session.svelte.ts';
import { shownText } from '../text.ts';
import { announcer } from '../ui/announcer.svelte.ts';
import { notices } from '../ui/notices.svelte.ts';
import { attempt } from '../ui/submission.svelte.ts';
import { raiseAlarm, sosTag, type AlarmChoices } from './alarm.ts';
import { alarmedSos, type AlarmedSos } from './alarmed-sos.ts';
import { SOS_KINDS } from './sos-kinds.ts';

/** A call to sound the alarm for: of someone else, in a group of this device, not alarmed yet. */
interface CallElsewhere {
  readonly group: StoredGroup;
  readonly event: SosEvent;
}

/**
 * The call in `heard` the alarm is to be raised for, if any, which from then on counts as raised;
 * a cancellation counts its call as raised, so that a copy heard later stays silent.
 */
export function callToAlarm(
  heard: SosElsewhere,
  groups: readonly StoredGroup[],
  self: NodeId,
  alarmed: AlarmedSos = alarmedSos,
): CallElsewhere | null {
  const group = groups.find(({ id }) => id === heard.groupId);
  if (group === undefined) return null;
  const { event } = heard;
  if (event.type === 'sos-cancel') {
    alarmed.claim(group.id, [eventRefKey(event.sos)]);
    return null;
  }
  if (event.origin === self) return null;
  return alarmed.claim(group.id, [eventRefKey(event)]).length > 0 ? { group, event } : null;
}

/** What raising the alarm needs, as it is when a call is heard. */
interface Alarming {
  readonly t: Translate;
  readonly session: Session | undefined;
  readonly choices: AlarmChoices | undefined;
}

/** Raises the alarm for calls heard for groups not open, while the calling component lives. */
export function useSosElsewhere(alarming: () => Alarming): void {
  $effect(() =>
    radio.onSosElsewhere((heard) => {
      const { t, session, choices } = untrack(alarming);
      const self = session?.identity?.nodeId;
      if (session === undefined || self === undefined || choices === undefined) return;
      const call = callToAlarm(heard, session.groups, self);
      if (call !== null) alarm(call, t, session, choices);
    }),
  );
}

function alarm(
  { group, event }: CallElsewhere,
  t: Translate,
  session: Session,
  choices: AlarmChoices,
): void {
  const name = session.nameOfGroup(group);
  const title = `${t('sos')} · ${name}`;
  const body = [t(SOS_KINDS[event.kind].label), shownText(event.text)].filter(Boolean).join(' · ');
  raiseAlarm([{ title, body, tag: sosTag(group.id, eventRefKey(event)) }], choices);
  // A screen at rest lights up for it (power/).
  activity.wake();
  announcer.say(`${title}. ${body}`);
  const text = t('sosElsewhere', { group: name });
  // The group being opened again shows the call once open: there is nothing to open.
  if (group.id === session.activeGroupId) {
    notices.show(text, { stays: true });
    return;
  }
  const id = notices.show(text, {
    stays: true,
    action: {
      label: t('openGroup'),
      run: () => {
        notices.withdraw(id);
        attempt(() => session.activate(group.id), t('actionFailed'));
      },
    },
  });
}
