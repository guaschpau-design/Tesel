# 0044. Keep each author's events in order, and say when a clock is wrong

- Status: Accepted, amended by [0103](0103-rivals-full-storage-and-urgent-sync.md) (the previous time is kept to only within an hour of the clock)
- Date: 2026-10-27

## Context

ADR-0003 orders concurrent edits by `(time, origin, seq)` and says that wrong clocks only affect tie-breaking. The audit of 27 October 2026 found two cases where they do more:

- A device whose clock goes back (a manual change, a phone that loses its battery and starts in 1970 or 2000) stamps new events earlier than its own old ones. Its later edit of a marker or a task then loses to its earlier one, everywhere, for good.
- A device whose clock runs ahead wins every concurrent edit until the others catch up with it, and its positions look newer than they are.

It also found that a receiver stored any event whose header could be read, even a known type whose payload did not decode. Stored under its `(origin, seq)`, such a damaged copy hid the real event when it arrived later.

Ordering one author's events by `seq` inside `compareEvents` would break the order's transitivity once a third author's event falls between them, and with it the reducer's independence from arrival order. Hiding events stamped in the future would hide an SOS from a phone with a wrong clock, which is worse than any misordered marker.

## Decision

- **A device never stamps an event earlier than its previous one** (protocol §3.1): it keeps the time of its last event and uses it while its clock is behind. One author's events are then always in `seq` order under `(time, origin, seq)`, with no change to the order itself.
- **Events from the future are shown as they come.** No event is hidden or delayed because of its time.
- **The device is told when its clock is wrong.** The server says its time in `healthz` (protocol §8.1); when the device's clock differs from it by more than two minutes, a notice on the map says how far ahead or behind it is and asks to set it right.
- **Damaged events are dropped, not stored** (protocol §3.1): a known type that does not decode never takes the place of the real event.

ADR-0003's last consequence is corrected accordingly.

## Consequences

- A phone that went back in time by an hour or less keeps its own edits in order; others still see its events with the times it stamped, which may be in the past. One that went back further goes by its clock, since the time it kept to was more likely stamped by a clock that ran ahead and was set right: keeping to it held every later event at that wrong time ([ADR-0103](0103-rivals-full-storage-and-urgent-sync.md)).
- A phone whose clock runs ahead still wins concurrent edits until it is set right; with no server reachable, nothing tells it so.
- Older versions of the app may still hold damaged events; they are dropped only as new copies arrive, not cleaned up.
