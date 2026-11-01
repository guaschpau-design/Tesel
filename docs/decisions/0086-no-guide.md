# 0086. No user guide: the app explains itself

- Status: Accepted
- Date: 2026-11-01

## Context

Three ways of teaching the app were tried in turn: a practice played on the device, a help on one page ([ADR-0083](0083-help-on-one-page.md)), and a guide in plates that took the help in ([ADR-0084](0084-guide-plate-by-plate.md), [ADR-0085](0085-one-guide.md)). Each was a document about the app rather than a change to it, and each grew long because the app does about thirty things while someone opening it needs five. An app for emergencies should not need a manual: whoever picks it up under stress will not read one.

## Decision

- The guide is removed: its pages (`guia/`, `en/guide/`), the old help addresses (`ayuda/`, `en/help/`), its drawings (`img/guide/`) and its styles. The home page no longer links it.
- In the app, «Más» no longer has «Guía», the «Para empezar» card offers only creating or joining a group, and the texts `guide`, `guidePath` and `howItWorks`, the `help` pictogram and `siteUrl` go with them.
- What the guide taught is to be taught by the app itself: what each one sees, a line where a screen is empty or a step is not obvious, and a first launch that leads straight into a group. That work follows this decision.

This supersedes [ADR-0083](0083-help-on-one-page.md) (the help; its removal of the practice stands), [ADR-0084](0084-guide-plate-by-plate.md) and [ADR-0085](0085-one-guide.md).

## Consequences

- There is no page to keep in step with the app. Old links to the guide or the help find nothing.
- What only happens outside the app (setting up a radio, installing a server) is documented for whoever does it, in the repository (`docs/hardware.md`, `deploy/`), not for the app's users.
