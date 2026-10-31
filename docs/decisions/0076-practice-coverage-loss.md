# 0076. Losing coverage in a practice

- Status: Superseded by [0083](0083-help-on-one-page.md)
- Date: 2026-10-30

## Context

Tesel exists for the moment the mobile network fails: LoRa radios keep a group in touch when nothing else does (ADR-0006, ADR-0069). Until now every practice ran with perfect coverage, so it never taught why the radios matter, who should carry them, or what happens to an order sent to someone who cannot hear it.

## Decision

- Each exercise has its **outages** (`Exercise.outages`): an area where the network fails from one moment to another, or, at the race, where it is so busy that everything comes late. The control room draws the area on the map when it fails and says why (the masts lost power in the flood, the fire damaged the hill's mast, a valley without signal, a sector with hardly any), and says when coverage is back.
- Inside an area without coverage, whoever carries a LoRa radio goes **on the radio**: what they send arrives a packet at a time, positions every two minutes, as the app's own radio scheduler sends them, and the members list shows that their news comes by radio. Whoever has no radio is **cut off**: nothing of theirs goes out until they have coverage again, when all of it arrives at once; and they hear nothing new from the group, unless someone on the radio is beside them to pass it on. A busy network delays everything by half a minute or so (`Coverage`, `Airwaves`).
- The teammates act on it as people would: someone cut off does not take a task given meanwhile, does not answer, and does not hear of an SOS; someone who goes on the radio says so; someone back says so too. Jordi lost in the fog without coverage cannot tell anyone: the group misses him.
- The practice group's feed records how each simulated event came, by the network or by radio (`receiveSimulated` takes the channel), as it does for real ones.
- When the exercise ends, whatever was still on its way arrives.
- The report says how many were cut off and for how long, and how many of the user's tasks went to someone who could not hear them, and how long they waited; or, when every order during an outage reached someone, says so.

## Consequences

- A practice now shows the difference a radio makes: whom the coordinator can still reach, and why radios are spread across the teams.
- The rules are simple on purpose: an area, a time, a radio or not. Signal does not fade with distance or terrain, and radios always reach the user.
