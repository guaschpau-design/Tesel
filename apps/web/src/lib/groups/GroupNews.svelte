<!-- Tells whoever coordinates, in a short notice, what is new in the group (group-news.ts): who
     joins, in one notice for those who join together, a situation report, a task started, its
     place reached or the task finished, a danger area entered or the area of a task left; "View"
     opens the report, the task or the member. A place reached and an area crossed wake the screen.
     While the app is not on screen, each is also a notification of the phone, if allowed in More
     (ADR-0166). What the group held when it opened is not news. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { eventRefKey, type NodeId } from '@tesel/protocol';
  import { untrack } from 'svelte';

  import type { Locale, Translate } from '../i18n/index.ts';
  import { aliasOf } from '../members/alias.ts';
  import { namedAfter } from '../objects/object-names.ts';
  import { reportLines } from '../reports/report-summary.ts';
  import { REPORTS } from '../chat/chat-tabs.ts';
  import { editTask } from '../tasks/task-editor.ts';
  import { taskGoal } from '../tasks/task-reach.ts';
  import { callAttention } from '../power/attention.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { openPanel } from '../ui/panels.svelte.ts';
  import { notifyAway } from '../ui/system-notifications.ts';
  import { groupNews, type GroupNews, type NewsState } from './group-news.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    state: NewsState & Pick<GroupState, 'objects'>;
    self: NodeId;
    /** The group's ID and name: a phone's notification says which group it is of. */
    groupId: string;
    groupName: string;
    /** Whether the phone's notifications are allowed in More. */
    notify: boolean;
  }

  let { t, locale, state, self, groupId, groupName, notify }: Props = $props();

  /** Something told: what it says, what tells it apart, and what "View" opens. */
  interface Told {
    readonly key: string;
    readonly said: string;
    readonly view: (() => void) | null;
    /** Wakes the screen, for what calls for a look now. */
    readonly attention: boolean;
  }

  let seen = untrack(() => ({
    members: state.members,
    reports: state.reports,
    tasks: state.tasks,
    taskReaches: state.taskReaches,
    zoneCrossings: state.zoneCrossings,
  }));

  $effect(() => {
    const now = {
      members: state.members,
      reports: state.reports,
      tasks: state.tasks,
      taskReaches: state.taskReaches,
      zoneCrossings: state.zoneCrossings,
    };
    const news = groupNews(seen, now, self, Date.now() / 1000);
    seen = now;
    for (const { key, said, view, attention } of told(news, now)) {
      if (attention) callAttention();
      notices.show(said, view ? { action: { label: t('view'), run: view } } : {});
      if (notify) {
        void notifyAway({ title: groupName, body: said, tag: `${groupId}/news/${key}` }, false);
      }
    }
  });

  /** What each piece of news says; those who join together, in one. */
  function told(news: readonly GroupNews[], now: NewsState): Told[] {
    const all: Told[] = [];
    const joined = news.flatMap((item) => (item.kind === 'joined' ? [item.who] : []));
    const [first] = joined;
    if (first !== undefined) {
      const names = new Intl.ListFormat(locale).format(joined.map((who) => aliasOf(now, who)));
      const said = t(joined.length === 1 ? 'newsJoinedOne' : 'newsJoinedMany', { names });
      all.push({ key: `joined/${first}`, said, view: null, attention: false });
    }
    const objects = untrack(() => state.objects);
    for (const item of news) {
      switch (item.kind) {
        case 'joined':
          break;
        case 'report': {
          const lines = reportLines(item.report, t);
          const report = [lines.incident, lines.casualties].filter(Boolean).join(' · ');
          all.push({
            key: eventRefKey(item.report),
            said: t('newsReport', { name: aliasOf(now, item.report.origin), report }),
            view: () => {
              openPanel(REPORTS);
            },
            attention: false,
          });
          break;
        }
        case 'task': {
          const { origin, status, text } = item.task;
          const key = eventRefKey(item.task.task);
          all.push({
            key: eventRefKey(item.task),
            said: t(status === 'done' ? 'newsTaskDone' : 'newsTaskStarted', {
              name: aliasOf(now, origin),
              text,
            }),
            view: () => {
              editTask(key);
            },
            attention: false,
          });
          break;
        }
        case 'reached': {
          const { origin } = item.reach;
          const task = now.tasks.get(eventRefKey(item.reach.task));
          // A reach of a task not heard of yet says nothing that can be told.
          if (task === undefined) break;
          const way = taskGoal(task.place, objects)?.kind === 'way';
          all.push({
            key: eventRefKey(item.reach),
            said: t(way ? 'newsTaskReachedEnd' : 'newsTaskReached', {
              name: aliasOf(now, origin),
              text: task.text,
            }),
            view: () => {
              openPanel({ name: 'member', member: origin });
            },
            attention: true,
          });
          break;
        }
        case 'crossing': {
          const { origin, zone, kind } = item.crossing;
          const area = objects.get(eventRefKey(zone));
          all.push({
            key: eventRefKey(item.crossing),
            said: t(kind === 'danger' ? 'newsZoneDanger' : 'newsZoneLeft', {
              name: aliasOf(now, origin),
              zone: namedAfter(area?.type === 'shape' ? area.label : '', t),
            }),
            view: () => {
              openPanel({ name: 'member', member: origin });
            },
            attention: true,
          });
          break;
        }
      }
    }
    return all;
  }
</script>
