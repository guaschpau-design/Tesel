# 0092. Moves, not the GPS wandering

- Status: Accepted
- Date: 2026-11-01

## Context

A tablet left on a table indoors drew a tangle of lines around itself: its trail, which the whole group sees. Indoors a fix is off by 20 to 50 m and jumps every few seconds. The app published a new position after any change of 10 m (`report-policy.ts`), and drew every published position into the trail; it also published the latest fix every minute as a heartbeat, wherever it fell. Sweeps measured the ground a member covered from the same raw trail, so the wandering could also mark a strip as searched.

## Decision

- **A move is a change beyond both fixes' uncertainty.** Two fixes of a device standing still can lie as far apart as their two accuracy radii together, so a change counts as a move only when it is larger than that sum, and never under 10 m (`position/movement.ts`, one rule for all of what follows).
- **Publishing.** The device publishes a fix when it is the first, a move from the place last published, or at least twice as sure (the GPS has settled, or the device went out under the sky); still never more than every 5 seconds. Otherwise, after a minute, the heartbeat publishes the place last published again, with its accuracy, so a device standing still stays put on everyone's map and its trail does not grow.
- **Drawing and sweeping.** A trail is drawn, and a strip measured as swept, from where the member travelled (`travelled`): positions of poor accuracy (worse than 30 m) are left out, and each position kept is a move from the last one kept. This applies to every member's trail, those published by older versions of the app and those already stored, and every device draws the same from the same events.
- The live position on the map is untouched: the latest one, with its accuracy circle. Nothing changes in the protocol, the radio or what is stored.

## Consequences

- A device indoors shows as a point with its circle, not a tangle; outdoors with a good fix, the trail is the way walked.
- With a poor fix, a member walking slowly appears to move in steps of 20 or 30 m rather than smoothly: where someone is matters more than a line that invents moves.
