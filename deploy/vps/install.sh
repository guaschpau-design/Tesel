#!/usr/bin/env bash
# Installs a Tesel server on a fresh Debian or Ubuntu VPS, hardened and updating itself.
#
#   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Tesel/main/deploy/vps/install.sh \
#     | sudo bash -s -- --domain tesel.example.eu [--redirect-from old.example.eu]
#
# To install the files of a release instead of main, fetch this script from the release's tag
# and pass the same tag with --ref (deploy/README.md).
#
# Safe to run again: it converges to the same setup, which is also how configuration changes
# in this folder reach an existing server. See deploy/README.md for what it does and why.

# Run as `curl … | bash`, the script comes on standard input, which the commands it runs share:
# one that reads its input (`docker compose run` or `exec`) would take the rest of the script,
# which would then never run. Bash reads a group in braces whole before running it, so the whole
# script is one, closed on its last line.
{

set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/guaschpau-design/Tesel"
REF="main"
DOMAIN=""
REDIRECT_FROM=""
ALERT_URL=""
SKIP_DNS_CHECK=false
INSTALL_DIR="/opt/tesel"
# Where servers installed before the project was renamed live (ADR-0019).
LEGACY_DIR="/opt/teselia"

usage() {
  cat >&2 <<'TEXT'
Usage: install.sh --domain DOMAIN [--redirect-from DOMAIN[,DOMAIN...]]
                  [--alert-url URL] [--ref GIT_REF] [--skip-dns-check]

  --domain         The server's name, e.g. tesel.example.eu
  --redirect-from  Old names of the server, which redirect to the new one; kept on later runs
  --alert-url      Ping URL of healthchecks.io or alike, told how each scheduled job ends; kept
                   on later runs
  --ref            Branch or tag whose deployment files are installed (default: main)
TEXT
  exit 2
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --redirect-from) REDIRECT_FROM="${2:-}"; shift 2 ;;
    --alert-url) ALERT_URL="${2:-}"; shift 2 ;;
    --ref) REF="${2:-}"; shift 2 ;;
    --skip-dns-check) SKIP_DNS_CHECK=true; shift ;;
    *) usage ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mError:\033[0m %s\n' "$*" >&2; exit 1; }

is_domain() { [[ "$1" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; }

# Settings live in .env; each run updates its own and keeps any other an operator added there
# (TESEL_RETENTION_DAYS, TESEL_MAP_BBOX, TESEL_ALERT_URL...).
setting() { sed -n "s/^$1=//p" "$INSTALL_DIR/.env" 2>/dev/null | tail -n 1; }
set_setting() {
  sed -i "/^$1=/d" "$INSTALL_DIR/.env"
  echo "$1=$2" >> "$INSTALL_DIR/.env"
}

[[ -n "$DOMAIN" ]] || usage
is_domain "$DOMAIN" || fail "\"$DOMAIN\" is not a domain name."
[[ "$REF" =~ ^[A-Za-z0-9._/-]+$ ]] || fail "--ref: \"$REF\" is not a branch or tag name."
IFS=',' read -r -a REDIRECT_DOMAINS <<< "$REDIRECT_FROM"
for old in "${REDIRECT_DOMAINS[@]}"; do
  is_domain "$old" || fail "--redirect-from: \"$old\" is not a domain name."
done
[[ -z "$ALERT_URL" || "$ALERT_URL" =~ ^https://[A-Za-z0-9./_~%-]+$ ]] ||
  fail "--alert-url: \"$ALERT_URL\" is not an https address."
[[ $EUID -eq 0 ]] || fail "run as root (with sudo)."
# shellcheck source=/dev/null
. /etc/os-release
[[ "$ID" == "debian" || "$ID" == "ubuntu" ]] || fail "only Debian and Ubuntu are supported."

# Caddy can only obtain certificates for names that reach this server.
step "Checking that ${DOMAIN}${REDIRECT_FROM:+ and $REDIRECT_FROM} point to this server"
SERVER_IP="$(ip -4 route get 1.1.1.1 | awk '{for (i = 1; i < NF; i++) if ($i == "src") print $(i + 1)}')"
for name in "$DOMAIN" "${REDIRECT_DOMAINS[@]}"; do
  NAME_IP="$(getent ahostsv4 "$name" | awk 'NR == 1 {print $1}' || true)"
  if [[ "$NAME_IP" != "$SERVER_IP" && "$SKIP_DNS_CHECK" == false ]]; then
    fail "$name resolves to '${NAME_IP:-nothing}', but this server is $SERVER_IP.
Create an A record for $name pointing to $SERVER_IP, wait a few minutes and run this again."
  fi
done

step "Updating the system"
export DEBIAN_FRONTEND=noninteractive
# Automatic updates may hold the package lock when this runs; wait up to 10 minutes for them.
APT_LOCK=(-o DPkg::Lock::Timeout=600)
APT_OPTIONS=(-yq "${APT_LOCK[@]}" -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)
apt-get update -q "${APT_LOCK[@]}"
apt-get upgrade "${APT_OPTIONS[@]}"
apt-get install "${APT_OPTIONS[@]}" ca-certificates curl jq openssl ufw fail2ban python3-systemd \
  unattended-upgrades

step "Turning on automatic security updates"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
CONF
# Kernel updates only take effect after a reboot; do it at night. Containers come back alone.
cat > /etc/apt/apt.conf.d/52tesel-reboot <<'CONF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";
CONF

step "Configuring the firewall: only SSH and the web are reachable"
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

step "Blocking repeated failed SSH logins"
cat > /etc/fail2ban/jail.d/tesel.local <<'CONF'
[DEFAULT]
backend = systemd
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
CONF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

step "Hardening SSH"
has_ssh_key() {
  [[ -s /root/.ssh/authorized_keys ]] && return 0
  find /home -mindepth 3 -maxdepth 3 -path '*/.ssh/authorized_keys' -size +0 2>/dev/null | grep -q .
}
if has_ssh_key; then
  # sshd keeps the first value it reads, and drop-ins are read in name order: "10-" goes before
  # cloud images' "50-cloud-init.conf", which turns passwords back on.
  cat > /etc/ssh/sshd_config.d/10-tesel.conf <<'CONF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
CONF
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "SSH keys found: password logins are now off."
else
  echo "No SSH key installed, so password logins stay on (turning them off would lock you out)."
  echo "Recommended: add an SSH key in the provider's panel and run this script again."
fi

step "Installing Docker"
if ! command -v docker >/dev/null || ! docker compose version >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/$ID $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
  apt-get update -q "${APT_LOCK[@]}"
  apt-get install "${APT_OPTIONS[@]}" docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
systemctl enable --now docker >/dev/null

# A server installed while the project was called Teselia moves here, only now that the system and
# Docker are ready, so a failure in those steps leaves it running. Its base map and settings are
# kept. The rest goes, its stored envelopes too: they were sealed with keys derived under the old
# name and no app can open them (ADR-0019).
if [[ -d "$LEGACY_DIR" ]]; then
  step "Moving the server installed as Teselia to $INSTALL_DIR"
  systemctl disable --now teselia-update.timer teselia-maps.timer >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/teselia-{update,maps}.{service,timer}
  systemctl daemon-reload
  (cd "$LEGACY_DIR" && docker compose down --volumes --rmi all) || true
  install -m 0755 -d "$INSTALL_DIR"
  if [[ -d "$LEGACY_DIR/maps" && ! -e "$INSTALL_DIR/maps" ]]; then
    mv "$LEGACY_DIR/maps" "$INSTALL_DIR/maps"
  fi
  if [[ -f "$LEGACY_DIR/.env" && ! -e "$INSTALL_DIR/.env" ]]; then
    sed 's/^TESELIA_/TESEL_/' "$LEGACY_DIR/.env" > "$INSTALL_DIR/.env"
  fi
  rm -rf "$LEGACY_DIR"
  rm -f /etc/apt/apt.conf.d/52teselia-reboot /etc/fail2ban/jail.d/teselia.local \
    /etc/ssh/sshd_config.d/10-teselia.conf
fi

step "Installing Tesel in $INSTALL_DIR from $REF"
install -m 0755 -d "$INSTALL_DIR"
fetch() { curl -fsSL "$REPO_RAW/$REF/deploy/$1" -o "$INSTALL_DIR/$(basename "$1")"; }
for file in vps/compose.yaml vps/Caddyfile vps/headers.caddy; do
  fetch "$file"
done
for script in vps/maps.sh vps/backup.sh vps/database.sh vps/notify.sh vps/update.sh \
  vps/install-cosign.sh; do
  fetch "$script"
  chmod 0755 "$INSTALL_DIR/$(basename "$script")"
done
"$INSTALL_DIR/install-cosign.sh"

# Settings may hold secrets, such as TESEL_ALERT_URL: root only. Editing keeps the mode.
touch "$INSTALL_DIR/.env"
chmod 0600 "$INSTALL_DIR/.env"
set_setting TESEL_DOMAIN "$DOMAIN"
if [[ -n "$REDIRECT_FROM" ]] || ! grep -q '^TESEL_REDIRECT_FROM=' "$INSTALL_DIR/.env"; then
  set_setting TESEL_REDIRECT_FROM "$REDIRECT_FROM"
fi
if [[ -n "$ALERT_URL" ]]; then
  set_setting TESEL_ALERT_URL "$ALERT_URL"
  # A first ping, so the alert service knows the server and starts expecting the jobs' own.
  TESEL_ALERT_URL="$ALERT_URL" "$INSTALL_DIR/notify.sh" success tesel-install
fi
# Caddy needs site names in its configuration itself, so the redirect site is written from the
# setting into a file the Caddyfile imports (empty when there are no old names).
REDIRECT_FROM="$(setting TESEL_REDIRECT_FROM)"
{
  echo "# Written by install.sh from TESEL_REDIRECT_FROM in .env: old names answer with a"
  echo "# permanent redirect to the same address on $DOMAIN. Run install.sh again to change it."
  if [[ -n "$REDIRECT_FROM" ]]; then
    printf '%s {\n\tredir https://%s{uri} permanent\n}\n' "${REDIRECT_FROM//,/, }" "$DOMAIN"
  fi
} > "$INSTALL_DIR/redirects.caddy"
# Command posts are no more (ADR-0058): what a server kept for them goes, its DNS credentials
# first. Once every server has been installed again since 2026-10-28, this step can go.
if [[ -e /etc/systemd/system/tesel-post-certificate.timer || -e "$INSTALL_DIR/dns.env" ]]; then
  step "Removing what command posts used"
  systemctl disable --now tesel-post-certificate.timer >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/tesel-post-certificate.{service,timer}
  rm -rf "$INSTALL_DIR/dns.env" "$INSTALL_DIR/lego" "$INSTALL_DIR/post-tokens" \
    "$INSTALL_DIR/post-certificate" "$INSTALL_DIR/post-certificate.caddy" \
    "$INSTALL_DIR/post-certificate.sh"
fi
sed -i '/^TESEL_COMMAND_POST=/d; /^TESEL_POST_DNS=/d; /^TESEL_POST_EMAIL=/d' "$INSTALL_DIR/.env"

# Each scheduled job is a oneshot service run by its timer, which reports how it ended
# (notify.sh): failures to the journal, and every result to TESEL_ALERT_URL when it is set.
# cosign, which update.sh runs, keeps Sigstore's trust root under $HOME, which systemd does not
# set for system services. Each job has a time limit, so one that hangs (a download that stalls)
# fails, is reported, and does not keep its timer from starting it again.
write_job() {
  local name="$1" description="$2" command="$3" schedule="$4" timer_description="$5" limit="$6"
  cat > "/etc/systemd/system/$name.service" <<CONF
[Unit]
Description=$description
After=docker.service network-online.target
Wants=network-online.target
OnFailure=tesel-notify@%N.service

[Service]
Type=oneshot
TimeoutStartSec=$limit
Environment=HOME=/root
EnvironmentFile=-$INSTALL_DIR/.env
ExecStart=$command
ExecStartPost=$INSTALL_DIR/notify.sh success %N
CONF
  cat > "/etc/systemd/system/$name.timer" <<CONF
[Unit]
Description=$timer_description

[Timer]
$schedule

[Install]
WantedBy=timers.target
CONF
}
cat > /etc/systemd/system/tesel-notify@.service <<CONF
[Unit]
Description=Report that %i failed

[Service]
Type=oneshot
EnvironmentFile=-$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/notify.sh failure %i
CONF
write_job tesel-update "Update Tesel to the latest signed version" \
  "$INSTALL_DIR/update.sh $INSTALL_DIR" \
  $'OnBootSec=5min\nOnUnitActiveSec=15min\nRandomizedDelaySec=2min' \
  "Check for a new Tesel version every 15 minutes" 30min
write_job tesel-maps "Rebuild the Tesel base map from the latest OpenStreetMap data" \
  "$INSTALL_DIR/maps.sh $INSTALL_DIR/maps" \
  $'OnCalendar=monthly\nRandomizedDelaySec=1d\nPersistent=true' \
  "Rebuild the Tesel base map every month" 6h
# Before the automatic reboots at 04:00.
write_job tesel-backup "Back up the Tesel server" \
  "$INSTALL_DIR/backup.sh $INSTALL_DIR" \
  $'OnCalendar=*-*-* 03:00\nRandomizedDelaySec=30min\nPersistent=true' \
  "Back up the Tesel server every night" 2h
systemctl daemon-reload

if [[ ! -f "$INSTALL_DIR/maps/basemap.pmtiles" ]]; then
  step "Building the base map (only the first time; it can take half an hour)"
  # shellcheck source=/dev/null
  (set -a && . "$INSTALL_DIR/.env" && "$INSTALL_DIR/maps.sh" "$INSTALL_DIR/maps") ||
    echo "The base map could not be built now; tesel-maps.timer will try again."
fi
# Enabled only now, so its first run cannot overlap the build above.
systemctl enable --now tesel-maps.timer >/dev/null

step "Starting Tesel"
cd "$INSTALL_DIR"
if ! "$INSTALL_DIR/update.sh" "$INSTALL_DIR"; then
  fail "could not verify, download or start the Tesel image (see above). The image must be public
on GitHub (github.com/guaschpau-design → Packages → tesel-server → Package settings) and signed
by the repository's CI."
fi
# Caddy reads its configuration only when it starts: apply what was installed above.
docker compose exec --no-TTY caddy caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
# Enabled only now: a timer whose boot delay has passed fires at once, and its own update would
# wait for the one above for nothing.
systemctl enable --now tesel-update.timer tesel-backup.timer >/dev/null

step "Waiting for https://$DOMAIN"
for _ in $(seq 1 60); do
  if curl -fsS "https://$DOMAIN/healthz" >/dev/null 2>&1; then
    printf '\n\033[32mTesel is running at https://%s\033[0m\n' "$DOMAIN"
    echo "The app is at https://$DOMAIN/app/ and creates its groups on this server."
    exit 0
  fi
  sleep 5
done
fail "the server did not answer on https://$DOMAIN within 5 minutes.
See what happened with: cd $INSTALL_DIR && docker compose logs"
}
