<!-- Tells whoever coordinates, in a short notice, what is new in the group (group-news.ts): who
     joins, in one notice for those who join together, a situation report, a task started or
     finished; "View" opens the report or the task. What the group held when it opened is not
     news. -->
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
  import { callAttention } from '../power/attention.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { openPanel } from '../ui/panels.svelte.ts';
  import { groupNews, type NewsState } from './group-news.ts';

  interface Props {
    t: Translate;
    locale: Locale;
    state: NewsState & Pick<GroupState, 'objects'>;
    self: NodeId;
  }

  let { t, locale, state, self }: Props = $props();

  let seen = untrack(() => ({
    members: state.members,
    reports: state.reports,
    tasks: state.tasks,
    zoneCrossings: state.zoneCrossings,
  }));

  $effect(() => {
    const now = {
      members: state.members,
      reports: state.reports,
      tasks: state.tasks,
      zoneCrossings: state.zoneCrossings,
    };
    const news = groupNews(seen, now, self, Date.now() / 1000);
    seen = now;
    const joined = news.flatMap((item) => (item.kind === 'joined' ? [aliasOf(now, item.who)] : []));
    if (joined.length > 0) {
      const names = new Intl.ListFormat(locale).format(joined);
      notices.show(t(joined.length === 1 ? 'newsJoinedOne' : 'newsJoinedMany', { names }));
    }
    for (const item of news) {
      if (item.kind === 'report') {
        const lines = reportLines(item.report, t);
        const report = [lines.incident, lines.casualties].filter(Boolean).join(' · ');
        notices.show(t('newsReport', { name: aliasOf(now, item.report.origin), report }), {
          action: {
            label: t('view'),
            run: () => {
              openPanel(REPORTS);
            },
          },
        });
      }
      if (item.kind === 'crossing') {
        const { origin, zone, kind } = item.crossing;
        const area = untrack(() => state.objects.get(eventRefKey(zone)));
        const said = t(kind === 'danger' ? 'newsZoneDanger' : 'newsZoneLeft', {
          name: aliasOf(now, origin),
          zone: namedAfter(area?.type === 'shape' ? area.label : '', t),
        });
        callAttention();
        notices.show(said, {
          action: {
            label: t('view'),
            run: () => {
              openPanel({ name: 'member', member: origin });
            },
          },
        });
      }
      if (item.kind === 'task') {
        const { origin, status, text } = item.task;
        const key = eventRefKey(item.task.task);
        const said = t(status === 'done' ? 'newsTaskDone' : 'newsTaskStarted', {
          name: aliasOf(now, origin),
          text,
        });
        notices.show(said, {
          action: {
            label: t('view'),
            run: () => {
              editTask(key);
            },
          },
        });
      }
    }
  });
</script>
