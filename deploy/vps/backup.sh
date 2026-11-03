#!/usr/bin/env bash
# Backs up the Tesel server, every night from tesel-backup.timer, into DIRECTORY/backups:
#
#   - tesel-TIME.db: a consistent copy of the server's SQLite database, taken while the server
#     keeps running and checked (database.sh copy); with too little free disk for it, the backup
#     fails, and says so;
#   - caddy-data-TIME.tar.gz: Caddy's certificates and ACME account.
#
# Copies older than TESEL_BACKUP_DAYS (default 14) are deleted, before tonight's is taken. When
# DIRECTORY/backup.env exists it names a restic repository and its credentials: the folder is
# then copied off the host, where copies are kept TESEL_BACKUP_DAYS days, and only tonight's stays
# on it, so the server's disk holds one copy of the database rather than one for every day
# (deploy/README.md, "Backups").
#
#   backup.sh [DIRECTORY]

set -euo pipefail

DIR="${1:-/opt/tesel}"
KEEP_DAYS="${TESEL_BACKUP_DAYS:-14}"
RESTIC_IMAGE="restic/restic:0.19.1@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510"

cd "$DIR"
backups="$DIR/backups"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
install -m 0700 -d "$backups"

# Each kind of copy, by the name it has in the folder.
copies=(\( -name 'tesel-*.db' -o -name 'caddy-data-*.tar.gz' \))
# Expired copies go first, so that they do not take the room tonight's needs.
find "$backups" -maxdepth 1 -type f "${copies[@]}" -mtime "+$KEEP_DAYS" -delete

"$DIR/database.sh" "$DIR" copy "$backups/tesel-$stamp.db"

# Written under another name until complete; a failed copy leaves nothing behind.
partial="$backups/caddy-data-$stamp.tar.gz.partial"
trap 'rm -f "$partial"' EXIT
docker compose run --rm --no-deps --no-TTY --quiet-pull --entrypoint tar caddy \
  -C /data -czf - . > "$partial"
chmod 0600 "$partial"
mv "$partial" "$backups/caddy-data-$stamp.tar.gz"

echo "Backed up to $backups: tesel-$stamp.db, caddy-data-$stamp.tar.gz"

[[ -f "$DIR/backup.env" ]] || exit 0
restic() {
  docker run --rm --env-file "$DIR/backup.env" --hostname tesel \
    --volume "$backups:/backups:ro" "$RESTIC_IMAGE" "$@"
}
restic backup --quiet /backups
restic forget --quiet --keep-daily "$KEEP_DAYS" --prune
find "$backups" -maxdepth 1 -type f "${copies[@]}" \
  ! -name "tesel-$stamp.db" ! -name "caddy-data-$stamp.tar.gz" -delete
echo "Copied off the host to the restic repository of backup.env; only tonight's copies stay here"
