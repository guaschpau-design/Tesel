# Builds the Tesel mark, wordmark and lockups as SVG, into this folder.
#
#   python3 brand/build.py
#
# The mark is a map pin made of four tiles: a square stood on its corner and cut into four, its
# three upper tiles rounded into the pin's head and the lower one, lime, its point: the place. The
# wordmark is "Tesel" in Outfit SemiBold, kept as outlines in wordmark-glyphs.json
# (extract-wordmark.py), so this build needs only Python's standard library and no font. The design
# is of 2 November 2026 (ADR-0095), with the rounder head and wider joints of 4 November (ADR-0116).
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
# The brand's colours, shared with the app and the site (a test keeps them in step).
with open(os.path.join(HERE, 'colors.json')) as colors_file:
    COLORS = json.load(colors_file)
INK, PALE, SIGNAL = COLORS['ink'], COLORS['pale'], COLORS['signal']
with open(os.path.join(HERE, 'wordmark-glyphs.json')) as glyphs_file:
    GLYPHS = json.load(glyphs_file)

# ---------------------------------------------------------------------------------------------
# The mark, in a 90 x 90 box: a square whose diagonal is the box, turned 45 degrees about its
# centre and cut into four tiles by two joints. The head is not rounded tile by tile: the whole
# square is, at its three upper corners, so its rounding (wider than a tile) runs across the joints
# as one outline, the pin's, and the tiles are cut out of it as a mosaic is.

MARK = 90
SIDE = MARK / math.sqrt(2)  # the side of the whole square
JOINT = 9  # the width of the joints between the tiles
TILE = (SIDE - JOINT) / 2
HEAD = 29  # the rounding of the square's three corners that make the pin's head
INNER = 2.5  # the rounding of the tiles' corners along the joints
POINT = 1.5  # the rounding of the pin's point, just enough not to be sharp
ORIGIN = (MARK - SIDE) / 2  # the square's top left corner, before it turns
OUTLINE_ID = 'tesel-pin'


def tile(column, row, fill):
    """One tile of the square before it turns: (0, 0) top left ... (1, 1) bottom right, which the
    turn brings to the bottom, as the point. Its corner on the square's edge is left square, for
    the outline to round; the others are rounded along the joints."""
    x = ORIGIN + column * (TILE + JOINT)
    y = ORIGIN + row * (TILE + JOINT)
    outer = {(0, 0): 'top_left', (1, 0): 'top_right', (0, 1): 'bottom_left', (1, 1): 'bottom_right'}
    radii = {corner: INNER for corner in ('top_left', 'top_right', 'bottom_right', 'bottom_left')}
    radii[outer[(column, row)]] = 0
    return f'<path d="{rounded_square(x, y, TILE, radii)}" fill="{fill}"/>'


def mark():
    outline = rounded_square(ORIGIN, ORIGIN, SIDE, {'top_left': HEAD, 'top_right': HEAD,
                                                     'bottom_right': POINT, 'bottom_left': HEAD})
    tiles = tile(0, 0, 'currentColor') + tile(1, 0, 'currentColor') + tile(0, 1, 'currentColor')
    point = tile(1, 1, SIGNAL)
    return (f'<defs><clipPath id="{OUTLINE_ID}"><path d="{outline}"/></clipPath></defs>'
            f'<g transform="rotate(45 {MARK / 2} {MARK / 2})" clip-path="url(#{OUTLINE_ID})">{tiles}{point}</g>')


def rounded_square(x, y, side, r):
    """A square with a radius per corner (0 leaves the corner square), clockwise from the top left."""
    tl, tr, br, bl = r['top_left'], r['top_right'], r['bottom_right'], r['bottom_left']

    def arc(radius, to_x, to_y):
        return f'A{radius} {radius} 0 0 1 {fmt(to_x)} {fmt(to_y)} ' if radius else ''

    return (f'M{fmt(x + tl)} {fmt(y)} H{fmt(x + side - tr)} {arc(tr, x + side, y + tr)}'
            f'V{fmt(y + side - br)} {arc(br, x + side - br, y + side)}'
            f'H{fmt(x + bl)} {arc(bl, x, y + side - bl)}'
            f'V{fmt(y + tl)} {arc(tl, x + tl, y)}Z')


