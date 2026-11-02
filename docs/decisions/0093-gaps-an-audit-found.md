# 0093. Close the gaps an audit of the whole code found

- Status: Accepted
- Date: 2026-11-02

## Context

The whole code was reviewed area by area: members and positions, objects and sweeps, the radio and sync, the map and its tiles, incidents and coordinates, the app's shell, the protocol and its scheduler, the server and its deployment, and the simulator and site. Most of what was found were defects with an obvious repair, fixed without a decision of their own. A few repairs change what the app or the server does, and are recorded here.

## Decision

- **Radio.** A link that drops and comes back is linked to the group again with no one doing anything: the link goes straight from ready to connecting, never through disconnected. A late answer on a dropped connection no longer closes the new one, and a write the system refuses drops the link at once. A radio can be disconnected while it reconnects ([ADR-0090](0090-pairing-a-radio-from-the-app.md)).
- **Airtime.** Once a packet waits for room in its budget, nothing less urgent on that budget goes before it, so a large SOS is never starved by small positions. An acknowledgement heard on the air for an event is not sent again by this device or bridged.
- **Sweeps.** An area counts as cleared only when every strip it was planned with is there and done. Deleting an area removes its sweep with it, and deleting a strip removes it as removing a sweep does, its tasks cancelled; only whoever coordinates does either. A strip followed in navigation measures the team's progress when it is the team's.
- **Teams** hold at most 28 members, as many as fit in one `TEAM` event with the longest name (§3.15, `TEAM_MAX_MEMBERS`). The form stops at 28, and a team too large is refused before any other team is rewritten.
- **Shapes.** Points tapped or read from a file that are too far apart to send (§3.7) get points in between. A shape so wide that it would need more than 64 points is refused with a message saying so, rather than "could not send".
- **Positions.** Leaving a group hides this device's position from it first, waiting up to 5 seconds for that to go out. Turning sharing off stops reporting before the choice is stored. An SOS sent with no place is drawn at the position its caller shared at most 10 minutes before it, or after; one shared earlier says little of where they are. The position that follows such a call is not sent once the call is cancelled, and the GPS is let go after 15 minutes without a fix.
- **Alarms.** Every SOS that arrives together raises one alarm, with a notification for each; sound the system suspended is resumed first.
- **Updates.** A new version taking over another window reloads it only once no own SOS is open and no radio is linked there; until then it offers to.
- **Protocol text.** Half of a surrogate pair is refused rather than silently sent as U+FFFD.
- **Server.** What clients may leave unread is shared out: 256 MB in all, between 256 KB and 1 MB a connection. Only a pong that echoes the server's own ping keeps a connection alive. Old envelopes are deleted 5 000 at a time, the first time once the server answers. Weather outlines that fail to download are tried again within the hour.
- **Deployment.** `update.sh` passes the image it starts to Compose explicitly: the timer loads `.env` into the environment, which Compose prefers to `.env`, so the image just written there was not the one started, and the health check and the way back judged the old one. Scheduled jobs have time limits (update 30 min, backup 2 h, map 6 h), and the site's policy allows no inline styles.

## Consequences

- A server installed before this change keeps the old `update.sh` until its installer runs again (`deploy/README.md`); until then an update can skip its health check.
- Left as they are, on purpose: the heartbeat follows a real fix only, so a device whose GPS went quiet is shown as growing old rather than as still there; an orthophoto tile is stored only when every part of it arrived, never half; IPv6 clients count by address, which is why the guide asks for no AAAA record; closing the offline maps panel still cancels a download; and the dependency advisories reported by `pnpm audit` reach no code Tesel runs on untrusted input.
- Several files remain over 300 lines (`group-feed.svelte.ts`, `ChatPanel.svelte`, `App.svelte`, `MapWorkspace.svelte`, `payloads.ts`); splitting them is structural work of its own.
