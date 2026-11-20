#!/usr/bin/env bash
# Builds the buildings the server publishes at /maps/buildings.pmtiles (ADR-0161): those of the
# latest release of Overture Maps (OpenStreetMap's, the national mapping agencies' and those found
# in aerial imagery, merged) for the area in TESEL_MAP_BBOX, kept light for the app, with the
# notice their licence (ODbL) asks for in buildings.txt next to it.
#
#   buildings.sh [DIRECTORY]
#
# The build runs in the server's own image (TESEL_IMAGE, set by update.sh once its signature is
# verified): apps/server/src/maps/build-buildings.ts. As with the base map (maps.sh), the new file
# replaces the old one only once complete, so the buildings never disappear or break, and any
# failure ends the script with an error, so tesel-buildings.service fails and alerts. Run by
# install.sh the first time and by tesel-buildings.timer every month after.

set -euo pipefail

DIR="${1:-/opt/tesel/maps}"
# West, south, east, north: the base map's area.
BBOX="${TESEL_MAP_BBOX:--18.4,27.4,4.6,44.0}"
# The image's unprivileged user ("node"), which writes the archive.
BUILDER_USER="1000:1000"
# Kept free besides the old archive while the new one is built. Before the first build its size
# is unknown: assume this, about what the default area takes.
FIRST_BUILD_ESTIMATE_MB=4096
# A new archive smaller than this share of the current one means a build went wrong.
MIN_SIZE_PERCENT=50

fail() {
  echo "$*" >&2
  exit 1
}

[[ -n "${TESEL_IMAGE:-}" ]] || fail "TESEL_IMAGE is not set: update.sh sets it once the server runs."

install -m 0755 -d "$DIR"
exec 9> "$DIR/.buildings.lock"
flock --nonblock 9 || fail "Another buildings build is running."

current="$DIR/buildings.pmtiles"
current_mb=0
[[ -f "$current" ]] && current_mb=$(($(stat -c %s "$current") / 1024 / 1024))
needed_mb=$((2 * (current_mb > 0 ? current_mb : FIRST_BUILD_ESTIMATE_MB)))
free_mb=$(($(df --output=avail -B1 "$DIR" | tail -n 1) / 1024 / 1024))
((free_mb >= needed_mb)) || fail "Only $free_mb MB free in $DIR; building the buildings needs $needed_mb MB."

# Written by the image's unprivileged user, in a folder of its own.
build="$DIR/.buildings-build"
rm -rf "$build"
install -m 0700 -o "${BUILDER_USER%:*}" -g "${BUILDER_USER#*:}" -d "$build"
trap 'rm -rf "$build"' EXIT

echo "Building the buildings of $BBOX (this takes about an hour)"
docker run --rm --user "$BUILDER_USER" --cap-drop ALL --security-opt no-new-privileges \
  --memory 1g --volume "$build:/maps" --entrypoint node "$TESEL_IMAGE" \
  apps/server/src/maps/build-buildings.ts --bbox="$BBOX" --out=/maps/buildings.pmtiles
new_mb=$(($(stat -c %s "$build/buildings.pmtiles") / 1024 / 1024))
((new_mb > 0 && new_mb * 100 >= current_mb * MIN_SIZE_PERCENT)) ||
  fail "The new buildings ($new_mb MB) are much smaller than the current ones ($current_mb MB); keeping the current ones."

# Same file system, so the rename swaps the archives at once.
chown root:root "$build/buildings.pmtiles"
chmod 0644 "$build/buildings.pmtiles"
mv "$build/buildings.pmtiles" "$current"
cat > "$DIR/buildings.txt" <<NOTICE
buildings.pmtiles

Buildings from Overture Maps (https://overturemaps.org), © OpenStreetMap contributors and the
other sources Overture names (https://docs.overturemaps.org/attribution), available under the
Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/

Built for the area $BBOX (west, south, east, north) from Overture's latest release on
$(date -u +%Y-%m-%d), keeping each building's outline, height, floors, kind and source, by
Tesel's deploy/vps/buildings.sh.
NOTICE
chmod 0644 "$DIR/buildings.txt"
echo "Buildings ready: ${new_mb} MB"
