# 0070. A simpler app: one place to add, no alerts or roll calls, a way to start

- Status: Accepted, amended by [0071](0071-panels-read-whole.md) (Me and the layers unfolded), [0078](0078-one-look-and-straight-to-the-point.md) (the coordinate format in Settings) and [0081](0081-found-in-a-tap-or-two.md) (the tasks list)
- Date: 2026-10-29

## Context

A review of the app, screen by screen at a phone's width, found it harder than it needs to be. A newcomer sees an empty map with nothing saying what to do next. New things start in three places: "Add" for what is drawn, the task list for tasks, the chat's "+" for reports, alerts and roll calls. Alerts and roll calls overlap with the chat and the SOS and are seldom what a small team needs, while each brings banners, answers, an alarm and texts of its own. The chat does not say when something new has arrived. The groups panel mixes who is in the group with organising it and leaving it, and ends with a device ID nobody needs there. A point of the map opens on its coordinates and a format drop-down rather than on what can be done there. The layers panel lists eleven switches, Me opens on a profile told once, the symbols of a marker fill the screen, and nothing confirms that what was sent has gone.

## Decision

- The app neither sends nor shows alerts and roll calls. `ALERT` and `ROLL_CALL` stay in the protocol and the radio still treats them as urgent, so that other clients may use them; the app's diary leaves them out. The practice's coordinator warns in the chat instead, and its guide asks a coordinator to talk to the team.
- "Add" is where every new thing starts: a marker, a route, a zone, a task or a report. A report has its own panel; the reports tab of the chat still opens it. The chat writes in one row, with no menu beside it.
- The chat's button counts the lines and reports of others not shown yet; the group keeps on the device how many it has shown.
- With no group, a card on the map offers the three ways to start: create a group, join one, practise alone. Each opens the groups panel on it.
- The groups panel shows the group's members and the invitation first; whoever coordinates finds the teams and the check-in in an "Organise" fold below; leaving comes last, apart. The device's alias and ID move to Settings, with the link to the guide.
- A point of the map opens on how far it is, what can be done there and what is known of it; its coordinates are one small line that copies them with a tap. The coordinate format is chosen in Me only.
- The layers panel shows the five layers most used; the rest wait under "More layers". Me opens on the status; the profile is folded. A marker's symbols are a grid of tiles with short names, the most used first. An empty task list says what tasks are for.
- Saving a marker, a zone, a route, a task or a report, or finishing a task, says in a short notice whether it reached the group, went by radio or waits on the phone.
- Forms are left with "Cancel"; confirmations with "Back", so that "Cancel" never stands beside "Cancel SOS"; the invitation with "Done". The top bar is slimmer, its connection told by signs on a phone.

This supersedes, for the app, [ADR-0026](0026-one-kind-of-alert.md) and [ADR-0028](0028-roll-call.md), and amends [ADR-0047](0047-alarms-and-notices.md) (only an SOS raises the alarm), [ADR-0063](0063-situation-reports.md), [ADR-0065](0065-room-for-what-is-read.md) and [ADR-0066](0066-practice-situations.md).

## Consequences

- Fewer things to learn: one button to add anything, one way to tell the team something (the chat), one call for help (SOS).
- A coordinator who wants every member's answer at once has no roll call: they ask in the chat. If teams miss it, it can come back, as the protocol keeps it.
- Logs from apps that sent alerts or roll calls still load; those lines are just not shown.
