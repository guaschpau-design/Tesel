# 0046. A server's store has an identity, and cursors belong to it

- Status: Accepted, amended by [0107](0107-relay-holds-against-floods.md) (`stored` once on the disk)
- Date: 2026-10-27

## Context

Clients and command posts remember, per relay, the cursor of the last envelope they received, and ask for what comes after it. Cursors only make sense within one database. A server that loses its database, or is restored from an older backup, counts again from where that database was: new envelopes get cursors that clients believe they have already seen, and they silently miss them. A cursor beyond the server's last one is noticed (protocol §8), but only until the server has numbered that many envelopes again.

## Decision

- Each database has a **store identity**: 16 random bytes, created with the database and kept in it. `synced` carries it as `store` (protocol §8).
- A client keeps the identity with its cursor for each relay. When a relay answers with another identity, the client resets its cursor for that relay to 0, joins again and pushes its own events again; an envelope the server already has is not stored twice (ADR-0045).
- A command post does the same with its upstream: it resets its cursor for the group, joins again, and pushes again every envelope it holds for the group, since it may hold the only copy of what the upstream lost.
- The server forgets a group once all its envelopes have expired, but never reuses its cursors: a forgotten group seen again counts on from above the highest cursor any forgotten group had.
- Whoever restores a backup gives the restored database a new identity before starting the server (`UPDATE store_info SET id = randomblob(16)`), since the backup carries the old one.

## Consequences

- Losing the database costs history kept nowhere else, never silently skipped envelopes: every client notices at its next sync and fills the server back with what it has.
- After a loss, each client downloads what the server still has and pushes its own events again: a burst of traffic once, within the usual rate limits.
- Restoring a backup without a new identity would still mislead clients; the operator's guide must say so.
