# Builds the Tesel mark, wordmark and lockup as SVG, into this folder.
#
#   python3 brand/build.py
#
# The mark is two square tiles that interlock at a corner, held by a lime key: two pieces of a
# tessellation, two places on a map, two radios linked. The wordmark is drawn here from straight
# lines and arcs, with no font. Both come from the design of 1 November 2026 (ADR-0091); only the
# Python standard library is needed.
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
# The brand's colours, shared with the app and the site (a test keeps them in step).
with open(os.path.join(HERE, 'colors.json')) as colors_file:
    COLORS = json.load(colors_file)
INK, PALE, SIGNAL = COLORS['ink'], COLORS['pale'], COLORS['signal']

# ---------------------------------------------------------------------------------------------
# The mark, in a 150 x 150 box: two 100-unit tiles, the second moved 50 down and 50 right.

TILE, SHIFT = 100, 50
FRAME = 24  # the width of each tile's frame
CORNER = 10  # the rounding of the tiles' outer corners
SLOT = 18  # half the width of the diagonal slot where the tiles meet
KEY_LENGTH, KEY_WIDTH = 42, 23  # the lime key in the slot, along and across it
JOINT = (TILE + SHIFT) / 2  # where the two tiles' holes touch, on both axes


def mark_tiles():
    """The two tiles as one shape: their outline, less both holes and the slot between them."""
    a, b, r, t = TILE, TILE + SHIFT, CORNER, FRAME
    outline = (
        f'M{r} 0 H{a - r} A{r} {r} 0 0 1 {a} {r} V{SHIFT} H{b - r} A{r} {r} 0 0 1 {b} {SHIFT + r} '
        f'V{b - r} A{r} {r} 0 0 1 {b - r} {b} H{SHIFT + r} A{r} {r} 0 0 1 {SHIFT} {b - r} '
        f'V{a} H{r} A{r} {r} 0 0 1 0 {a - r} V{r} A{r} {r} 0 0 1 {r} 0 Z'
    )
    # The slot's sides are the lines x - y = ±d; each meets the holes' edges.
    d = SLOT * math.sqrt(2)
    hole_a, hole_b = (t, a - t), (SHIFT + t, b - t)
    opening = (
        f'M{hole_a[0]} {hole_a[0]} H{hole_a[1]} V{fmt(hole_a[1] - d)} '
        f'L{fmt(hole_b[0] + d)} {hole_b[0]} H{hole_b[1]} V{hole_b[1]} H{hole_b[0]} '
        f'V{fmt(hole_b[0] + d)} L{fmt(hole_a[1] - d)} {hole_a[1]} H{hole_a[0]} Z'
    )
    return f'<path d="{outline} {opening}" fill="currentColor" fill-rule="evenodd"/>'


def mark_key():
    """The lime key: a rectangle along the slot, centred where the tiles meet."""
    along = (1 / math.sqrt(2), 1 / math.sqrt(2))
    across = (1 / math.sqrt(2), -1 / math.sqrt(2))
    corners = [
        (JOINT + sa * KEY_LENGTH / 2 * along[0] + sc * KEY_WIDTH / 2 * across[0],
         JOINT + sa * KEY_LENGTH / 2 * along[1] + sc * KEY_WIDTH / 2 * across[1])
        for sa, sc in ((-1, -1), (-1, 1), (1, 1), (1, -1))
    ]
    d = 'M' + ' L'.join(f'{fmt(x)} {fmt(y)}' for x, y in corners) + ' Z'
    return f'<path d="{d}" fill="{SIGNAL}"/>'


def mark():
    return mark_tiles() + mark_key()


# ---------------------------------------------------------------------------------------------
# The wordmark, with the capitals 100 units tall: square letters with rounded shoulders.

CAP, X_HEIGHT = 100, 72
STEM, BAR = 17, 14  # vertical and horizontal strokes
ROUND, INNER, END = 21, 5, 3  # outer shoulders, inside corners, ends of strokes
MIDDLE = X_HEIGHT / 2  # the centre of the middle bar of e and s


def letter_t(x):
    width = 83
    stem = (width - STEM) / 2
    return (f'M{x} 0 H{x + width} V{BAR} H{fmt(x + stem + STEM)} V{CAP} H{fmt(x + stem)} '
            f'V{BAR} H{x} Z')


def letter_e(x):
    """A bowl, closed above the middle bar and open below it, its lower bar running to the edge."""
    w, top = 77, CAP - X_HEIGHT
    s, b, R, r, e = STEM, BAR, ROUND, INNER, END
    mid_top, mid_bottom, low_top = top + MIDDLE - b / 2, top + MIDDLE + b / 2, CAP - b
    outer = (
        f'M{x + R} {top} H{x + w - R} A{R} {R} 0 0 1 {x + w} {top + R} V{mid_bottom - e} '
        f'A{e} {e} 0 0 1 {x + w - e} {mid_bottom} H{x + s + r} A{r} {r} 0 0 0 {x + s} {mid_bottom + r} '
        f'V{low_top - r} A{r} {r} 0 0 0 {x + s + r} {low_top} H{x + w - e} '
        f'A{e} {e} 0 0 1 {x + w} {low_top + e} V{CAP - e} A{e} {e} 0 0 1 {x + w - e} {CAP} '
        f'H{x + R} A{R} {R} 0 0 1 {x} {CAP - R} V{top + R} A{R} {R} 0 0 1 {x + R} {top} Z'
    )
    counter = rounded_rect(x + s, top + b, x + w - s, mid_top, r)
    return f'{outer} {counter}'


