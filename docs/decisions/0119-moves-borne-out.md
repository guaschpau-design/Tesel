# 0119. A move counts once what follows bears it out

- Status: Accepted
- Date: 2026-11-07

## Context

ADR-0092 took a change of position for a move when it was larger than both fixes' accuracy radii. On 7 November two phones left still indoors still drew a tangle of lines some 60 m across around themselves (screenshot from an iPhone, group «Cuates»). Indoors a phone reports its fix as good to 10 or 20 m while it jumps 30 to 50 m between Wi-Fi, cell and weak GPS solutions, so the jumps were larger than the radii it claimed and passed as moves, both when publishing and when drawing the trail.

The speed a browser reports cannot settle it: some phones give a speed with fixes that jump, others none while walking. A simulation (fixes every 2 s for an hour; a phone indoors whose fix jumps among a few places, or drifts and sticks to wrong places; walks at 1 fix a second and at 1 a minute; a car) compared the rules: by distance alone, an hour indoors drew 3.5 to 20 km of lines.

## Decision

- **A change beyond the fixes' uncertainty is only a candidate.** It becomes a move when what follows bears it out (`confirmMove` in `position/movement.ts`): a later place is a move from the candidate too and further from where the device was, so the device went on the same way; or the device stayed on the candidate's side, away from where it was, for 60 s. As soon as a later place is back within reach of where the device was, or nearer it than the candidate, the change was the GPS wandering.
- **Publishing** (`ReportPolicy`, `position/report-policy.ts`) publishes a move once it is borne out, then the newest fix; jumps that come back or go another way are never published, and the heartbeat goes on publishing the place last published. A sharper fix of the same place is still published, at most every 5 s.
- **Drawing and sweeping** (`travelled`) apply the same rule to the positions of every trail, so trails already stored, and those published by older versions of the app, are cleaned too. A trail's newest position waits until the next one bears it out; the member's live position on the map is the newest, as before.
- 60 s is the balance found: longer holds hide more of the walk of a device in energy saving, which fixes once a minute (ADR-0097); shorter ones let through more wrong places where a phone's fix sticks for a while.

## Consequences

- In the simulation, an hour indoors draws 0 to 300 m when the fix jumps among places, and about a quarter of what it drew before when it sticks to wrong places for a minute or more; such a stay cannot be told from walking there and standing still. Walks are drawn closer to their real length than before, as noise no longer adds zigzags.
- A trail ends a little behind the member: one position, a few seconds and some metres when walking, a minute when the device has just stopped or saves energy. The live position is not delayed.
- A short walk out and back, which returns before the next fix bears it out, is not drawn.
- ADR-0092's rule of accuracy stays: it decides which changes are candidates, and poor fixes are still left out.
