# 0031. Practice mode: a simulated group played on the device

- Status: Superseded by [0083](0083-help-on-one-page.md)
- Date: 2026-10-26

## Context

Volunteers learn the app during an emergency, or at a drill that needs the whole team together. Alone, a new user sees an empty map: no members, no chat, no SOS to acknowledge. The simulator (`tools/simulator`) already plays staged operations, but through a server and from a computer.

## Decision

- "Practise with a simulated group", in the groups panel, creates a practice group and makes it active: an ordinary group, created by this device as coordinator, with no server, marked `practice` on the device only.
- A practice run plays a scenario around this device (or the middle of the map): four teammates who announce themselves, walk, mark a meeting point and a blocked path, draw a sector, talk in the chat, and one of them calls an SOS that another acknowledges and that is later cancelled. Each teammate has an identity of its own and its events are real, encoded events, applied to the group like any other; texts are in the app's language.
- The teammates answer the user: each acknowledges a roll call, a few seconds apart, and one acknowledges the user's SOS and says they are on the way.
- Nothing leaves the device: the group has no server, the radio is not linked to it, and it cannot be invited to.
- A practice lasts while the app is open. "End practice" (on the map card and in the groups panel) forgets the group and goes back to the group that was active; one left when the app closed is forgotten when it opens.
- The scenario model and its plan move from the simulator to `packages/scenario`, shared by the simulator and the app; each keeps its own scenarios.

## Consequences

- The whole interface can be learned alone, with the same screens as a real operation.
- No protocol change and no server work: a practice is a group like any other, which nobody else has.
- A practice is not resumed after the app closes, which keeps the run free of saved progress.
- Teammates answer only roll calls and SOS calls; tasks given to them stay as the user leaves them.
