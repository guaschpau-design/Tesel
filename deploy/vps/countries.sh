#!/usr/bin/env bash
# Downloads the table of address ranges by country that the server counts visits and connections
# by (ADR-0162): DB-IP's free "IP to Country Lite", published at the start of every month under
# CC BY 4.0, which the usage page credits. The server reads it again on its own when it changes,
# within the hour, and keeps no address.
#
#   countries.sh [DIRECTORY]
#
# The new file replaces the old one only once downloaded and checked, so the server never reads
# half a table. Any failure ends the script with an error, so tesel-countries.service fails and
# alerts. Run by install.sh the first time and by tesel-countries.timer every month after.

set -euo pipefail

DIR="${1:-/opt/tesel/geo}"
# A whole table has hundreds of thousands of ranges; far fewer means a broken download.
MIN_RANGES=100000

fail() {
  echo "$*" >&2
  exit 1
}

install -m 0755 -d "$DIR"
exec 9> "$DIR/.lock"
flock --nonblock 9 || fail "Another download of the countries is running."

new="$DIR/.countries.csv.gz"
trap 'rm -f "$new"' EXIT
# This month's table, or last month's in its first days, before DB-IP publishes the new one.
url=""
for month in "$(date -u +%Y-%m)" "$(date -u -d "$(date -u +%Y-%m-15) -1 month" +%Y-%m)"; do
  candidate="https://download.db-ip.com/free/dbip-country-lite-$month.csv.gz"
  if curl -fsSL --max-time 300 "$candidate" -o "$new"; then
    url="$candidate"
    break
  fi
done
[[ -n "$url" ]] || fail "DB-IP's table of countries could not be downloaded."

gzip -t "$new" || fail "The table from $url is not a whole gzip file."
# A range a line: its first and last address and its country's code.
first="$(zcat "$new" | head -n 1 || true)"
[[ "$first" =~ ^\"?[0-9.]+\"?,\"?[0-9.]+\"?,\"?[A-Z]{2}\"?$ ]] ||
  fail "The table from $url does not start with a range of addresses: $first"
ranges="$(zcat "$new" | wc -l)"
((ranges >= MIN_RANGES)) || fail "The table from $url has only $ranges ranges."

# The server's container reads it as its own unprivileged user.
chmod 0644 "$new"
# Same file system, so the rename swaps the tables at once.
mv "$new" "$DIR/countries.csv.gz"
echo "Countries ready: $ranges ranges, from $url"
