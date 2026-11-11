# 0095. The logo: a pin of four tiles beside "Tesel" in Outfit

- Status: Superseded by [0129](0129-the-word-and-a-tile.md)
- Date: 2026-11-02

## Context

The logo of [ADR-0091](0091-interlocking-tiles-logo.md), two interlocking square tiles, read as a link or a puzzle piece rather than as a place, and turned into a blot at favicon size. On 2 November 2026 the project owner chose a new mark after several rounds of drafts: a map pin made of tiles, simple enough to scale from a poster down to 16 pixels. The square letters of the old wordmark did not sit with its rounded head, so the word had to change with it.

## Decision

- The mark is a square stood on its corner and cut into four tiles by two joints. The three upper tiles round their outer corners into the pin's head; the lower one, signal lime, keeps its corner as the pin's point: the place. In a 90-unit box the square's diagonal is the box, the joints are 5 wide, the head's corners have a radius of 22, the corners along the joints 2.5 and the point 1.5.
- The wordmark is "Tesel" in Outfit SemiBold, a geometric sans whose round bowls echo the head of the pin and whose even stroke matches the flat tiles, set 1.5 % tighter than the typeface's own spacing and kerning. Its outlines are extracted once into `brand/wordmark-glyphs.json` (`brand/extract-wordmark.py`, which needs fontTools and HarfBuzz), so `brand/build.py` still needs only Python's standard library and no font is shipped. Outfit is under the SIL Open Font License 1.1, which does not reach artwork drawn with the font.
- Side by side, the mark is 1.22 times the height of the l and centred on it, so it reaches as far above the word as its point hangs below the baseline, like a descender; between them, 0.28 of the mark's height. Stacked (`lockup-stacked.svg`, for print and pictures), the word is 1.7 times as wide as the mark and a third of the mark's height below it. Clear space around either is one tile.
- The colours do not change: tiles pale on ink and ink on paper, the point always signal lime. The site keeps Archivo for its text.
- Everything that showed the logo follows, as ADR-0091 set out: the app's header, the site's header and footer, the app icons, favicons and touch icon (`render-icons.js`), the pictures for shared links and the screenshots of the app on the site.

## Consequences

- A change to the mark or the spacing is a change to `brand/build.py`; a change of typeface or weight, a new run of `extract-wordmark.py`. Then `python3 brand/build.py` and `pnpm --filter @tesel/web icons`, and the site's pictures again (`apps/site/img/README.md`).
- The mark is square, so it fills app icons and favicons better than the old one and stays legible at 16 pixels, where the head and the lime point are still told apart.
