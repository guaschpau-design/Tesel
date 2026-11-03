# 0104. Keep the radio and SOS calls going across drops and group changes

- Status: Accepted, amended by [0111](0111-airtime-kept-numbers-per-group.md) (an own SOS is answered only in its own group)
- Date: 2026-11-02

## Context

An audit of the radio's reconnection path and of the SOS alarm found four ways a call for help could go unheard:

- The group was linked to the radio again only when the link came back after having been linked. A command that timed out while linking (the radio busy) made the link drop and come back by itself, but then nothing linked it: the radio said ready and carried nothing, for good. The pause before reopening went back to 1 s on every open, so a radio that opened and then stopped answering was opened every few seconds forever, and an open could hang without end on a Bluetooth step with no time limit.
- On MeshCore, a read of the radio's messages cut by a drop kept the next connection's read from starting, and the request for it was then lost: a datagram waiting in the radio, an SOS, stayed there until later traffic.
- Opening another group forgot everything queued for the radio, own SOS calls included, so an SOS no one had answered stopped repeating ([ADR-0043](0043-radio-delivery.md) says it repeats until answered). The group left also closes its server connection, so an SOS still in its outbox waits until that group is opened again.
- The alarm sounded only for calls that arrived while their group was open, and took all that was there when the group opened as old: an SOS heard by radio for another of this device's groups, or while the active group was being opened again, never sounded.

## Decision

- **The group is linked each time the radio is ready.** After a drop, after a failed link, on the first connection alike. A link that fails for any reason but a radio with every channel in use is tried again by itself, after 1 s doubling to 30 s (`radio/relinker.ts`). The reconnection pause starts short again only once a link has stayed up a minute, and opening a radio over Bluetooth has two minutes in all, PIN included (`openOn` in `packages/radio`).
- **Each MeshCore connection has its own drain**, and a drain asked for while one fails runs after it.
- **An own SOS still open outlives a change of group.** The scheduler keeps it when the radio changes group, and it keeps repeating, sealed with its group's keys, on its group's channel, which the radio still holds: `RadioLink.send` takes the secret of the channel to send on. Acknowledgements and cancellations heard on that channel end it, and leaving the group drops it. Its group's server connection is not kept open: that is the group feed's, and keeping several feeds open is a larger change. So before the user opens another group while an own SOS is open, the app warns that the call will go only by radio until its group is opened again.
- **Each call sounds once, whatever group it is in.** The calls the alarm was raised for are kept on the device by group (`incidents/alarmed-sos.ts`), instead of taking what was there when the group opened as old: a call that arrived while its group was closed sounds when it opens, and a reload sounds nothing again. An SOS heard by radio for a group that is not open sounds at once, with the group's name and a notice that opens the group; a cancellation heard first keeps a late copy of its call silent.

## Consequences

- Amends [ADR-0043](0043-radio-delivery.md) (the scheduler no longer forgets own open SOS calls when the group changes; the reconnection pause) and [ADR-0047](0047-alarms-and-notices.md) (calls of groups not open raise the alarm too).
- The first start after this change sounds once for every call still open in the group opened, as none has been recorded yet.
- An SOS of a group left open still waits for that group to be opened again to reach its server; only the radio carries it meanwhile, and only with a radio that holds the group's channel.
- A call heard for a group not open is known only by the event heard: its caller's name and whether it was cancelled through the server show once the group is opened.
