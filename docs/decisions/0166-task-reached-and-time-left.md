# 0166. Tell whoever coordinates when a task's place is reached, and how much is left

- Status: Accepted
- Date: 2026-11-23

## Context

Whoever coordinates hands out tasks with a place: a point, a marker, an area, a route or a strip of a sweep. Until now they were told when a member started or finished a task (ADR-0025), or left its area (ADR-0122), and nothing in between. They asked two questions:

- How long does a member still need to complete their route?
- Can they be told when the member gets there?

The notices were in the app only, so they also missed them with the app in the background.

Positions alone would answer late over LoRa. A device sends its own position at most every 2 minutes, and only after moving 50 m or 10 minutes, so a member who stops at the place may not be heard there for 10 minutes. The member's own device sees every fix.

## Decision

**The member's device tells the group when they reach the place of a task of theirs** (protocol §3.19, `tasks/task-reach.ts`, `TaskReaches.svelte`):

- A new event type, `TASK_REACHED` (32 bytes, by radio too), names the task and says where the member was.
- **Where a task is reached:**
  - a point or a marker: within 15 m of it, or within the fix's accuracy;
  - an area or a circle: inside it, clear of its edge;
  - a route or a strip: at the end of its way, followed leg by leg as guidance follows a route (ADR-0059). A loop is reached once walked, not at its start.
- **It is borne out as a zone crossing is.** Fixes worse than 30 m are left out, and a second fix still there at least 10 s after the first is needed.
- **Only while the member shares their position**, as the event says where they are.
- **A team's task is reached once.** No device sends one for a task that its member, or someone in their team, has been seen to reach.
- **A route can be taken up anywhere.** Guidance still leads to a route's start first; reckoning how far along someone is takes the route up at whichever leg they are near (`RouteTracker`'s `'anywhere'`).

**Whoever coordinates is told** (`groups/GroupNews.svelte`): «Berta ha llegado al lugar de «…»», or «al final del recorrido» for a way. The screen wakes, as for a zone crossed, and «Ver» opens the member. The diary keeps the arrival, with where it happened.

**The member's card says how far they are with each of their tasks** (`tasks/task-left.ts`, `TaskProgress.svelte`), reckoned on any device from the positions the group has of them:

- once reached: when it was reached, and by whom in their team;
- for a point or an area: how far it is in a straight line;
- for a route or a strip: how much of its way is left. This is reckoned from their positions since the task was handed to them where it is now, and from where they were then.
- **How long it takes:**
  - on foot, with the climb of the way left once its elevations are read (ADR-0156), or as on the flat where they cannot be read;
  - faster than 4 m/s, at their speed.

**What whoever coordinates is told is also a phone notification while the app is not on screen**, if notifications are on in More:

- `ui/system-notifications.ts` now shows every system notification, the SOS's included.
- An SOS's stays until tapped, and in the Android app sounds as an alarm.
- News shows as any other app's, on a new Android channel, «Novedades del grupo».

## Consequences

- Whoever coordinates learns of arrivals as soon as a borne-out fix allows, by radio as by internet, without watching the map.
- Members who do not share their position send no arrival, and their card shows nothing to reckon from.
- Entering the area of a task sends both a crossing and an arrival: one more small event over the radio, once per task.
- Moving a task's place does not ask for a new arrival from someone who reached it already. A new task does.
- The card's time is an estimate from the last position the group has. Over LoRa it can be minutes old, and the card shows how old under «Posición».
- A phone notification reaches only an app that is still running. The Android app keeps running while it shares the position or has a radio linked (ADR-0125); otherwise, and in a browser tab the system has stopped, the news waits until the app is opened.
- Amends ADR-0122: whoever coordinates is now told of arrivals too.
