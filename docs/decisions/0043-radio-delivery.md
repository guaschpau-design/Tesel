# 0043. Deliver over the radio until someone has it

- Status: Accepted, amended by [0104](0104-sos-across-drops-and-groups.md) (own SOS calls outlive a change of group; the reconnection pause)
- Date: 2026-10-27

## Context

The audit of 27 October 2026 found that the LoRa path (ADR-0015) could lose exactly the events it exists for:

- An own event sent while no radio was linked never went on the air once one was: the outbox was only offered to the server.
- An own SOS stopped repeating after a fixed number of tries, and stopped altogether when the device heard its own SOS bridged back by another member.
- A bridge dropped every server event older than 10 minutes, including an SOS still open, its cancellation, alerts and roll calls: a member who came within range later never heard them.
- The acknowledgement of an SOS or a roll-call answer queued behind chat and objects.
- A Bluetooth link that dropped stayed down until the user reconnected by hand, unnoticed in a pocket.
- A radio holds several channels, but frames heard on another group's channel were thrown away, and a group left kept its channel in the radio.
- An SOS waited for a location fix, which indoors or in a ravine may never come.
- The queue had no bound, and nothing told the user whether an event had reached anyone.

## Decision

- **The outbox includes the air.** When a radio links to a group, the feed offers the member's info, any own SOS still open and every own event in the outbox that has not yet gone on the air. An event sent by radio is marked `aired`, so it is not offered again; it stays in the outbox until a server stores it. A group with no server has nowhere else to deliver, so for it the radio send is the delivery.
- **An own SOS repeats until it is answered.** The repeats back off from 30 s to every 5 minutes (under 1 % of the airtime) and stop only on an acknowledgement or a cancellation. Hearing the SOS from another device does not stop them.
- **News stays news.** A bridge still drops server events older than 10 minutes, except those that call for action whenever they arrive: an SOS not cancelled, an SOS cancellation, alerts and roll calls.
- **Answers are as urgent as what they answer.** An `ACK` of an SOS, a critical alert or a roll call is sent with that event's urgency and may use the full 10 % budget.
- **The queue is bounded.** At most 500 packets wait; beyond that the least urgent go, bridged before own.
- **The link comes back by itself.** A Bluetooth link lost while in use is opened again with back-off (1 s, doubling to 30 s) on the device the user chose, and the group's channel is configured again. Meanwhile the map says the radio is reconnecting, and the screen stays on while a radio is linked.
- **Every channel the radio holds is listened to.** A frame heard on another of this device's groups goes to that group's log, as if from its server, for when the group is opened. A frame that cannot be stored is retried a few times, never without bound.
- **Leaving a group frees its channel**, at once if a radio is linked and otherwise the next time one is. Only the group's id is kept for that, never its secret.
- **An SOS never waits for a location.** Without a fix, the SOS goes at once with no place (0, 0 with unknown accuracy, protocol §3.8), and the member's position follows as soon as there is one. Others see that the place is not known yet.
- **The user sees what is still on its way.** Own chat messages and SOS calls not yet stored by a server or sent on the air are marked as such.

This amends ADR-0015: its fixed number of SOS repeats and its 10-minute bridging limit for every event are replaced by the rules above.

## Consequences

- A device that was out of range and out of coverage delivers what it wrote as soon as either link is back.
- An unanswered SOS keeps using a little airtime for as long as it is open. Cancelling it is the way to stop it.
- An old event of a group with a server may be both bridged and pushed later, and arrive twice; logs ignore repeats by their key.
- The scheduler keeps a few more sets in memory (cancelled SOS calls, urgent targets); they are cleared when the group changes.
