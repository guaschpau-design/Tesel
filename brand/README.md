# Brand

The Tesel mark, wordmark and lockups ([ADR-0095](../docs/decisions/0095-pin-of-four-tiles-logo.md), with the rounder head and wider joints of [ADR-0116](../docs/decisions/0116-rounder-head-wider-joints.md)).

| File                   | What                                                                                                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mark.svg`             | A map pin made of four tiles: a square on its corner, rounded into the pin's head and cut in four by wide joints, the lower tile, lime, its point. Tiles take `currentColor` |
| `wordmark.svg`         | "Tesel" in Outfit SemiBold, as outlines: no font needed                                                                                                                      |
| `lockup.svg`           | Mark and wordmark side by side, ink, for paper                                                                                                                               |
| `lockup-pale.svg`      | The same, pale, for ink: the headers of the app (imported from here) and of the site (`apps/site/img`, a copy)                                                               |
| `lockup-stacked.svg`   | Mark above wordmark, ink, for print and pictures                                                                                                                             |
| `build.py`             | Rebuilds the SVGs and the site's copy (`python3 brand/build.py`; standard library only)                                                                                      |
| `wordmark-glyphs.json` | The outlines and spacing of "Tesel" in Outfit SemiBold, which `build.py` reads                                                                                               |
| `extract-wordmark.py`  | Writes `wordmark-glyphs.json` from the font; needed only to change the typeface or weight (fontTools and HarfBuzz)                                                           |

The app icons are rendered from the mark with `pnpm --filter @tesel/web icons` (`apps/web/scripts/render-icons.js`), which also stamps the icons' version in the pages that link them.

Colours, in `colors.json`, shared with the app and the site ([ADR-0020](../docs/decisions/0020-colour-and-symbols.md)): graphite ink `#18191b`, pale `#ebedeb`, signal lime `#99c938`, and its deep shade `#49660e` for text and lines on light backgrounds. The tiles are pale on ink and ink on paper; the point is always signal lime. In the lockup the mark is 1.22 times the height of the l and centred on it, so the point hangs below the baseline like a descender, and 0.28 of its height away from the word. Keep clear space of at least one tile around it. Below 22 pixels tall, use the mark alone; it reads down to 16.

Outfit is © 2021 The Outfit Project Authors, under the SIL Open Font License 1.1.
