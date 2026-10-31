// The short notice that says what was sent and whether it reached the group, is on its way by
// radio, or waits on the device: after a marker, a zone, a route, a task or a report, so nobody
// wonders whether it went. It may offer to undo it, as a task marked done by mistake.

import type { MessageKey, Translate } from '../i18n/index.ts';
import { notices, type NoticeAction } from '../ui/notices.svelte.ts';
import type { Delivery, GroupFeed } from './group-feed.svelte.ts';

const SENT: Readonly<Record<Delivery, MessageKey>> = {
  group: 'sentToGroup',
  radio: 'sentByRadio',
  waiting: 'sentWaiting',
};

/** Says that `what` ("Marker", "Task") was sent, and how it went. */
export function noticeSent(t: Translate, feed: GroupFeed, what: string, undo?: NoticeAction): void {
  notices.show(t(SENT[feed.delivery], { what }), undo === undefined ? {} : { action: undo });
}
