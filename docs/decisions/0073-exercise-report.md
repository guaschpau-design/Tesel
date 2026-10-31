# 0073. The report at the end of an exercise

- Status: Superseded by [0083](0083-help-on-one-page.md)
- Date: 2026-10-30

## Context

An exercise (ADR-0072) ended with a line in the chat and a card that said it was over. What the user had done, and what it had cost, had to be pieced together from the chat and the diary, and nothing said what to do better next time. A drill is only half done without its debrief.

## Decision

- When an exercise ends, the practice's card shows **how it went**: a few figures, then up to three things done well and four to do better, each in a plain sentence that says why.
- Each situation tells its own part (`Exercise.findings`): whether Rosa was found and by whom, and how the injured neighbour fared; homes warned, families cut off and who got them out, the underpass; houses emptied, the helicopter's landing site; teammates caught by water or fire. The worlds keep the tallies (`FloodHomes.tally`, `WildfireWorld.tally`, `MissingPersonWorld.finding`).
- The rest is the same everywhere and depends on the user's part (`debrief/debrief.ts`): how long the teammates' SOS calls waited for the user's acknowledgement; as a member, the tasks given to them that they marked done and the reports they sent; as the coordinator, when they first formed a team or gave a task, and how many teams, tasks and things on the map they made; and whether they wrote in the chat at all.
- The group's state says what was done but not when, so the run looks at it each second and whenever it changes, and notes the times (`UserLog`). An SOS that came in the last minute is left out.
- The report lives in the practice's card until the practice ends, and leaves the device no more than the practice does.

## Consequences

- An exercise ends with something to learn from, in a minute's reading, and repeating it shows whether the user did better.
- The thresholds (an SOS answered within a minute, a first order within three) are the practice's own, stated in the code beside the words that use them.
- A team drill (later) can give the same report to everyone who took part.
