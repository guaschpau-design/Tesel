# 0062. Teams: one event per team, and a task for a team is each member's

- Status: Accepted, amended by [0099](0099-sealed-radio-frames.md) (25 members, as events shrank to 153 bytes)
- Date: 2026-10-28

## Context

Above a handful of people, work is handed out by team, not by person: "Norte, the ravine; Sur, the houses". A coordinator needs to make teams, move people between them and hand out tasks and strips of a sweep to a whole team, and everyone needs to see who is in which team at a glance. It must stay simple: a group, its teams, their people, and their tasks; a "mission" is a task for a team, not a level of its own.

## Decision

- A new event type, `TEAM` (docs/protocol.md §3.15), carries a team whole: an ID, a colour of six, whether it is dissolved, its members and its name. The newest of each team replaces the others; a member is in one team, the newest that lists them.
- A team's ID is 4 random bytes in the space of node IDs, so `TASK.assignee` can be a team without changing the task's layout; the creator never picks one the group already uses. A collision with a future member's node ID is as unlikely as the one `00000000` already accepts.
- Only whoever coordinates creates, changes and dissolves teams (a rule of the interface, as for alerts), in the group panel: the members are listed team by team, and a small form sets the name, the colour and who is in it. Moving someone into a team takes them out of the one they were in.
- A task for a team is a task of each member: it counts on their dock, they are told when it is handed, and it shows in their card. The colour of a team is that of its members on the map, of its line in their card and of the strips of sweeps it walks; planning a sweep starts with one strip per team, and how much of a strip is swept counts the trails of all its members.

## Consequences

- A team is one event of up to 165 bytes; with the longest name it holds 28 members.
- No team leaders, no nested teams, no chat per team: a team is a name, a colour and its people. They can come later, as fields of the same event type or new ones, if teams in the field ask for them.
- Dissolving a team leaves its tasks as they were, still named after it; whoever coordinates hands them to someone else if needed.
