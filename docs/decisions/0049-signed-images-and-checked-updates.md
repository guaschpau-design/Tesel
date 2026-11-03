# 0049. Run only signed server images, and check every update

- Status: Accepted, amended by [0068](0068-restorable-copies-and-going-back.md) (restored copies get a new identity, going back across a change of schema, `latest` only for the newest commit) and [0109](0109-build-and-updates-resist-tampering.md) (publishing in a job of its own, signatures with the run, servers only move forward)
- Date: 2026-10-27
- Supersedes in part: [ADR-0013](0013-self-updating-vps.md), on how images reach the server, rolling back and backups

## Context

The server image carries the landing page and the web app as well as the relay (ADR-0017), so whoever controls the image controls the code that holds every group's secret. Under ADR-0013 the VPS pulled `:latest` every 15 minutes and ran whatever it found: nothing checked who built the image, nothing checked that it worked once started, and going back meant editing `.env` by hand. CI used actions and base images by tags their owners can move. The pages had no Content-Security-Policy, and the database had no backup.

## Decision

- **CI pins what it runs.** Actions are pinned by commit, with the release in a comment, and Dependabot proposes newer ones. The workflow token is read-only unless a job asks for more. CI tests with the Node version of the image, whose base is pinned by version and digest.
- **An image is tested before it is published.** Every run, pull requests included, builds the image for amd64 and starts it locked down as servers do; it must report healthy and serve `/` and `/app/`. On `main` the image is then pushed for amd64 and arm64, signed by digest with cosign, keylessly, under the GitHub identity of `ci.yml` on `refs/heads/main`, and only then tagged `latest`. A newer run on `main` cancels an older one, so an older image never overtakes a newer one.
- **Servers run only what CI signed.** `deploy/common/update.sh`, run every 15 minutes on the VPS and on every refresh of a command post, verifies the signature of the image `TESEL_IMAGE_TAG` names (default `latest`) against that identity, pulls it by digest, starts it and waits for its health check (`/healthz`). If the server does not become healthy, the previous digest, kept on disk, is started again and the new one is recorded as rejected and not tried again. `.env` records the running, previous and rejected digests; `update.sh DIR rollback` goes back by hand. cosign is installed at a pinned version, checked against its published checksum.
- **The proxy sends security headers**: one Content-Security-Policy for the app, the same as the app's meta tag plus `frame-ancestors`, a stricter one for the landing page, and a Permissions-Policy limited to what the app uses. One Caddy snippet serves the VPS and command posts.
- **The VPS backs itself up and reports failures.** A nightly job copies the database with `VACUUM INTO` and Caddy's data, keeps 14 days, and copies them off the host when the operator configures a restic repository. Updates, map builds, backups and certificate renewals report failures to the journal and, with `TESEL_ALERT_URL`, every result to a monitoring service.
- Containers rotate their logs and have memory and process limits; Caddy keeps only the capability to bind ports 80 and 443; the base map is built by an unprivileged container, checked, and swapped in only when complete.

## Consequences

- Pushing to the image registry is no longer enough to run code on the servers: a change must be merged to `main` and pass CI.
- Updates depend on ghcr.io and on Sigstore's public trust root. When either is unreachable the server keeps running what it has, and the update job fails and alerts.
- A release that passes CI but does not start is rolled back within minutes. A release that starts but misbehaves is not detected; `update.sh rollback` handles it.
- Restoring a backup replaces the database, so the server's store identity changes and clients resynchronise with it on their own.
- Pinned images and tools (Node, Caddy, go-pmtiles, lego, restic, cosign) are updated by hand; `deploy/README.md` lists where.
- A fork that publishes its own image changes the repository and signer in `update.sh`.
