# 0122. Tell the coordinator of zones crossed, and tell those without Tesel where someone is

- Status: Accepted, amended by [0127](0127-pocket-mode-and-sos-outside.md) (telling outside Tesel moves to the SOS card, with 112 called)
- Date: 2026-11-08

## Context

Every segment Tesel serves well (civil protection, search and rescue, firefighting volunteers, event organisers, mountain clubs) has the same two gaps.

- **Zones crossed go unseen.** A member who walks into a danger area is warned on their own device (ADR-0033), but whoever coordinates only finds out by watching the map. Nobody notices a team that drifts out of its search sector until the sweep is wrong. ATAK and the commercial trackers have geofence alerts; Tesel had them for the member only.
- **The world outside the group has no Tesel.** The 112 operator, the organisers of an event and a family at home do not have the app. To tell them where someone is, a member reads the coordinates aloud, or copies them and pastes them into a message by hand, under stress. In Spain, SMS reaches 112 without mobile data, and an SMS with coordinates is what rescue services ask for.

## Decision

**Zone crossings** (protocol §3.18, `objects/zone-watch.ts`, `ZoneCrossings.svelte`):

- Each member's device watches two kinds of area:
  - the group's danger areas;
  - the areas of the tasks open or in progress for the member or their team (a task's shape, or the area a sweep strip sweeps).
- **Only a crossing that is borne out counts.** Fixes worse than 30 m are left out. A fix closer to the edge than its accuracy, or than 10 m, is on neither side. A new side needs a second fix on it at least 10 s after the first. A GPS that wanders across an edge sends nothing.
- **What is sent.** A new event type, `ZONE_CROSSING` (34 bytes, by radio too), says which area, entered or left, which kind of area, and where. The device sends only what differs from the last crossing the group has from it for that area, so reloading the app sends nothing again. It sends at most one per area per minute. An area never heard of is told only once entered.
- **Only while the member shares their position.** A crossing says where they are, so without sharing nothing leaves the device and ADR-0033 holds. The GPS is not turned on for this: the watch uses the fixes it already has.
- **Who is told:**
  - Whoever coordinates gets a notice, and the screen wakes, for a danger area entered and for the area of a task left. "View" opens the member.
  - The member is told at once, on their own device, that they left the area of their task, whatever they share.
  - Entering and leaving go to the diary and the debrief, with where it happened.

**Telling those without Tesel** (`incidents/tell-outside.ts`, `TellOutside.svelte`):

- "Tell someone outside Tesel" sits under this device's position in Me, and on every SOS card whose place is known.
- **The text** says whose position or call it is and when, the coordinates in decimal degrees with their accuracy and in UTM, and a map link any phone opens.
- **How it goes:** by SMS (`sms:?&body=`, which Android and iOS both read), by WhatsApp, through the phone's share sheet where there is one, or copied. Nothing is sent until the member sends it from the app that opens.

## Consequences

- A coordinator learns of danger and of teams out of their sector without watching the map, over LoRa as over the internet.
- Members who do not share their position give whoever coordinates no zone notices. That is the price of not tracking them.
- A crossing is only as good as the GPS. Within an area's first 10 m, or within the fix's accuracy, nothing is decided, and a short visit to an area may never count. A device standing still that reports no new fix is not counted until it reports a second.
- The diary has two new kinds of line, and the radio carries one more small event per crossing.
- The map link goes to Google Maps, which every phone opens. Opening the link is up to whoever receives it. Tesel sends nothing there.
- Amends ADR-0033: the danger area warning stays local, and what reaches the group is now decided here.
