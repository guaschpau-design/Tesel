# 0068. Restore copies under a new identity, and go back across a change of schema

- Status: Accepted, amended by [0108](0108-deployment-holds-against-floods.md) (the room a copy leaves)
- Date: 2026-10-29

## Context

[ADR-0049](0049-signed-images-and-checked-updates.md) gave the VPS nightly copies of its database and a way back to the previous image, and said that restoring a backup changes the server's store identity. It did not: `VACUUM INTO` copies the `store_info` row, and the guide's restore steps kept it. A server restored from a backup told clients it was the same store, so they trusted cursors it had numbered again, and silently missed envelopes ([ADR-0046](0046-store-identity.md)).

Going back to an older image had a worse gap. A new image upgrades the database's schema when it starts, and an older one refuses a schema newer than it knows. So going back after a change of schema, whether at once because the new image was not healthy or later by hand, left a server that stopped on every start.

The backups also took a full copy of the database on the disk that holds it, without checking for room. And CI's rule that a newer run cancels an older one did not stop an older run whose tests finished later from tagging its image `latest` after a newer one.

## Decision

- One script, `deploy/vps/database.sh`, copies the database while the server runs (`VACUUM INTO`, then an integrity check) and restores a copy. Backups, updates and the operator's guide use it.
- **A restored copy always gets a new store identity**, given by the restore itself, so every copy can be restored as it is: those taken before this change, and one restored twice.
- **A copy needs room.** It is not made when the disk would keep less than the margin the server keeps for itself (`TESEL_MIN_FREE_DISK_MB`), and the backup or update that wanted it fails, which alerts the operator.
- **Before a new image starts, the database is copied**, and the copy and its schema version are kept for as long as the server may go back to the image that left it so. Going back, at once or with `update.sh rollback`, restores that copy if the schema has changed since; otherwise the database stays as it is.
- **CI tags an image `latest` only if its commit is still the newest on `main`.** An older run that gets there later leaves the tag where the newer one put it.

This amends [ADR-0049](0049-signed-images-and-checked-updates.md).

## Consequences

- A restore can no longer mislead clients: they see a new store and push again what they have, within the usual rate limits.
- Going back across a change of schema loses from the server what it stored since the update: minutes when a new image fails its health check, possibly days when an operator goes back by hand. Clients push their own events again; events whose only copy was on the server are lost.
- The disk holds one more copy of the database, kept for going back, and an update fails while there is no room for it.
- If the newest commit on `main` fails CI, `latest` stays on an older image until a newer commit passes.
