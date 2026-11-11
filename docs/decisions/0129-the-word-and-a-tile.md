# 0129. The logo: the word and a tile

- Status: Accepted
- Date: 2026-11-11
- Supersedes: [ADR-0095](0095-pin-of-four-tiles-logo.md) and [ADR-0116](0116-rounder-head-wider-joints.md)

## Context

The pin of four tiles (ADR-0095, ADR-0116) still did not convince the project owner. On 11 November 2026 he looked at six new directions (an inner T, a T of tiles, a mesh, a hexagon, a grid of people and the word alone) and chose the word alone. Of five variations of it (lower case, capitals, the tile before, turned or raised), he kept the first one as it was.

## Decision

- **The logo is the word "Tesel" followed by a lime tile**, a rounded square standing on the baseline as a full stop: the place, a tile of the mosaic, the end of the sentence. The word stays in Outfit SemiBold, kept as outlines. In ems of the type, the tile is 0.222 wide, rounded 0.042, and 0.142 from the l's ink.
- **The mark, where the word does not fit**, is a T of two rounded bars with the lime tile at the foot of its stem, on the same line: the logo's first letter and its tile. It is drawn in a 100-unit box with a margin round it (the T and tile span 72 of its 100 units), so icons lay it on their ground as it is.
- The colours are those of [ADR-0113](0113-graphite-and-device-lime.md): the letters pale on ink and ink on paper, the tile always signal lime.
- `brand/build.py` writes `logo.svg`, `logo-pale.svg` and `mark.svg`; the lockups of the pin (`lockup*.svg`, `wordmark.svg`) are gone. The app icons, the favicon, Android's launcher, themed and status bar icons are rendered from `mark.svg`; the app's and the site's headers show `logo-pale.svg`, and the narrow top bar of a phone the mark; the report's PDF draws the mark.

## Consequences

- The logo is the name, read at once, with one small sign of its own; it needs no explanation and costs nothing to reproduce.
- The mark is a letter: it reads as Tesel's at 16 pixels, but on its own it says less than a pin did about places.
- The pictures of the site that show the logo (the link previews and the app's screenshots) were redrawn with it.
