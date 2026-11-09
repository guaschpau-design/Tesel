# 0126. A version number, and the build it came from

- Status: Accepted
- Date: 2026-11-09

## Context

Tesel had no version anyone could see. The web app updates itself and the Android app installs over itself (ADR-0124), so nobody could tell which one a phone runs, or whether an update has arrived. And a problem reported without one cannot be matched to the code.

## Decision

- **The version follows Semantic Versioning, in one place:** `apps/web/package.json`, which the web app and the Android app both read. It is **0.1.0-beta**: what CHANGELOG.md lists under 0.1.0, before that release. The first release removes "-beta", and with it freezes version 1 of the protocol (protocol §9). A new feature raises the minor number, a fix the patch, as the CHANGELOG records. Version 1.0 is for when Tesel is relied on outside tests.
- **Each build has a number**, CI's run number (`TESEL_BUILD`). The web app in the server image and the Android app built in one run carry the same number. A build outside CI has none.
- **The app shows it in one place:** at the foot of the settings, "Tesel, versión 0.1.0-beta (185)". The Android app's version is the same, in Android's own app information; its build number is the app's version code, which must grow for an update to install.
- No tags or releases are made for this: a release, with its tag, is a decision of its own.

## Consequences

- Someone reporting a problem says which build they run, and anyone can tell whether a phone has the latest.
- A web build and an Android build of one commit, made in different runs, show different numbers.
