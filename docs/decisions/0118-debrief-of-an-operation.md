# 0118. The debrief of an operation, as a PDF of the hours chosen

- Status: Accepted
- Date: 2026-11-06

## Context

Whoever coordinates a team has to account for an operation afterwards: to a town council, an insurer or their own organisation. The diary (ADR-0022) holds everything that happened, but it downloads as plain text of the whole group's life, and an operation has no beginning or end in the app: groups last, and one group may serve many operations. Asking people to press "start" and "stop" would be one more thing to learn and to forget, and the app is to explain itself without a manual (ADR-0086).

## Decision

- **One option, "Informe", folded in the diary, for whoever coordinates only.** It holds two date-and-time fields, "Desde" and "Hasta", and a button that downloads the debrief as a PDF. Nothing starts or ends an operation; the hours chosen are the operation.
- **The fields start filled in with the group's last spell of activity**: from its first diary line after the last quiet of at least six hours to its last line, the end taking in its whole minute. Most often the debrief is one tap away; other hours are typed over. They are filled in again each time the fold is opened.
- **What the debrief holds.** A first page that sums it up: a graphite band with the mark, the group, the day, the hours and how long it lasted; the key figures (people, calls for help, tasks done of those moved, field reports, messages, distance walked); the map of the operation; and bars of how many diary lines each stretch holds, red where a call for help was made. Then each call for help as a card (who, what, when, where, who received it and how many seconds later, who closed it), the tasks with whom they were for, where they stood at the end of the period and how long they took, the people with their team, distance and status at the end, the field reports, and the whole diary of the period as a timeline whose dots say what kind of thing each line is. Every page but the first has a running header; all have a footer with the page number.
- **The map is drawn to scale with no base map**: each person's way in the period in a colour of their own, from where they started to where they were at the end; the calls for help; markers, zones and task places; a grid, a scale bar and north. Ways come from the trails each device keeps, the last six hours of each member (ADR-0055).
- **The PDF is written by the app itself** (`apps/web/src/lib/pdf/`), with no library, Tesel's mark drawn from `brand/mark.svg`: A4 pages of text and vector drawings in the standard Helvetica fonts that every PDF reader has, so no font is embedded and the file is a few kilobytes. Text is written in their WinAnsiEncoding (Windows-1252), which holds the languages of Tesel's users; the circled numbers that tell apart members of the same name (ADR-0110) become "(2)", and any other character those fonts lack becomes "?". Lines are broken with the fonts' own widths.
- **In the code it is the "debrief"**, to keep it apart from a field report ("parte", `reports/`), which it counts.

## Consequences

- A coordinator gets a document to hand over in two taps, with no new button in the dock and nothing to start or stop.
- The debrief is made on the device and works offline, like the diary it comes from; its times are those of the device that made it, as the text diary's are.
- The map has no base map: tiles in the file would need a renderer this small writer does not have, and would make it far larger. Places are also written as coordinates, in the format chosen.
- A person's way covers only the hours their device still keeps, at most the last six; an older period shows fewer ways.
- Names or messages in scripts outside Windows-1252 (Cyrillic, Arabic, emoji) show as question marks. Embedding a font that covers them would make every file far larger; it can be revisited if users who write them appear.
