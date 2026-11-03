# 0103. Rivals under one event reference, a full storage, and an SOS that does not wait

- Status: Accepted, amended by [0111](0111-airtime-kept-numbers-per-group.md) (numbers are kept, and skipped, per group)
- Date: 2026-11-02

## Context

An audit of the event log and its synchronisation found four ways in which an SOS could be kept from the group.

- **A number taken first.** A device kept the first event it received under an `(origin, seq)` and dropped any other as a copy. Nothing proves who wrote an event (ADR-0052), and a member's next sequence number is easy to guess: it goes up by one. A member could send a harmless chat line under another member's next number; when that member then called for help with it, every device that held the chat line dropped the SOS as a duplicate. Two devices that received the two versions in opposite orders kept different ones for good. The server keeps both envelopes (ADR-0045), so the device is where this is decided.
- **One wrong time held every later one.** A device never stamped an event earlier than its previous one (ADR-0044). After a phone started with its clock years ahead, every later event kept that date even once the clock was set right, and won every edit against members with right clocks.
- **A full storage.** Received events reached the screen only once stored, so with the storage full an SOS that arrived never raised the alarm. An own SOS could not be created, since creating an event stores it first. A backlog batch that could not be stored dropped the link before `synced`, so the outbox, an own SOS in it, never reached the server, and the connection looped.
- **A backlog ahead of an SOS.** The client pushed nothing until the whole backlog was in, and took the backlog in faster than it could store it, keeping what waited in memory without limit.

## Decision

**Rivals.** Different events under one `(origin, seq)` are rivals (protocol §3.1). Of the rivals it has received, a device keeps every SOS, cancellation and acknowledgement, and if there is none among them, the one whose bytes come first; it drops the rest.

- Every device that received the same rivals keeps the same ones, whatever order they came in: the rule looks only at the set. The log keeps the versions of one reference together (`rivals` in a log entry), the reducer orders rivals with equal `(time, origin, seq)` by their bytes, the SOS slice keeps every call under a reference, and a device that has to give up events it had applied for a rival that wins makes its picture again from the log.
- A forged event never hides an SOS, its cancellation or an acknowledgement. Choosing one of them by their bytes would not do: whoever forges one picks its bytes, and can make it come first. Keeping all of them costs little, since nobody can tell the genuine one and the forger could as well send a false SOS under its own name, and no more storage than any other event the forger sends under a number of its own. So a forged SOS is shown beside the real one, under the same reference, and a cancellation or acknowledgement of that reference applies to both. An acknowledgement counts whatever it answers: whether its target is an SOS may not be known where this is decided, and the app acknowledges nothing else (ADR-0070).
- An ordinary event can be squatted: its owner's version may lose to a forged one with bytes that come first. The group is told instead. A notice says that someone sends messages under that member's name, once for each member, and the radio, the outbox and the push queue carry every rival kept, so the server and members who hear only the radio get the real SOS too.
- A device that receives an event under its own name with a number it has not used yet skips past that number, so its next events, an SOS above all, do not meet the forged ones, and tells its user once.

**Time.** A device keeps to its previous event's time only while its clock is behind it by an hour or less. A previous time further ahead was stamped by a clock that ran ahead and has been set right; the device goes by its clock again.

**A full storage.** A write of the log refused for lack of room first frees the map tiles kept for having been seen (ADR-0056) and is tried once more. If there is still no room, SOS calls, their cancellations and acknowledgements are held in memory by the log: they reach the picture and the alarm, are read with the log and the outbox, go to the server and the radio, and are stored as soon as there is room, tried again every ten seconds. An own SOS, cancellation or acknowledgement is created and sent even if it cannot be stored, its number and time kept from use while the app runs. A backlog batch that cannot be stored no longer drops the link: the link takes no more envelopes, so the cursor stays behind the batch, reaches `synced` without saving a cursor, pushes the outbox, and joins again after the usual wait to read the rest.

**An SOS first.** An own SOS, its cancellation or an acknowledgement is pushed as soon as the device has joined, before the backlog is in; the server takes pushes from then on. While more than four batches of the backlog wait to be stored, the client takes no more envelopes and joins again once they are stored, from the cursor stored with them: a browser's WebSocket cannot be asked to read more slowly, and what it is sent meanwhile is read again rather than kept.

## Consequences

- Protocol §3.1 and §8 state the rule on rivals, on skipping numbers taken under one's name, on an author's times and on pushing urgent events first. Version 1 is not frozen yet, so this changes in place; an implementation that keeps the first copy of a reference does not see the same picture as one that follows the rule when someone forges events.
- A member can still squat a chat line, a marker or a task of another, and win by its bytes; members see the notice, but not which version is genuine. A forged cancellation can still close an SOS, as any member may cancel one (§3.8); it shows who cancelled it, under the name the forger chose. Proving authorship remains for a later protocol version (ADR-0052).
- A device that did not receive the forged event before writing under the same number still writes under it; its SOS then stands beside the forged one rather than being lost.
- An SOS held in memory and lost with the app before there was room to store it was sent all the same, but its number may be used again after a restart. The device then receives its own SOS back as someone else's under its name, skips past it, and tells its user someone writes as them.
- A phone whose clock goes back by more than an hour stamps its events with that clock, and its later edit of a marker can lose to its earlier one; the clock notice of ADR-0044 tells it to set the clock right when a server is reachable. ADR-0044 is amended.
- A device whose storage stays full reads its backlog again at every try, as it did before; the difference is that its own events reach the server meanwhile.
