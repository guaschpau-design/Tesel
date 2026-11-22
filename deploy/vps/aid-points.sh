#!/usr/bin/env bash
# Builds the aid points the server publishes at /maps/aid-points.pmtiles (ADR-0165): the
# defibrillators, fire hydrants and drinking water OpenStreetMap maps in the area in
# TESEL_MAP_BBOX, asked of the Overpass API, with the notice their licence (ODbL) asks for in
# aid-points.txt next to it.
#
#   aid-points.sh [DIRECTORY]
#
# The build runs in the server's own image (TESEL_IMAGE, set by update.sh once its signature is
# verified): apps/server/src/maps/build-aid-points.ts. As with the base map (maps.sh), the new
# file replaces the old one only once complete and not much smaller, so the points never
# disappear or break, and any failure ends the script with an error, so tesel-aid-points.service
# fails and alerts. Run by install.sh the first time and by tesel-aid-points.timer every week after.

set -euo pipefail

DIR="${1:-/opt/tesel/maps}"
# West, south, east, north: the base map's area.
BBOX="${TESEL_MAP_BBOX:--18.4,27.4,4.6,44.0}"
# The image's unprivileged user ("node"), which writes the archive.
BUILDER_USER="1000:1000"
# A new archive smaller than this share of the current one means a build went wrong.
MIN_SIZE_PERCENT=50

fail() {
  echo "$*" >&2
  exit 1
}

[[ -n "${TESEL_IMAGE:-}" ]] || fail "TESEL_IMAGE is not set: update.sh sets it once the server runs."

install -m 0755 -d "$DIR"
exec 9> "$DIR/.aid-points.lock"
flock --nonblock 9 || fail "Another build of the aid points is running."

current="$DIR/aid-points.pmtiles"
# Written by the image's unprivileged user, in a folder of its own.
build="$DIR/.aid-points-build"
rm -rf "$build"
install -m 0700 -o "${BUILDER_USER%:*}" -g "${BUILDER_USER#*:}" -d "$build"
trap 'rm -rf "$build"' EXIT

echo "Building the aid points of $BBOX"
docker run --rm --user "$BUILDER_USER" --cap-drop ALL --security-opt no-new-privileges \
  --memory 1g --volume "$build:/maps" --entrypoint node "$TESEL_IMAGE" \
  apps/server/src/maps/build-aid-points.ts --bbox="$BBOX" --out=/maps/aid-points.pmtiles
current_kb=0
[[ -f "$current" ]] && current_kb=$(($(stat -c %s "$current") / 1024))
new_kb=$(($(stat -c %s "$build/aid-points.pmtiles") / 1024))
((new_kb > 0 && new_kb * 100 >= current_kb * MIN_SIZE_PERCENT)) ||
  fail "The new aid points ($new_kb KB) are much smaller than the current ones ($current_kb KB); keeping the current ones."

# Same file system, so the rename swaps the archives at once.
chown root:root "$build/aid-points.pmtiles"
chmod 0644 "$build/aid-points.pmtiles"
mv "$build/aid-points.pmtiles" "$current"
cat > "$DIR/aid-points.txt" <<NOTICE
aid-points.pmtiles

Defibrillators, fire hydrants and drinking water from OpenStreetMap, © OpenStreetMap
contributors, available under the Open Database License (ODbL) 1.0:
https://www.openstreetmap.org/copyright

Built for the area $BBOX (west, south, east, north) on $(date -u +%Y-%m-%d) by Tesel's
deploy/vps/aid-points.sh.
NOTICE
chmod 0644 "$DIR/aid-points.txt"
echo "Aid points ready: ${new_kb} KB"
