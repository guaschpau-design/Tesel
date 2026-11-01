# Brand

The Tesel mark, wordmark and lockup ([ADR-0091](../docs/decisions/0091-interlocking-tiles-logo.md)).

| File              | What                                                                                                                                                                               |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mark.svg`        | Two square tiles interlocking at a corner, held by a lime key in the slot where they meet: pieces of a tessellation, places on a map, radios linked. The tiles take `currentColor` |
| `wordmark.svg`    | "Tesel" in square letters with rounded shoulders, drawn from lines and arcs: no font                                                                                               |
| `lockup.svg`      | Mark and wordmark side by side, ink, for paper                                                                                                                                     |
| `lockup-pale.svg` | The same, pale, for ink: the headers of the app (imported from here) and of the site (`apps/site/img`, a copy)                                                                     |
| `build.py`        | Rebuilds the SVGs and the site's copy (`python3 brand/build.py`; standard library only)                                                                                            |

The app icons are rendered from the mark with `pnpm --filter @tesel/web icons` (`apps/web/scripts/render-icons.js`), which also stamps the icons' version in the pages that link them.

Colours, in `colors.json`, shared with the app and the site ([ADR-0020](../docs/decisions/0020-colour-and-symbols.md)): ink `#10202c`, pale `#e6ebe8`, signal lime `#c8f04a`, and its deep shade `#4d6e00` for text and lines on light backgrounds. The tiles are pale on ink and ink on paper; the key is always signal lime. In the lockup the mark is a third taller than the capitals and a quarter of their height away from them. Keep clear space of at least the width of a tile's frame around it.
