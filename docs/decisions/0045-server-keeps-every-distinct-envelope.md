# 0045. The server keeps every distinct envelope pushed under a key

- Status: Accepted, amended by [0067](0067-envelope-nonce-from-the-event.md) (nonces derived from the event) and [0107](0107-relay-holds-against-floods.md) (what junk may store)
- Date: 2026-10-27

## Context

The server stored at most one envelope per group and event key, and answered a later push under a known key with `stored` without keeping it. The event key lets the server de-duplicate without learning who sent what, but nothing proves that whoever pushes an envelope under a key wrote the event behind it: the server cannot check it, and the group ID is enough to push. Anyone who knows or guesses a member's next key (its origin and next sequence number go into it) could push junk under it first. The member's real envelope was then answered `stored`, left its outbox, and was never kept or relayed: one push silenced one event, with nobody noticing.

## Decision

- The server stores at most one envelope per group, key and SHA-256 of the envelope bytes (protocol §8). A push identical to a stored envelope is answered `stored` and not relayed again, as before. A different envelope under a known key is stored and relayed like any other.
- Receivers open each envelope and keep it only if the event inside has the message's key (§5): junk under a member's key is dropped on the device, which can tell, instead of on the server, which cannot.
- Existing databases are upgraded in place: each stored envelope gets its digest, and the key stays in every row.

## Consequences

- Junk can no longer hide a genuine event. It costs storage and relaying instead, which the rate limits per connection, group and server bound.
- Pushing the same envelope again adds nothing: a command post that replicates it back, or a client that kept the sealed bytes.
- Deduplication now depends on one event always sealing to the same envelope. With the random nonce of §5.1, an event sealed again — a retry that seals anew, several bridges forwarding what they heard by radio, a client pushing its events again after a store change (ADR-0046) — is stored and relayed once per sealing. Receivers' event logs ignore the repeats, but storage and traffic grow; sealing deterministically (a nonce derived from the content key and the event) removes this and is the follow-up to this decision.
- Clients must check keys after decryption; until they do, junk under a key is only as harmful as any other undecryptable envelope, which they already discard.
