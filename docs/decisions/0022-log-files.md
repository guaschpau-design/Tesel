# 0022. Carry a group's log in files of sealed envelopes

- Status: Accepted, amended by [0055](0055-forget-outlived-positions.md) (a log file leaves out the positions the trails have outlived) and [0134](0134-a-simpler-diary.md) (no diary as text; the backup copy is in the groups panel)
- Date: 2026-10-26

## Context

After an operation a team writes a report, and needs what happened in order. During one, some devices may never share a link: a phone that only had the radio, whose airtime budget dropped old positions and history, or a laptop at a command post that was never online with the rest. Moving events between them by hand — a file on a memory stick, a message — fills the gaps that links could not.

## Decision

- Core keeps a **journal**: every event except positions, in the order every device agrees on. The app turns it into the operation diary, in the user's language, and saves it as plain text for reports, with coordinates in the user's format.
- A device can save the group's whole **log** to a file and load such a file: protocol §10. The file is JSON listing the group ID and one envelope per event, sealed exactly as for a relay (§5.1). Loading it is like receiving those envelopes from a relay: envelopes that do not open are dropped, events already known are skipped, new ones are applied and passed on to the server.
- The log file reveals what a relay sees and no more; the diary text is plaintext and is for the people who write the report.

## Consequences

- Backups, merges after radio-only work and transfers to a command post need no new transport and no server.
- A log file is as sensitive as the group secret is safe: anyone with an invitation can read it. A diary text is readable by anyone who gets it, as any report.
- Positions are left out of the diary; trails and the log carry them. A GPX or KML export of trails and objects is planned separately (docs/hoja-de-ruta.md).
