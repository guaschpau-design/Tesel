# Brand

The Tesel logo and mark ([ADR-0129](../docs/decisions/0129-the-word-and-a-tile.md)).

| File                   | What                                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logo.svg`             | The logo: "Tesel" in Outfit SemiBold, as outlines (no font needed), and after it a lime tile standing on the baseline, as a full stop. Ink, for paper                              |
| `logo-pale.svg`        | The same, pale, for ink: the headers of the app (imported from here) and of the site (`apps/site/img`, a copy)                                                                     |
| `mark.svg`             | The mark, for where the word does not fit (app icons, favicon, the top bar of a narrow screen): a T with the lime tile at the foot of its stem. Pale, with its T in `currentColor` |
| `build.py`             | Rebuilds the SVGs and the site's copy (`python3 brand/build.py`; standard library only)                                                                                            |
| `wordmark-glyphs.json` | The outlines and spacing of "Tesel" in Outfit SemiBold, which `build.py` reads                                                                                                     |
| `extract-wordmark.py`  | Writes `wordmark-glyphs.json` from the font; needed only to change the typeface or weight (fontTools and HarfBuzz)                                                                 |

The app icons are rendered from the mark with `pnpm --filter @tesel/web icons` (`apps/web/scripts/render-icons.js`), which also stamps the icons' version in the pages that link them.

Colours, in `colors.json`, shared with the app and the site ([ADR-0020](../docs/decisions/0020-colour-and-symbols.md)): graphite ink `#18191b`, pale `#ebedeb`, signal lime `#99c938`, and its deep shade `#49660e` for text and lines on light backgrounds. The letters are pale on ink and ink on paper; the tile is always signal lime. In the logo the tile is 0.222 of the type's em wide, rounded 0.042, and 0.142 from the l's ink. Keep clear space of at least one tile around it. Below 16 pixels tall, use the mark.

Outfit is © 2021 The Outfit Project Authors, under the SIL Open Font License 1.1.
