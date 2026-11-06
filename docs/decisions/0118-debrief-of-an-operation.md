# 0118. The debrief of an operation, as a PDF of the hours chosen

- Status: Accepted
- Date: 2026-11-06

## Context

Whoever coordinates a team has to account for an operation afterwards: to a town council, an insurer or their own organisation. The diary (ADR-0022) holds everything that happened, but it downloads as plain text of the whole group's life, and an operation has no beginning or end in the app: groups last, and one group may serve many operations. Asking people to press "start" and "stop" would be one more thing to learn and to forget, and the app is to explain itself without a manual (ADR-0086).

## Decision

- **One option, "Informe", folded in the diary, for whoever coordinates only.** It holds two date-and-time fields, "Desde" and "Hasta", and a button that downloads the debrief as a PDF. Nothing starts or ends an operation; the hours chosen are the operation.
- **The fields start filled in with the group's last spell of activity**: from its first diary line after the last quiet of at least six hours to its last line, the end taking in its whole minute. Most often the debrief is one tap away; other hours are typed over. They are filled in again each time the fold is opened.
- **What the debrief holds**: the group, the period and when it was made; a summary (who did anything, how many diary entries, calls for help, tasks done and field reports); then every diary line of the period with its time, author, text and place in the chosen coordinate format; a page number on every page.
- **The PDF is written by the app itself** (`apps/web/src/lib/pdf/`), with no library: A4 pages of text and lines in the standard Helvetica fonts that every PDF reader has, so no font is embedded and the file is a few kilobytes. Text is written in their WinAnsiEncoding (Windows-1252), which holds the languages of Tesel's users; the circled numbers that tell apart members of the same name (ADR-0110) become "(2)", and any other character those fonts lack becomes "?". Lines are broken with the fonts' own widths.
- **In the code it is the "debrief"**, to keep it apart from a field report ("parte", `reports/`), which it counts.

## Consequences

- A coordinator gets a document to hand over in two taps, with no new button in the dock and nothing to start or stop.
- The debrief is made on the device and works offline, like the diary it comes from; its times are those of the device that made it, as the text diary's are.
- The PDF has no map. Drawing one would need tiles in the file and a renderer, which this small writer does not have; the places are written as coordinates.
- Names or messages in scripts outside Windows-1252 (Cyrillic, Arabic, emoji) show as question marks. Embedding a font that covers them would make every file far larger; it can be revisited if users who write them appear.
