# 0108. Keep the VPS's disk, settings and proxy safe from what the relay faces

- Status: Accepted
- Date: 2026-11-03

## Context

The same audit as [ADR-0107](0107-relay-holds-against-floods.md) looked at the deployment on a VPS:

- A database copy, for a backup or before an update, needed only the database's size and the server's own margin (`TESEL_MIN_FREE_DISK_MB`, 500 MB): a backup could bring the disk to the very point where the server refuses every push. Expired backups were deleted only after the new one, and 14 daily copies and 2 for going back kept some 16 times the database on the server's own disk, even when copies also went off the host.
- `database.sh` made its staging folder next to the file it was given, and re-moded that file's folder: restoring from `/tmp/x.db` left `/tmp` at 0700, without its sticky bit.
- The server's container received the whole `.env`, `TESEL_ALERT_URL` and whatever else an operator kept there among them, though it faces the internet.
- With the server now believing only loopback as a proxy, the VPS must name Caddy.
- An operator had no way to remove one group's junk without waiting for it to expire.

## Decision

- **A copy leaves room.** `database.sh copy` needs the database's size and twice the server's margin, so after a copy the server still has as much room again before it refuses pushes. Expired backups are deleted before the night's copy. With off-host copies configured (restic), only the night's copies stay on the server after they have gone off it; the repository keeps `TESEL_BACKUP_DAYS` of them.
- **Staging lives in the install folder**, made with `mktemp -d` there; no folder of the given file is created or changed, and the copy is moved into place.
- **The server gets only its own settings**, listed one by one in `compose.yaml`; one not set in `.env` reaches it empty, which it takes as its default, so every existing setting keeps working. The image's own `TESEL_HOST`, `TESEL_PORT`, `TESEL_DB` and `TESEL_WEB_ROOT` are not passed.
- **Caddy and the server share a network of their own** with a fixed range, `172.31.250.0/24`, which `TESEL_TRUSTED_PROXIES` names. The network is called `proxy`; the old `internal` one is removed by the installer.
- **`database.sh groups` lists the groups that take the most room, and `database.sh purge GROUP` deletes one group's envelopes** while the server runs, through the server's own code (`apps/server/src/store-admin.ts`), so its cursors are never reused.

## Consequences

- A server installed before this change keeps the old `compose.yaml` and scripts until its installer runs again (`deploy/README.md`). Its server image updates on its own, and believes only loopback as a proxy: until the installer runs, every client reaches it from Caddy's address and the limits per address apply to all of them together. The installer should run again as soon as this version is published.
- A host whose own networks already use `172.31.250.0/24` needs the range changed in `compose.yaml` and `TESEL_TRUSTED_PROXIES`.
- With off-host copies, restoring an older night than the last means fetching it from restic first.
