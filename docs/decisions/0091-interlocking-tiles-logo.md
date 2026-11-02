# 0091. The logo: two interlocking tiles and a drawn wordmark

- Status: Superseded by [0095](0095-pin-of-four-tiles-logo.md)
- Date: 2026-11-01

## Context

The first logo was three hexagonal tiles, one lit in lime, beside "Tesel" set in Archivo ([ADR-0020](0020-colour-and-symbols.md)). On 1 November 2026 the project owner chose a new design: two square tiles that interlock at a corner, held by a lime key in the slot where they meet, beside "Tesel" in square letters with rounded shoulders. The design came as a picture, not as vectors, and its letters are those of no open typeface: the nearest (Orbitron, Exo 2, Oxanium) are too wide, too round or too angular.

## Decision

- The mark and the wordmark are drawn as vectors by `brand/build.py`, from the design's own proportions: the tiles' frames a quarter of their side, a slot along the diagonal where they meet, a key a little narrower than the slot; letters with capitals 100 units tall, x-height 72, stems 17 and bars 14, outer shoulders of radius 21. The wordmark is drawn from lines and arcs, not converted from a font, so the build needs only Python's standard library.
- The colours do not change: the tiles are pale on ink and ink on paper, and the key is signal lime, as the lit tile was.
- Everything that shows the logo comes from these files: the app's header (`lockup-pale.svg`, and the mark alone on narrow screens), the site's header and footer (its copy of the lockup), the app icons, favicons and touch icon, which `render-icons.js` renders and versions again, and the screenshots of the app on the site, taken anew.
- The map's markers keep their hexagonal tiles: they are map symbols, which the logo no longer has to echo.

## Consequences

- A change to the logo is a change to `brand/build.py`, then `python3 brand/build.py` and `pnpm --filter @tesel/web icons`; the site's screenshots of the app are taken again with the simulator (`apps/site/img/README.md`).
- The site's typeface stays Archivo; the wordmark no longer depends on it.
