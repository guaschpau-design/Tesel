# 0134. A simpler diary

- Status: Accepted
- Date: 2026-11-15

## Context

The diary panel held four things: a button that downloaded the diary as text, the debrief folded under "Informe" for whoever coordinates (ADR-0118), the list of what happened, and the group's backup copy folded at the foot (ADR-0022). The two buttons and the fold came before the list and pushed it down, and the list was a column of grey times over plain lines, where a call for help looked like a chat message. Pau found it held too much.

## Decision

The diary is for two things: reading what happened, and taking the report of it.

- **The list fills the panel**: by day, the newest first, each day named "Hoy", "Ayer" or its date (`diary-days.ts`). Each line has its time in a column of its own, the app's own sign for what it tells (a person, the chat, a point on the map, a task, a warning) and who did it over what they did. A call for help stands out in red.
- **One button at its foot, "Descargar informe (PDF)"**, for anyone in the group, not only whoever coordinates: under it, the hours it covers, the group's last spell of activity, and "Cambiar horas" to choose others (`DiaryReport`). This amends ADR-0118.
- **The diary as text is gone**: the report says the same, and better. This amends ADR-0022.
- **The backup copy moves to the groups panel**, folded under the group in use, before "Salir del grupo" (`GroupBackup`): it is the group's, not the diary's.

## Consequences

- The diary opens on what happened; the report is one tap away for anyone.
- A plain-text diary can no longer be downloaded; the PDF report is the one document of an operation.