# ---------------------------------------------------------------------------------------------
# The wordmark, from the outlines of wordmark-glyphs.json.

TRACKING = -0.015  # of the em: a little tighter than the typeface sets it, as for a heading
LETTERS = GLYPHS['letters']
EM = GLYPHS['unitsPerEm']
ASCENDER = max(letter['top'] for letter in LETTERS)  # the top of the l


def letter_offset(index):
    """Where letter `index` starts, in font units, with the tracking."""
    return LETTERS[index]['x'] + index * TRACKING * EM


INK_LEFT = LETTERS[0]['inkLeft']
INK_RIGHT = LETTERS[-1]['inkRight'] + (len(LETTERS) - 1) * TRACKING * EM


def wordmark(x, baseline, height):
    """The word with the top of its l `height` above `baseline`, its ink starting at `x`."""
    k = height / ASCENDER
    paths = ''.join(f'<path transform="translate({fmt(letter_offset(i))} 0)" d="{letter["d"]}"/>'
                    for i, letter in enumerate(LETTERS))
    return (f'<g transform="translate({fmt(x - INK_LEFT * k)} {fmt(baseline)}) scale({fmt(k, 5)} {fmt(-k, 5)})" '
            f'fill="currentColor">{paths}</g>')


def word_width(height):
    return (INK_RIGHT - INK_LEFT) * height / ASCENDER


# ---------------------------------------------------------------------------------------------
# The lockups. Side by side, the mark is 1.22 times as tall as the l and centred on it, so it
# reaches as far above the word as below its baseline, where the point hangs like a descender;
# between them, 0.28 of the mark's height. Stacked, the word is 1.7 times as wide as the mark and
# a third of the mark's height below it. Clear space around either: one tile.

MARK_OVER_WORD = 1.22
SPACING = 0.28
STACKED_WIDTH, STACKED_SPACING = 1.7, 1 / 3


def lockup(color):
    word_h = MARK / MARK_OVER_WORD
    x = MARK + SPACING * MARK
    baseline = (MARK + word_h) / 2
    width = x + word_width(word_h)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(width)} {MARK}" color="{color}">'
            f'{mark()}{wordmark(x, baseline, word_h)}</svg>')


def stacked(color):
    width = STACKED_WIDTH * MARK
    word_h = width * ASCENDER / (INK_RIGHT - INK_LEFT)
    baseline = MARK + STACKED_SPACING * MARK + word_h
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(width)} {fmt(baseline)}" color="{color}">'
            f'<g transform="translate({fmt((width - MARK) / 2)} 0)">{mark()}</g>'
            f'{wordmark(0, baseline, word_h)}</svg>')


def fmt(value, places=2):
    return f'{value:.{places}f}'.rstrip('0').rstrip('.')


def main():
    write('mark.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MARK} {MARK}" color="{PALE}">{mark()}</svg>')
    word_h = 100
    write('wordmark.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(word_width(word_h))} {word_h}" '
                          f'color="{INK}">{wordmark(0, word_h, word_h)}</svg>')
    write('lockup.svg', lockup(INK))
    write('lockup-stacked.svg', stacked(INK))
    # The headers of the app and the site are always ink, so both show a pale copy as an image. The
    # site is static and cannot reach this folder, so it gets its own copy.
    pale = lockup(PALE)
    write('lockup-pale.svg', pale)
    write(os.path.join('..', 'apps', 'site', 'img', 'lockup-pale.svg'), pale)
    print("mark.svg, wordmark.svg, lockup.svg, lockup-stacked.svg, lockup-pale.svg and the site's copy written")


def write(name, svg):
    with open(os.path.join(HERE, name), 'w') as out:
        out.write(svg + '\n')


main()
