# 0087. The app explains itself where it is used

- Status: Accepted
- Date: 2026-11-01

## Context

With no guide ([ADR-0086](0086-no-guide.md)), the app has to teach itself. A walk through it as a newcomer showed where it did not. After choosing a name, the user was left on an empty map seen from a hundred kilometres up, with a card offering what the groups panel offers too. Creating a group asked about a "server". Inviting began with "Joins as member / coordinator" and showed the raw link. The most useful card of the map, a point with its distance, "Guide me", "Mark" and "Task here", opened only on a press and hold nothing hinted at. This device's dot had no name, while every other one had. The connection was a dot and a sign, with no word. Empty places said only "No messages yet" or "No tasks to do", not what they were for; "Add" listed "Report" with nothing to say what a report is. Words such as "Organise", "Trails", "Encrypted log", "Accuracy ±5 m · good" or a device ID at the foot of the settings were the app's, not the user's. Choosing what an SOS is about meant opening a list. Me showed status, profile, battery, radio, position, precision and a long list of equipment at once, and the layers' on and off differed by a shade.

## Decision

- **The first minute.** After the name, the groups panel opens on the two ways into a group, rather than the empty map; arriving through an invitation still joins in the same step. While that panel is open, the map's start card waits. Creating a group asks only its name; the server folds under "Advanced options".
- **Inviting.** The QR code comes first, with sharing and copying the link; below, a switch to invite someone as coordinator; the link itself folds away.
- **The map.** A tap on an empty part of the map closes what is open or, with nothing open, shows that point: the press and hold is gone (`map/long-press.ts`), and `MapTaps.onPlace` hands taps on no feature to the workspace. This device's dot is named "You" (`map/name-label.ts` writes it as the members' names are written). The connection says in a word whether the group is reached: "Online", "By radio", "Connecting…", "No connection" (`linkWord`).
- **Each place says what it is for.** The chat, the tasks, the reports, the diary and the teams say, while empty, what they will hold and how to begin. Each option of "Add" has a line under its name.
- **Plain words.** "Teams and safety" for "Organise", "Where they have been" for "Trails", "Backup copy" for "Encrypted log", "Last contact", "GPS: good (±5 m)"; the settings no longer show the device ID.
- **SOS.** What is happening is chosen on tiles, one tap each, as a marker's symbol is (`ui/ChoiceTiles.svelte`, now the one way the app draws such a choice).
- **Me.** Status, position and tasks first; profile, battery, radio and equipment fold under one line that sums them up. Someone else's card keeps them in view, in the same order.
- **Layers.** Two groups, "From the group" and "Map information", and a tile that is on is ticked as well as lit.

What only a coordinator does stays out of a member's way, as before: inviting, teams and the check-in, planning sweeps, the operation area, cancelling another's SOS.

This amends [ADR-0070](0070-a-simpler-app.md) (the way to start) and [ADR-0071](0071-panels-read-whole.md) (Me folds what is seldom changed).

## Consequences

- Nobody lands on an empty map, and the most useful card of the map is one tap away.
- A tap on the map that used to do nothing now opens a card; tapping again elsewhere closes it.
- Every empty state and every label is now part of what teaches the app: a new feature is not finished until its empty state says what it is for.
