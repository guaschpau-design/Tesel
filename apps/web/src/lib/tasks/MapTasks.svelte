<!-- The tasks on the map, and a notice when someone hands one to this device, which opens it. -->
<script lang="ts">
  import type { GroupState } from '@tesel/core';
  import { eventRefKey, type NodeId } from '@tesel/protocol';
  import type { Map as MapLibreMap } from 'maplibre-gl';
  import { untrack } from 'svelte';

  import type { Translate } from '../i18n/index.ts';
  import { aliasOf, nameOf } from '../members/alias.ts';
  import type { MapTaps } from '../map/taps.ts';
  import { notices } from '../ui/notices.svelte.ts';
  import { editTask } from './task-editor.ts';
  import TaskLayer from './TaskLayer.svelte';
  import { assignedTo, newlyAssigned } from './tasks.ts';

  interface Props {
    t: Translate;
    map: MapLibreMap;
    taps: MapTaps;
    tasks: GroupState['tasks'];
    objects: GroupState['objects'];
    members: GroupState['members'];
    teams: GroupState['teams'];
    self: NodeId;
    visible: boolean;
  }

  let { t, map, taps, tasks, objects, members, teams, self, visible }: Props = $props();

  const mine = $derived(assignedTo({ tasks, teams }, self));
  // What was already assigned when the group opened is not news.
  let known = untrack(() => mine);

  $effect(() => {
    const now = mine;
    const [handed] = newlyAssigned(known, now, self);
    known = now;
    if (handed === undefined) return;
    const name = aliasOf({ members }, handed.origin);
    const { assignee, text } = handed;
    const key = eventRefKey(handed.task);
    notices.show(
      assignee === self || assignee === null
        ? t('taskHandedToYou', { name, text })
        : t('taskHandedToTeam', { name, team: nameOf({ members, teams }, assignee), text }),
      {
        action: {
          label: t('view'),
          run: () => {
            editTask(key);
          },
        },
      },
    );
  });
</script>

<TaskLayer {map} {taps} {tasks} {objects} {visible} onselect={editTask} />
