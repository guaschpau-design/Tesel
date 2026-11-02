#!/usr/bin/env bash
# Builds the base map the server publishes at /maps/basemap.pmtiles: an extract of the latest
# Protomaps daily build of OpenStreetMap (ADR-0007), for the area in TESEL_MAP_BBOX, with the
# notice its licence (ODbL) asks for in README.txt next to it.
#
#   maps.sh [DIRECTORY]
#
# The new file replaces the old one only once complete and verified, so the map never
# disappears or breaks. Any failure ends the script with an error, so tesel-maps.service fails
# and alerts. Run by install.sh the first time and by tesel-maps.timer every month after.

set -euo pipefail

DIR="${1:-/opt/tesel/maps}"
# West, south, east, north. Default: Spain and Portugal, Balearic and Canary Islands.
BBOX="${TESEL_MAP_BBOX:--18.4,27.4,4.6,44.0}"
IMAGE="protomaps/go-pmtiles:v1.31.2@sha256:06574f01f55a78f78f887bc7ebf729a5c093c0d6e17d9876300cfcb0758b59d3"
# The image's unprivileged user (distroless "nonroot"), which writes the extract.
BUILDER_USER="65532:65532"
# The new map is built next to the old one; keep as much again free as a margin. Before the
# first build its size is unknown: assume this, about what the default area takes.
FIRST_BUILD_ESTIMATE_MB=3072
# A new map smaller than this share of the current one means an extract went wrong.
MIN_SIZE_PERCENT=50

fail() {
  echo "$*" >&2
  exit 1
}

install -m 0755 -d "$DIR"
exec 9> "$DIR/.lock"
flock --nonblock 9 || fail "Another base map build is running."

current="$DIR/basemap.pmtiles"
current_mb=0
[[ -f "$current" ]] && current_mb=$(($(stat -c %s "$current") / 1024 / 1024))
needed_mb=$((2 * (current_mb > 0 ? current_mb : FIRST_BUILD_ESTIMATE_MB)))
free_mb=$(($(df --output=avail -B1 "$DIR" | tail -n 1) / 1024 / 1024))
((free_mb >= needed_mb)) || fail "Only $free_mb MB free in $DIR; building the map needs $needed_mb MB."

# Daily builds are kept for a while; take the newest one that exists.
url=""
for days_ago in $(seq 1 14); do
  candidate="https://build.protomaps.com/$(date -u -d "$days_ago days ago" +%Y%m%d).pmtiles"
  if curl -fsI --max-time 30 "$candidate" >/dev/null 2>&1; then
    url="$candidate"
    break
  fi
done
[[ -n "$url" ]] || fail "No Protomaps build found in the last two weeks."

# The extract is written by the image's unprivileged user, in a folder of its own.
build="$DIR/.build"
rm -rf "$build"
install -m 0700 -o "${BUILDER_USER%:*}" -g "${BUILDER_USER#*:}" -d "$build"
trap 'rm -rf "$build"' EXIT
pmtiles() {
  docker run --rm --user "$BUILDER_USER" --cap-drop ALL --security-opt no-new-privileges \
    --volume "$build:/maps" "$IMAGE" "$@"
}

docker pull --quiet "$IMAGE" >/dev/null
echo "Extracting $BBOX from $url (this takes a while)"
pmtiles extract "$url" /maps/basemap.pmtiles --bbox="$BBOX"
pmtiles verify /maps/basemap.pmtiles
new_mb=$(($(stat -c %s "$build/basemap.pmtiles") / 1024 / 1024))
((new_mb > 0 && new_mb * 100 >= current_mb * MIN_SIZE_PERCENT)) ||
  fail "The new map ($new_mb MB) is much smaller than the current one ($current_mb MB); keeping the current one."

# Same file system, so the rename swaps the maps at once.
chown root:root "$build/basemap.pmtiles"
chmod 0644 "$build/basemap.pmtiles"
mv "$build/basemap.pmtiles" "$current"
cat > "$DIR/README.txt" <<NOTICE
basemap.pmtiles

Map data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0:
https://www.openstreetmap.org/copyright

Extracted for the area $BBOX (west, south, east, north) from the Protomaps basemap build
$url on $(date -u +%Y-%m-%d) (https://docs.protomaps.com/basemaps/downloads), by Tesel's
deploy/vps/maps.sh.
NOTICE
chmod 0644 "$DIR/README.txt"
echo "Base map ready: ${new_mb} MB"
