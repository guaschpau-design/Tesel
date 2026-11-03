# 0107. Keep the relay fair, responsive and bounded under a flood

- Status: Accepted
- Date: 2026-11-03

## Context

An audit of the relay found that a few clients could still take the server from everyone else, each staying within every limit [ADR-0093](0093-gaps-an-audit-found.md) set:

- **Pushes.** One token bucket held the server's 500 pushes a second for everyone. Five addresses, each pushing its own 100 a second into groups of its own, emptied it, and every push of every other group was refused: in a simulation, an honest member got none of 31 pushes through in a minute. A push refused by a later bucket had already spent tokens of the earlier ones.
- **Backlogs.** A backlog went page after page with no turn of the event loop between pages whenever the system took the writes at once: 100 000 envelopes held every timer and every other client for some two seconds, a million for twenty.
- **Disk.** Nothing limited what one address or one new group stored: one address could store some 4 GB a day, kept for 30 days, until the disk margin refused every push of every group. There was no way to remove one group's junk.
- **Memory.** Each connection could leave at least 256 KB unread, so 10 000 connections could leave 2.5 GB in a container of 512 MB; 1 500 clients that stopped reading took the server from 160 to 480 MB in seconds.
- **Retention.** Each batch of the retention sweep scanned every group twice: some 150 ms with 200 000 groups, the server waiting meanwhile.
- **Durability.** With `synchronous = NORMAL`, a push could be answered `stored` before it reached the disk. After a power cut the envelope was gone, its client had let it go, and its cursor went to another envelope under the same store identity, breaking [ADR-0046](0046-store-identity.md).
- **Other messages.** Pings, malformed frames and repeated joins were answered without limit, and joins were limited only for groups the server did not know.
- **Proxies.** The server believed `X-Forwarded-For` from any private address by default, so a client reaching it directly from a private network could name any address and dodge every limit per address.

## Decision

- **Pushes are shared out fairly.** The server's capacity is still one bucket of 500 a second, but while it is less than half full a client address or a group that has pushed more than an equal share of it lately (500 divided by the addresses, or the groups, that pushed in the last seconds) waits; those below their share go on. Groups in their first day, counted from the first envelope the server still has of them, take at most half of the capacity between them, so groups with a history always keep the other half. A push is let through only once every limit agrees, and only then counted against any.
- **Stored bytes are limited.** One address may store 512 MB of database a day, and one group 256 MB in its first day (`TESEL_MB_PER_IP_PER_DAY`, `TESEL_MB_PER_GROUP_FIRST_DAY`); an envelope counts with the 250 bytes of keys and indexes stored beside it, and only when it is new. A member moving all day stores some 5 MB, so a busy operation behind one address stays far below; a flood is cut to an eighth of what it could store. Beyond them a push is answered `rate-limited`, which clients already try again later.
- **Backlogs take turns.** A backlog goes in pages of at most 250 envelopes, and no larger than what the client may still leave unread; the next page waits until the last has left the server's buffers, and at most four backlogs prepare a page in one turn of the event loop. One fast reader of 100 000 envelopes now holds timers up for some 20 ms at a time instead of two seconds, for a quarter more time to send it.
- **Joins and messages are limited.** An address may join as many groups at once as it may open connections (256), then 2 a second. A connection may send 10 messages a second, 100 at once (a client paces its pushes at 2 a second); beyond that it is closed with code 1008. A connection that sends more than 10 messages the server refuses, and one more a minute, is closed the same way.
- **Unread bytes have a cap.** All clients together may leave 96 MB unread (`TESEL_UNREAD_MB`), shared out equally among the connections, at most 1 MB each. As frames go out, at most once a second, the relay adds up what all have left, and closes those that left the most while the total is over the cap. The container's 512 MB hold Node with the site, the app and the database (some 150 MB), 10 000 connections at 11 KB each, and the cap with as much again for the buffers' bookkeeping. Each of 10 000 connections may then leave some 10 KB unread; the server refuses a `TESEL_MAX_CONNECTIONS` that would leave less than 8 KB each. The same flood of 1 500 stopped readers now takes the server from 160 to 250 MB.
- **The retention sweep looks only at the groups it touched**: the deletion returns their IDs, and only those are checked for envelopes left.
- **A push is on the disk before it is `stored`**: `synchronous = FULL`. Measured here, a push takes 250 µs instead of 85; on a disk that flushes in a millisecond, the 500 pushes a second of a server at its limit would wait half a second in each. That bound is the price of not giving the store a new identity after every unclean start, which a flag for a clean shutdown would need, and with it a resynchronisation of every client after any crash.
- **Only loopback is a trusted proxy by default.** A deployment behind a proxy names it in `TESEL_TRUSTED_PROXIES`, as the VPS does ([ADR-0108](0108-deployment-holds-against-floods.md)).

## Consequences

- No few addresses or groups can starve the others of pushes, and the server's capacity stays bounded. Many addresses together still share what there is; under such a flood each gets less.
- A client that pushes its whole outbox after a store change is counted only for the envelopes the server did not have.
- The limits are tuned to the VPS's container; a server given more memory raises `TESEL_UNREAD_MB` with `TESEL_MAX_CONNECTIONS`.
- Pushes cost a flush of the disk each. If that ever matters, committing several pushes together before answering them is the next step.
- The wire protocol is unchanged: every new refusal is a code or a close clients already handle (protocol §8).
