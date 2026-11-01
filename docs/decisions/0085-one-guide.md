# 0085. One guide: the help and the guide become one page

- Status: Superseded by [0086](0086-no-guide.md)
- Date: 2026-11-01

## Context

The site had two pages to learn the app: the help on one page ([ADR-0083](0083-help-on-one-page.md)), with the app's screen drawn with numbers and the usual things as taps, and the guide in plates ([ADR-0084](0084-guide-plate-by-plate.md)). They said much the same twice, in two places to keep in step, and the app and the site had to offer both. The guide, at about 1,700 visible words, was still long to read.

## Decision

- There is one page, the **guide** (`guia/`, `en/guide/`). Its first plate is the help's drawing of the screen (now `img/guide/screen.svg`) with the nine numbers and a line for each. Then eleven plates: getting started, the group, Me, talking, marking the ground, tasks and sweeps, SOS, finding your way, without internet, the diary, security; then the settings and what to do when something fails. "What Tesel is" and "Tesel does not replace 112" become the cover's lead.
- Each plate is shorter: a lead of a few words, at most three moves, most of them only the taps, and the rest folded under «Detalles», where nothing the guide said before is lost. About 700 words are in view, against 1,700.
- In the app, «Más» → «Guía» opens it (in place of «Ayuda»), and so does «Cómo funciona» on the «Para empezar» card. The settings no longer link it at their foot: the menu does. On the site, the top bar shows «Guía» only.
- `ayuda/` and `en/help/` stay as pages that send to the guide at once (a refresh, with no script), because copies of the app installed before still open them.

This amends [ADR-0083](0083-help-on-one-page.md) and [ADR-0084](0084-guide-plate-by-plate.md).

## Consequences

- One place to read and to keep up to date. Printed, the guide takes four A4 sheets; the first is the screen with its numbers.
- The app's texts lose `help` and `helpPath`; `guide` now reads «Guía» / "Guide".
