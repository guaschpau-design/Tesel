# 0052. Members are trusted: protocol version 1 does not prove who wrote an event

- Status: Accepted, amended by [0099](0099-sealed-radio-frames.md) (LoRa keeps 153 of its 165 bytes for content)
- Date: 2026-10-28

## Context

ADR-0005 makes the group secret the trust boundary: anyone who holds it is a full member, and a member can write events under another member's node ID, alias or role. Each device generates an Ed25519 key, but nothing is signed with it. The audit of 27 October 2026 asked for this to be decided before the protocol is frozen with v0.1.0, since adding signatures later changes the event layout.

What signatures would cost:

- An Ed25519 signature is 64 bytes. An event is at most 165 bytes, so a signed event has 87 bytes left for its header and payload: chat lines, tasks and SOS texts would lose more than half their room, on the link that has least of it.
- Signing only internet envelopes would leave radio-only members, the case Tesel exists for, unable to check anything, and bridges would have to carry signatures they cannot use.
- A signature is worth only as much as the knowledge of whose key it is. Members meet in the field, often for one operation; there is no directory and no account. The 4-byte node ID that names a member is far too short to serve as a key fingerprint: it can be matched by generating keys for minutes on a laptop.

What the threat is: the people who hold a group's secret are a team that chose to work together, invited by one another. A member who wants to mislead the group can already do so under their own name, by sending false positions or false alerts. Impersonation adds deniability, not a new power.

## Decision

- Protocol version 1 does not sign events and does not prove authorship. Every member of a group is trusted as the group itself is.
- The interface never presents an alias, a role or an author as verified: it shows who an event says it is from, and nothing in the app claims more.
- Roles stay advisory (ADR-0005): a coordinator's powers are a convention of the interface, not a permission any device enforces.
- The way out of a group with a member who abuses it is the one there is for a leaked secret: a coordinator creates a new group and invites those who should be in it.
- Proving authorship is left to a later protocol version, with its own ADR. It would need a key that members can verify in person (a fingerprint of at least 16 bytes, shown as words or a QR code), and a way to carry signatures that does not take them from LoRa's payload, for instance signatures over the internet link and on log files only.

## Consequences

- The protocol keeps all of LoRa's 165 bytes for content.
- A member can write as another member, and the others cannot tell. ARCHITECTURE.md §8 says so, and so does the guide's advice on sharing invitations.
- Removing a member means a new group, which costs every member a new invitation.
- The device key generated today is kept: a later version can start signing with it without a new identity.