def letter_s(x):
    w, top = 67, CAP - X_HEIGHT
    s, b, R, r, e = STEM, BAR, ROUND, INNER, END
    mid_top, mid_bottom, low_top = top + MIDDLE - b / 2, top + MIDDLE + b / 2, CAP - b
    return (
        f'M{x + R} {top} H{x + w - e} A{e} {e} 0 0 1 {x + w} {top + e} V{top + b - e} '
        f'A{e} {e} 0 0 1 {x + w - e} {top + b} H{x + s + r} A{r} {r} 0 0 0 {x + s} {top + b + r} '
        f'V{mid_top - r} A{r} {r} 0 0 0 {x + s + r} {mid_top} H{x + w - R} '
        f'A{R} {R} 0 0 1 {x + w} {mid_top + R} V{CAP - R} A{R} {R} 0 0 1 {x + w - R} {CAP} '
        f'H{x + e} A{e} {e} 0 0 1 {x} {CAP - e} V{low_top + e} A{e} {e} 0 0 1 {x + e} {low_top} '
        f'H{x + w - s - r} A{r} {r} 0 0 0 {x + w - s} {low_top - r} V{mid_bottom + r} '
        f'A{r} {r} 0 0 0 {x + w - s - r} {mid_bottom} H{x + R} A{R} {R} 0 0 1 {x} {mid_bottom - R} '
        f'V{top + R} A{R} {R} 0 0 1 {x + R} {top} Z'
    )


def letter_l(x):
    """A stem rounded at its foot, which turns a little to the right."""
    width, foot, R, r = 22, 8, 13, 4
    return (f'M{x} 0 H{x + STEM} V{CAP - foot - r} A{r} {r} 0 0 0 {x + STEM + r} {CAP - foot} '
            f'H{x + width} V{CAP} H{x + R} A{R} {R} 0 0 1 {x} {CAP - R} Z')


def rounded_rect(x0, y0, x1, y1, r):
    return (f'M{fmt(x0 + r)} {fmt(y0)} H{fmt(x1 - r)} A{r} {r} 0 0 1 {fmt(x1)} {fmt(y0 + r)} '
            f'V{fmt(y1 - r)} A{r} {r} 0 0 1 {fmt(x1 - r)} {fmt(y1)} H{fmt(x0 + r)} '
            f'A{r} {r} 0 0 1 {fmt(x0)} {fmt(y1 - r)} V{fmt(y0 + r)} A{r} {r} 0 0 1 {fmt(x0 + r)} {fmt(y0)} Z')


# Where each letter starts, as spaced in the design: the e tucks under the bar of the T.
LETTERS = [(letter_t, 0), (letter_e, 78), (letter_s, 167), (letter_e, 245), (letter_l, 333)]
WORD_WIDTH = 355


def wordmark():
    d = ' '.join(draw(x) for draw, x in LETTERS)
    return f'<path d="{d}" fill-rule="evenodd"/>'


def fmt(value):
    return f'{value:.2f}'.rstrip('0').rstrip('.')


def main():
    write('wordmark.svg',
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WORD_WIDTH} {CAP}" fill="{INK}">{wordmark()}</svg>')
    write('mark.svg',
          f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 150 150" color="{PALE}">{mark()}</svg>')
    # Lockup: the mark a third taller than the capitals and set a little above their centre, as in
    # the design; a quarter of the capitals' height between mark and word.
    mark_h, gap = 132, 23
    mark_top = -23
    height = mark_h
    scale = mark_h / 150
    lockup = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {mark_h + gap + WORD_WIDTH} {height}" color="{INK}">'
        f'<g transform="scale({fmt(scale)})">{mark()}</g>'
        f'<g transform="translate({mark_h + gap} {-mark_top})" fill="currentColor">{wordmark()}</g></svg>'
    )
    write('lockup.svg', lockup)
    # The headers of the app and the site are always ink, so both show a pale copy as an image. The
    # site is static and cannot reach this folder, so it gets its own copy.
    pale = lockup.replace(f'color="{INK}"', f'color="{PALE}"')
    write('lockup-pale.svg', pale)
    write(os.path.join('..', 'apps', 'site', 'img', 'lockup-pale.svg'), pale)
    print('mark.svg, wordmark.svg, lockup.svg, lockup-pale.svg and the site\'s copy written')


def write(name, svg):
    with open(os.path.join(HERE, name), 'w') as out:
        out.write(svg + '\n')


main()
