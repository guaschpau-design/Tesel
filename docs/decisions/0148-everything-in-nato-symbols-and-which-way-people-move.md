# 0148. Everything on the tactical map in NATO symbols, and which way people move

- Status: Accepted, amended by [0150](0150-how-fast-and-which-way.md) (the arrow tells the speed; this device follows the GPS while it moves)
- Date: 2026-11-19

## Context

ADR-0146 drew markers and members in APP-6 on the tactical map, but the rest kept the app's own look: the public services as round icons, tasks as dots, field reports as their own pins, this device as its lime dot, and the base map's own points of interest. Pau saw a mix of NATO symbols and others, and asked what to do with it. He also asked to see which way the team moves: on a military map, the direction of a unit matters as much as where it is. A sketch of each symbol came first; Pau approved it.

## Decision

On the tactical map, and only there:

- **The base map's points of interest** are not drawn: the public services that matter (ADR-0141) are drawn by the app, in APP-6.
- **Public services** are civil installations: a neutral green square with an installation's bar and their pictogram, the health centre's cross in red; a helipad is a landing zone, "LZ", as the marker is.
- **Tasks** are objectives: a box marked "OBJ" pointing at the task's place, filled light green once someone works on it.
- **Field reports** are drawn as the marker of their incident: a fire as the fire marker, a missing person as the missing one, an accident, collapse or hazardous materials as a hazard, an injured person or a rescue as the injured one.
- **This device** is its own frame with "TÚ" ("YOU") edged in yellow, so it stands out among the team's frames.
- **Calls for help** keep their own look: they must be seen first, on every map.
- **Which way people move**: an arrow out of the top of a member's symbol, turned the way their GPS says they move. Each position a member sends already carries its heading (protocol §3.4), known only while moving; it is drawn only while their position is fresh, so a member who has stopped, or not been heard from, shows none.
- **Which way this device points**: the phone's compass turns this device's own arrow, read only here and never sent: it changes without moving, and is right only with the phone held flat. Without a compass, or before the iPhone allows it (asked from the tap that chooses the tactical map), the arrow follows the GPS's heading while moving. The compass is listened to only while the tactical map is shown.

## Consequences

- Every point on the tactical map reads the same way, by frame and mark, and a glance shows which way the team moves.
- Nothing sent changes: other members see the same things in the app's own look on other maps.
- A member's arrow is as recent as their last position: between reports it does not turn.
- On a phone whose compass is badly calibrated, this device's arrow can be off; the GPS's heading, once moving, is not.
- The simulator's walking members now send which way and how fast they walk, as a phone's GPS does (`motionAt` in `@tesel/scenario`), so a demonstration shows their arrows.
