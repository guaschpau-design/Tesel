# 0109. Keep the build, the publishing and the updates safe from tampering

- Status: Accepted
- Date: 2026-11-03
- Amends: [ADR-0049](0049-signed-images-and-checked-updates.md), on how images are published and which signed images servers accept

## Context

An audit of the supply chain and the publishing of the server image found:

- The image job asked for `packages: write` and `id-token: write` on every event, pull requests from branches of this repository included, so code under review ran in a job that could have pushed and signed an image.
- In that job, the action that sets up QEMU ran `tonistiigi/binfmt:latest` as a privileged container, and Buildx started `moby/buildkit:buildx-stable-1`: both are tags their owners move, while the job held the token that signs.
- `update.sh` checked only who signed an image. Whoever could move `latest` in the registry, with a leaked package token or a taken-over account, could take every server back to an old signed image with a known flaw, or keep them on one.
- Dependabot watched the actions only, and nothing in CI looked at advisories for npm packages.
- pnpm was named by version without a hash, and the image installed it with `npm install --global`.
- pnpm 10 skips dependencies' install scripts with a warning, which nobody reads in CI; whether one should run was decided nowhere.
- The build context took everything not ignored in the working copy: `.env` files, databases, base maps and assistants' folders.
- The deployment guide's example installed from a tag, `v0.1.0`, that does not exist.

## Decision

- **Testing and publishing are separate jobs.** `image` builds and starts the image on every event with the workflow's read-only token. `image-publish` runs only for a push to `main`, after `check`, `e2e` and `image` pass, and is the only job with `packages: write` and `id-token: write`. It builds for amd64 and arm64, pushes, signs and moves `latest` only if its commit is still `main`'s head, as before. The signer is still `ci.yml` on `refs/heads/main`, which servers verify.
- **What runs in that job is pinned.** BuildKit (`driver-opts` of `setup-buildx-action`) and QEMU's binfmt (`image` of `setup-qemu-action`, arm64 only) are pinned by version and digest, like the base images, and listed in `deploy/README.md`.
- **Signatures carry the run, and servers only move forward.** CI signs with the annotations `run` (the workflow's run number, which only grows) and `sha` (the commit). `update.sh` reads the run from the verified payload, records it beside the digest (`TESEL_IMAGE_RUN`, `TESEL_IMAGE_RUN_PREVIOUS`), and refuses a `latest` from an older run than the running image's: the update fails, which raises the operator's alert. An image the operator chooses with `TESEL_IMAGE_TAG` is installed whatever its run, and going back with `update.sh rollback` restores the previous run with the previous image. Images signed before this change count as run 0, so the first one signed with a run is accepted.
- **No alert when `latest` stops moving.** A server cannot tell a quiet project from a frozen tag without trusting another source; the run in `.env` lets the operator compare by hand with CI's runs on GitHub.
- **Dependencies are watched.** Dependabot also proposes npm packages and the Node and Caddy images, a week after their release, grouped, and at most five npm pull requests at a time; Node's major version is left to a decision. CI fails on advisories of high or critical severity in production dependencies (`pnpm audit --prod --audit-level high`).
- **pnpm is pinned by hash.** `packageManager` in `package.json` names pnpm's version and the SHA-512 of its package, and the image installs it with Corepack, which refuses a package whose hash differs.
- **Install scripts are decided, not skipped.** `pnpm-workspace.yaml` lists none to run (`onlyBuiltDependencies: []`), the serial port binding that `meshcore.js` pulls in as one not to run (`ignoredBuiltDependencies`: the app reaches radios through the browser), and sets `strictDepBuilds`, so a dependency with a script on neither list fails the install.
- **The build context is the sources.** `.dockerignore` leaves out `.env` files, `data` folders, databases, `.pmtiles` maps and `.claude`.
- **An immutable install is by commit.** The guide installs from `main`, or from one commit's full SHA passed with `--ref`, which `install.sh` already accepted; it no longer names a tag that does not exist.

## Consequences

- Pull requests can no longer publish or sign. On `main` the image is built twice, once to test and once to publish, the second mostly from the cache.
- Servers take the new `update.sh` when their installer runs again. Until the running image is one signed with a run, any image is newer; the run of the image already running is recorded on the next update.
- How `cosign verify` prints a signature's annotations (`.optional.run`) is read from its documented output for Simple Signing payloads. If the version in use printed none for the bundles it now writes, every image would read as run 0: updates go on as before, unprotected. The first run of `image-publish` must be checked for the annotation (`deploy/README.md`).
- The run number belongs to the workflow file: renaming `ci.yml` restarts it, and changes the signer that `update.sh` checks, so such a change must also clear `TESEL_IMAGE_RUN` on the servers.
- A new dependency with an install script fails `pnpm install` until it is listed. A working copy installed before this change may fail once on the binding it skipped; `pnpm install --force` clears it.
- `pnpm audit` can turn CI red for a change that did not cause it, when an advisory is published; it is fixed by updating the dependency, or by waiting for Dependabot.
- The `check` and `e2e` jobs still get pnpm from `pnpm/action-setup`, pinned by commit, which takes the version from `packageManager` without checking its hash; the image build, which runs on every event, does check it.
- BuildKit and binfmt are updated by hand, like the other images.
