# Extracts the outlines of "Tesel" in Outfit SemiBold into wordmark-glyphs.json, for build.py.
#
#   pip install fonttools brotli uharfbuzz
#   python3 brand/extract-wordmark.py path/to/outfit-latin-600-normal.woff2
#
# Run it only to change the wordmark's typeface or weight: build.py reads the JSON and needs
# nothing but Python's standard library. The font comes from the @fontsource/outfit package
# (npm pack @fontsource/outfit), files/outfit-latin-600-normal.woff2. Outfit is © 2021 The Outfit
# Project Authors, under the SIL Open Font License 1.1, which leaves artwork drawn with it, such as
# a logo, free of the licence (ADR-0095).
import json
import os
import sys

import uharfbuzz
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTFont

WORD = 'Tesel'
HERE = os.path.dirname(os.path.abspath(__file__))


def main(font_path):
    font = TTFont(font_path)
    glyphs = font.getGlyphSet()

    # Shape the word with HarfBuzz, so the letters sit where the typeface's kerning puts them.
    blob = uharfbuzz.Blob(font_bytes(font))
    shaper = uharfbuzz.Font(uharfbuzz.Face(blob))
    buffer = uharfbuzz.Buffer()
    buffer.add_str(WORD)
    buffer.guess_segment_properties()
    uharfbuzz.shape(shaper, buffer, {'kern': True, 'liga': False})

    letters, x = [], 0
    for info, position in zip(buffer.glyph_infos, buffer.glyph_positions):
        name = font.getGlyphName(info.codepoint)
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(pen)
        ink = BoundsPen(glyphs)
        glyphs[name].draw(ink)
        start = x + position.x_offset
        letters.append({'glyph': name, 'x': start, 'inkLeft': start + ink.bounds[0],
                        'inkRight': start + ink.bounds[2], 'top': ink.bounds[3], 'd': pen.getCommands()})
        x += position.x_advance

    data = {
        'word': WORD,
        'font': 'Outfit SemiBold (600), @fontsource/outfit, SIL Open Font License 1.1',
        'unitsPerEm': font['head'].unitsPerEm,
        'note': 'Font units, y pointing up, baseline at 0. x is where each letter starts; inkLeft '
                'and inkRight are where its ink starts and ends, and top is its highest point.',
        'xHeight': font['OS/2'].sxHeight,
        'letters': letters,
    }
    with open(os.path.join(HERE, 'wordmark-glyphs.json'), 'w') as out:
        json.dump(data, out, indent=2)
        out.write('\n')
    print(f'wordmark-glyphs.json written: {WORD}, {len(letters)} letters, advance {x}')


def font_bytes(font):
    """The font as a plain TrueType file, which HarfBuzz reads (the package ships WOFF2)."""
    font.flavor = None
    path = os.path.join(HERE, '.outfit.ttf')
    font.save(path)
    with open(path, 'rb') as file:
        data = file.read()
    os.remove(path)
    return data


main(sys.argv[1])
