# Deployment

## What the server publishes

Caddy serves the base map at `/maps/basemap.pmtiles` ([ADR-0007](../docs/decisions/0007-self-hosted-vector-maps.md)): Spain, Portugal and the islands by default; set `TESEL_MAP_BBOX` (west,south,east,north) in the environment of `maps.sh` for another area. It is OpenStreetMap data, © OpenStreetMap contributors, under the [Open Database License](https://www.openstreetmap.org/copyright); `/maps/README.txt`, written with every build, says so and where the extract came from.

The server image carries the landing page ([`apps/site`](../apps/site)) at `/`, its English version at `/en/`, the web app at `/app/` and the relay at `/v1/ws` ([ADR-0017](../docs/decisions/0017-server-serves-site-and-app.md)). The app built into the image proposes its own server for new groups and uses the base map its server publishes. Whoever controls the image controls the app, so servers run only images signed by this repository's CI ([ADR-0049](../docs/decisions/0049-signed-images-and-checked-updates.md)).

GitHub Pages, where the app used to live, now only redirects to `https://tesel.eu/app/` ([`pages/`](pages)).

The files here are grouped by where they run: [`vps/`](vps) on the server, [`pages/`](pages) on GitHub Pages.

## Server on a VPS

The project's server runs at `https://tesel.eu`, on an IONOS VPS in Spain. It answers the project's former domain, `teselia.eu`, with a permanent redirect ([ADR-0019](../docs/decisions/0019-name-tesel.md)).

The server runs on any Debian or Ubuntu VPS with a domain pointing to it ([ADR-0013](../docs/decisions/0013-self-updating-vps.md)).

1. Create an `A` record for the domain with the VPS's IPv4 address, and no `AAAA` record. The containers' network has no IPv6: Docker would hand every client that came over IPv6 to Caddy from one and the same address, and the server's limits per address would then count all of them as one.
2. Log in to the VPS and run:

   ```sh
   curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Tesel/main/deploy/vps/install.sh \
     | sudo bash -s -- --domain tesel.example.eu
   ```

3. Open `https://tesel.example.eu`: the landing page is at the root and the app at `/app/`. Groups created there use that server.

The installer and the files it downloads come from `main`. To install those of a release, fetch the script from the release's tag and pass the same tag with `--ref`; the image still follows `TESEL_IMAGE_TAG` (below):

```sh
curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Tesel/v0.1.0/deploy/vps/install.sh \
  | sudo bash -s -- --ref v0.1.0 --domain tesel.example.eu
```

What [`vps/install.sh`](vps/install.sh) sets up:

| Layer      | What                                                                                                                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System     | Updates, then automatic security updates with a nightly reboot when the kernel needs it                                                                                                                           |
| Firewall   | `ufw`: only SSH (22) and the web (80, 443) are reachable                                                                                                                                                          |
| SSH        | `fail2ban` bans repeated failed logins; password logins are turned off if an SSH key is installed                                                                                                                 |
| Containers | Docker with [`vps/compose.yaml`](vps/compose.yaml): the server (read-only, no capabilities, unprivileged, given only its own settings) and Caddy, alone on a network of their own; memory limits and rotated logs |
| HTTPS      | Caddy gets and renews a Let's Encrypt certificate ([`vps/Caddyfile`](vps/Caddyfile)) and sends security headers ([`vps/headers.caddy`](vps/headers.caddy)); no access logs                                        |
| Old names  | With `--redirect-from`, domains the server used to have answer with a permanent redirect to the same address on the new one                                                                                       |
| Updates    | `tesel-update.timer`, every 15 minutes: [`vps/update.sh`](vps/update.sh) verifies, starts and checks the newest image, or goes back (below)                                                                       |
| Base map   | [`vps/maps.sh`](vps/maps.sh) extracts the area from the latest Protomaps build of OpenStreetMap, served at `/maps/basemap.pmtiles`; rebuilt monthly                                                               |
| Backups    | `tesel-backup.timer`, nightly: [`vps/backup.sh`](vps/backup.sh) keeps 14 days of the database and of Caddy's data in `/opt/tesel/backups`, or off the host (below)                                                |
| Database   | [`vps/database.sh`](vps/database.sh) copies the database while the server runs and restores a copy, which the backups and the updates use; it also lists the largest groups and purges one                        |

Running the script again applies changes to the files of this folder and is otherwise harmless.

The server's settings (`apps/server/README.md`) go in `/opt/tesel/.env`, with the installer's own; `compose.yaml` passes the server only its own, so the rest of `.env`, `TESEL_ALERT_URL` among them, never reaches the container that faces the internet. A new server setting reaches it once it is listed there too.

Useful commands on the VPS:

```sh
cd /opt/tesel
docker compose ps                         # what is running, and whether the server is healthy
docker compose logs --tail 100            # recent logs
systemctl list-timers 'tesel-*'           # when each job runs next
journalctl -u tesel-update --since today  # what the updates did
```

To move the server to a new domain, point both names at the VPS and run the script with `--domain new.example.eu --redirect-from old.example.eu` (several old names go comma-separated). Links and QR codes printed with the old name keep working; the setting is kept on later runs.

A server installed while the project was called Teselia (in `/opt/teselia`) is moved by the script on its next run: it keeps the base map and the settings in `.env`, and removes the old containers, timers and stored envelopes, which were sealed with keys derived under the old name.

### Updates

CI builds the image on every run and starts it as servers do, with read access only. After every green push to `main` a separate job publishes `ghcr.io/guaschpau-design/tesel-server` for amd64 and arm64, signs it with cosign under the identity of its workflow on `main`, with the number of the CI run in the signature, and only then moves the `latest` tag to it, if no newer commit has reached `main` meanwhile ([ADR-0049](../docs/decisions/0049-signed-images-and-checked-updates.md), [ADR-0068](../docs/decisions/0068-restorable-copies-and-going-back.md), [ADR-0109](../docs/decisions/0109-build-and-updates-resist-tampering.md)).

Every 15 minutes [`vps/update.sh`](vps/update.sh) checks that signature for the image `TESEL_IMAGE_TAG` names (`latest` unless set in `.env`; a commit's SHA pins that version), pulls it by digest, starts it and waits for its health check. A version that does not become healthy is replaced at once by the previous one, kept on disk for this, and is not tried again. `.env` records the digests: `TESEL_IMAGE` (running), `TESEL_IMAGE_PREVIOUS` and `TESEL_IMAGE_REJECTED`, and the CI runs of the first two: `TESEL_IMAGE_RUN` and `TESEL_IMAGE_RUN_PREVIOUS`. With nothing new the job only checks that the server is healthy, so an unhealthy server shows up as a failed update.

`latest` only moves forward, so the job refuses a `latest` signed by an older CI run than the running image's, and fails, which raises the alert below: someone who can move the tag could otherwise take the server back to an old version with a known flaw. A version chosen with `TESEL_IMAGE_TAG` is installed whatever its run. Images signed before runs were recorded count as run 0. Nothing on the server tells that `latest` has stopped moving; compare `TESEL_IMAGE_RUN` with the newest run of CI on `main` on GitHub. To see what an image's signature says, its run and commit among it:

```sh
cosign verify ghcr.io/guaschpau-design/tesel-server:latest \
  --certificate-identity https://github.com/guaschpau-design/Tesel/.github/workflows/ci.yml@refs/heads/main \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com | jq '.[].optional'
```

A new version may upgrade the database's schema, which older versions cannot read. So before starting a new version the job copies the database into `/opt/tesel/rollback`, and an update fails, leaving the server as it was, when the disk has no room for the copy and twice `TESEL_MIN_FREE_DISK_MB` more. Going back to the previous version across a change of schema, at once or by hand (below), restores that copy: what the server stored since is lost from it, and apps, seeing the server's store change, push their own events again.

### Alerts

Failures of the update, base map and backup jobs go to the journal. To hear about them, give the installer a ping URL of [healthchecks.io](https://healthchecks.io) or a compatible service with `--alert-url` (kept in `.env` as `TESEL_ALERT_URL`, and on later runs): it pings it once, then each job pings it when it succeeds and pings it with `/fail` appended when it fails. Updates ping every 15 minutes, so a period of one hour also tells when the server stops reporting at all.

### Backups

Every night [`vps/backup.sh`](vps/backup.sh) writes into `/opt/tesel/backups`, readable by root only:

- `tesel-TIME.db`: a consistent copy of the database, taken while the server runs and checked for integrity;
- `caddy-data-TIME.tar.gz`: Caddy's certificates and ACME account.

A backup that would leave less than twice `TESEL_MIN_FREE_DISK_MB` (500 MB unless set in `.env`) free on the disk is not made, and the job fails, so the alerts tell: the server, which refuses pushes below that margin, still has as much room again to grow. Copies are kept `TESEL_BACKUP_DAYS` days (14 unless set in `.env`); those past it are deleted before the night's is taken. The database holds sealed envelopes only, but a backup on the same VPS is lost with it. To keep a copy elsewhere, create `/opt/tesel/backup.env` (mode 0600) with a [restic](https://restic.readthedocs.io) repository, its password and the credentials of its storage, for example an S3-compatible bucket:

```sh
RESTIC_REPOSITORY=s3:https://s3.example.eu/tesel-backups
RESTIC_PASSWORD=a-long-random-password-kept-elsewhere-too
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Create the repository once, then the nightly job copies the folder there after every backup and forgets copies older than `TESEL_BACKUP_DAYS` days. Once a night's copies are off the host, only they stay in `/opt/tesel/backups`: the server's disk then holds one copy of the database, not one for every day. An older night is restored from restic (`restic restore`).

```sh
cd /opt/tesel && sudo docker run --rm --env-file backup.env restic/restic:0.19.1 init
```

## Runbook

### Going back to the previous version

```sh
sudo /opt/tesel/update.sh /opt/tesel rollback
```

It starts `TESEL_IMAGE_PREVIOUS` and rejects the running image, so the timer does not bring it back; the next image CI publishes is installed as usual. If the running version changed the database's schema, the copy taken before it started is restored first, as above. To stay on one version, set `TESEL_IMAGE_TAG` in `.env` to the commit's SHA (images are tagged with it) and run `sudo /opt/tesel/update.sh /opt/tesel`; remove the line to follow `latest` again.

### Restoring from a backup

Restoring replaces the database with an older copy. [`vps/database.sh`](vps/database.sh) stops the server, puts the copy in place and gives it a new store identity, so apps notice the change and resynchronise with the server on their own, pushing again what they have ([ADR-0046](../docs/decisions/0046-store-identity.md)). A copy restored without a new identity would mislead them into skipping envelopes.

```sh
sudo systemctl stop tesel-update.timer
sudo /opt/tesel/database.sh /opt/tesel restore /opt/tesel/backups/tesel-20261027T030000Z.db
cd /opt/tesel && sudo docker compose up --detach
sudo systemctl start tesel-update.timer
```

Caddy's data rarely needs restoring: Caddy obtains a new certificate on its own. Restoring it avoids the certificate authority's rate limits when a server is rebuilt many times:

```sh
cd /opt/tesel
sudo docker compose stop caddy
sudo docker compose run --rm --no-deps --no-TTY --entrypoint sh caddy \
  -c 'rm -rf /data/* && tar -xzf - -C /data' < backups/caddy-data-20261027T030000Z.tar.gz
sudo docker compose up --detach
```

### Removing a group's junk

Pushes need only a group's ID, so anyone who has one can fill that group with junk, within the limits per address and per new group ([ADR-0107](../docs/decisions/0107-relay-holds-against-floods.md)). Junk expires with `TESEL_RETENTION_DAYS`; to remove it at once, find the group among those that take the most room and purge it, while the server runs:

```sh
sudo /opt/tesel/database.sh /opt/tesel groups       # the 20 largest; add a number for more
sudo /opt/tesel/database.sh /opt/tesel purge GROUP  # GROUP as the list shows it
```

Every envelope of the group goes, the genuine ones too: a real group's members push their own events again only after a change of store identity, so purge only a group that is junk. Its cursors are never reused.

### Rebuilding a lost server

Keep these somewhere other than the VPS: `/opt/tesel/.env` (settings), `backup.env` and the restic password (with off-host copies), and the latest backups (`tesel-*.db`, `caddy-data-*.tar.gz`), from `/opt/tesel/backups` or restic. The base map is rebuilt by the installer.

1. Point the domain at the new VPS.
2. Copy the kept files into `/opt/tesel` on the new VPS (create the folder as root).
3. Run the installer as above; it keeps the settings it finds.
4. Restore the database, and Caddy's data if wanted, as above.

### Updating the installers and the configuration

Changes to the files of [`vps/`](vps) reach a server when its installer runs again; `--domain` is the only option to repeat, the others are kept. Run it again as soon as a version with ADR-0108's changes is published: the server image updates on its own, but believes only the proxy that `compose.yaml` names from then on, so with the older file every client counts as coming from Caddy's address and the limits per address apply to all of them together. Run it again as well once ADR-0109's changes are published, so that `update.sh` refuses to go back to an image of an older CI run:

```sh
curl -fsSL https://raw.githubusercontent.com/guaschpau-design/Tesel/main/deploy/vps/install.sh \
  | sudo bash -s -- --domain tesel.eu
```

### Updating pinned versions

Images and tools are pinned by version, and images also by digest; nothing updates them silently. Dependabot proposes newer actions, npm packages and Node and Caddy images, a week after their release ([`.github/dependabot.yml`](../.github/dependabot.yml)); the rest is updated by hand. To update one, change its version and digest (`docker buildx imagetools inspect IMAGE:VERSION` prints the digest) where it is pinned, and let CI and an installer run:

| What           | Where                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------ |
| Node           | `apps/server/Dockerfile` (three stages) and `node-version` in `.github/workflows/ci.yml`, in the same pull request |
| Caddy          | `vps/compose.yaml`                                                                                                 |
| go-pmtiles     | `vps/maps.sh`                                                                                                      |
| restic         | `vps/backup.sh`                                                                                                    |
| cosign         | `vps/install-cosign.sh` (with the checksums of its release) and `cosign-release` in `ci.yml`                       |
| GitHub Actions | `.github/workflows/ci.yml`, by commit                                                                              |
| pnpm           | `packageManager` in `package.json`, version and hash: `corepack use pnpm@VERSION` writes both                      |
| BuildKit       | `driver-opts` of both `setup-buildx-action` steps in `.github/workflows/ci.yml` (`moby/buildkit`)                  |
| QEMU (binfmt)  | `image` of `setup-qemu-action` in `.github/workflows/ci.yml` (`tonistiigi/binfmt`)                                 |
