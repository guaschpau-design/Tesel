// What the tasks panel's buttons do to the group (TasksPanel): save a task and say what became of
// it, offering to undo it when it was just marked done; and follow the route a task is along,
// starting the task if it was not.

import { eventRefKey, type EventRef, type NodeId } from '@tesel/protocol';

import type { Translate } from '../i18n/index.ts';
import { navigateTo } from '../navigation/navigation.svelte.ts';
import { objectTitle } from '../objects/object-names.ts';
import type { GroupFeed } from '../sync/group-feed.svelte.ts';
import { noticeSent } from '../sync/sent-notice.ts';
import { attempt } from '../ui/submission.svelte.ts';
import { advance, fieldsOf, type TaskFields, type TaskRow } from './tasks.ts';

export async function saveTask(
  feed: GroupFeed,
  t: Translate,
  task: EventRef | null,
  fields: TaskFields,
): Promise<void> {
  const before = task && feed.state.tasks.get(eventRefKey(task));
  await feed.writeTask(task, fields);
  // A task marked done by mistake goes back as it was in one tap.
  const undone = before && before.status !== 'done' && fields.status === 'done' ? before : null;
  const undo =
    undone === null
      ? undefined
      : {
          label: t('undo'),
          run: () => {
            attempt(() => feed.writeTask(undone.task, fieldsOf(undone)), t('actionFailed'));
          },
        };
  noticeSent(t, feed, t('addTask'), undo);
}

export async function followTask(
  feed: GroupFeed,
  t: Translate,
  row: TaskRow,
  self: NodeId,
): Promise<void> {
  const { place } = row.fields;
  if (place?.kind !== 'object') return;
  const key = eventRefKey(place.object);
  const object = feed.state.objects.get(key);
  if (object === undefined || object.type === 'object-delete') return;
  if (row.fields.status === 'open') await saveTask(feed, t, row.task, advance(row.fields, self));
  navigateTo({ kind: 'object', key, name: objectTitle(object, feed.state.objects, t) });
}
