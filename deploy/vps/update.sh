#!/usr/bin/env bash
# Keeps a Tesel server on the newest published image, and only on
# images this repository's CI built and signed (docs/decisions/0049-signed-images-and-checked-updates.md):
#
#   1. cosign checks the signature of the image TESEL_IMAGE_TAG (default "latest") names and
#      gives its digest;
#   2. that digest is pulled and started, and must become healthy (the image's health check
#      asks the server's /healthz);
#   3. if it does not, the previous image is started again, from the local copy kept for this,
#      and the new digest is remembered as rejected, so it is not tried again.
#
# With nothing new it only makes sure the containers run and the server is healthy. The images
# in use are recorded in the project's .env: TESEL_IMAGE (running), TESEL_IMAGE_PREVIOUS and
# TESEL_IMAGE_REJECTED.
#
# A new image may upgrade the database's schema, which older images cannot read. So before a new
# image starts, a copy of the database is taken (database.sh copy) and kept, with its schema
# version (TESEL_SCHEMA_PREVIOUS in .env), for as long as the server may go back to the image
# that left it so. Going back across a change of schema restores that copy: what the server
# stored since is lost from it, and clients, told so by the copy's new store identity, push
# their own events again.
#
#   update.sh DIRECTORY             update (run by the installers and by a timer)
#   update.sh DIRECTORY rollback    go back to TESEL_IMAGE_PREVIOUS and reject the current image

set -euo pipefail

REPOSITORY="ghcr.io/guaschpau-design/tesel-server"
# Who may sign: the CI workflow of this repository, running for the main branch.
SIGNER="https://github.com/guaschpau-design/Tesel/.github/workflows/ci.yml@refs/heads/main"
ISSUER="https://token.actions.githubusercontent.com"
# Seconds a server that was just started has to report healthy.
HEALTH_TIMEOUT=180

DIR="${1:?usage: update.sh DIRECTORY [rollback]}"
ACTION="${2:-update}"
cd "$DIR"
# Copies of the database for going back: as the running image left it while a new one is tried,
# and as the previous image left it.
COPY_CURRENT="$DIR/rollback/current.db"
COPY_PREVIOUS="$DIR/rollback/previous.db"

# The timer and an installer may run this at the same time; the second one waits.
exec 9> .update.lock
flock 9

setting() { sed -n "s/^$1=//p" .env | tail -n 1; }
set_setting() {
  sed -i "/^$1=/d" .env
  echo "$1=$2" >> .env
}

# Starts every service and waits for the server's health check only: whether a new image is
# kept must not depend on the rest of the project. The image is passed explicitly because
# Compose prefers the environment to .env, and the timer's unit loads .env into the environment
# when it starts: without this, the image this run just wrote to .env would not be the one
# started.
start() {
  local image
  image="$(setting TESEL_IMAGE)"
  TESEL_IMAGE="$image" docker compose up --detach --remove-orphans --quiet-pull
  TESEL_IMAGE="$image" docker compose up --detach --wait --wait-timeout "$HEALTH_TIMEOUT" tesel
}

# Removes the server images that are neither running nor kept for going back.
remove_old_images() {
  local keep id reference kept
  keep=" $(setting TESEL_IMAGE) $(setting TESEL_IMAGE_PREVIOUS) "
  for id in $(docker image ls --quiet --no-trunc "$REPOSITORY" | sort -u); do
    kept=false
    for reference in $(docker image inspect --format '{{join .RepoDigests " "}}' "$id"); do
      [[ "$keep" == *" $reference "* ]] && kept=true
    done
    [[ "$kept" == true ]] || docker image rm "$id" >/dev/null
  done
}

# Prints the digest of the image a tag names, once its signature is verified. cosign tells the
# journal what it checked.
verified_digest() {
  local digest
  digest="$(cosign verify --certificate-identity "$SIGNER" --certificate-oidc-issuer "$ISSUER" \
    "$REPOSITORY:$1" | jq -r '.[0].critical.image."docker-manifest-digest"')"
  [[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || {
    echo "No image signed by Tesel's CI at $REPOSITORY:$1." >&2
    return 1
  }
  echo "$digest"
}

# Before going back to an older image: restores the copy of the database COPY, taken while it
# had the schema SCHEMA, if the schema has changed since. The copy is used up either way.
restore_older_schema() {
  local copy="$1" schema="$2" now
  if [[ -z "$schema" || ! -f "$copy" ]]; then
    echo "No copy of the database from before the newer image: the database stays as it is." >&2
    return
  fi
  now="$("$DIR/database.sh" "$DIR" schema)"
  if ((now > schema)); then
    echo "The newer image changed the database's schema: restoring the copy from before it."
    "$DIR/database.sh" "$DIR" restore "$copy"
  fi
  rm -f "$copy"
}

current="$(setting TESEL_IMAGE)"

case "$ACTION" in
  update) ;;
  rollback)
    previous="$(setting TESEL_IMAGE_PREVIOUS)"
    [[ -n "$previous" ]] || { echo "There is no previous image to go back to." >&2; exit 1; }
    echo "Going back to $previous; $current is rejected."
    restore_older_schema "$COPY_PREVIOUS" "$(setting TESEL_SCHEMA_PREVIOUS)"
    set_setting TESEL_IMAGE "$previous"
    set_setting TESEL_IMAGE_PREVIOUS ""
    set_setting TESEL_SCHEMA_PREVIOUS ""
    set_setting TESEL_IMAGE_REJECTED "$current"
    start
    exit 0
    ;;
  *)
    echo "usage: update.sh DIRECTORY [rollback]" >&2
    exit 2
    ;;
esac

tag="$(setting TESEL_IMAGE_TAG)"
candidate="$REPOSITORY@$(verified_digest "${tag:-latest}")"

if [[ "$candidate" == "$current" ]]; then
  start
  exit 0
fi
if [[ "$candidate" == "$(setting TESEL_IMAGE_REJECTED)" ]]; then
  echo "Staying on $current: $candidate failed its health check before."
  start
  exit 0
fi

echo "Updating to $candidate"
docker pull --quiet "$candidate" >/dev/null
if [[ -n "$current" ]]; then
  "$DIR/database.sh" "$DIR" copy "$COPY_CURRENT"
  schema="$("$DIR/database.sh" "$DIR" schema)"
fi
set_setting TESEL_IMAGE "$candidate"
if start; then
  set_setting TESEL_IMAGE_PREVIOUS "$current"
  if [[ -n "$current" ]]; then
    mv "$COPY_CURRENT" "$COPY_PREVIOUS"
    set_setting TESEL_SCHEMA_PREVIOUS "$schema"
  fi
  remove_old_images
  echo "Running $candidate"
  exit 0
fi

if [[ -z "$current" ]]; then
  echo "$candidate is not healthy, and there is no earlier image to go back to." >&2
  exit 1
fi
echo "$candidate is not healthy: going back to $current." >&2
restore_older_schema "$COPY_CURRENT" "$schema"
set_setting TESEL_IMAGE "$current"
set_setting TESEL_IMAGE_REJECTED "$candidate"
start
exit 1
