# Builds the Tesel logo and mark as SVG, into this folder.
#
#   python3 brand/build.py
#
# The logo is "Tesel" in Outfit SemiBold followed by a lime tile on its baseline, as a full stop.
# The mark, for where the word does not fit, is a T with that tile at the foot of its stem. The
# word is kept as outlines in wordmark-glyphs.json (extract-wordmark.py), so this build needs only
# Python's standard library and no font. The design is of 11 November 2026 (ADR-0129).
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
# The brand's colours, shared with the app and the site (a test keeps them in step).
with open(os.path.join(HERE, 'colors.json')) as colors_file:
    COLORS = json.load(colors_file)
INK, PALE, SIGNAL = COLORS['ink'], COLORS['pale'], COLORS['signal']
with open(os.path.join(HERE, 'wordmark-glyphs.json')) as glyphs_file:
    GLYPHS = json.load(glyphs_file)

# ---------------------------------------------------------------------------------------------
# The mark, in a 100 x 100 box: a T of two rounded bars, and at the foot of its stem, on the same
# line, a lime tile: the logo's tile beside its first letter. It stands for the name where the word
# does not fit (app icons, the favicon, the top bar of a narrow screen). The box keeps a margin
# round the drawing, so icons lay it on their ground as it is.

MARK = 100
BAR = (14, 18, 56, 17)  # x, y, width, height of the T's crossbar
STEM = (33.5, 18, 17, 64)  # and of its stem, which runs down to the line the tile sits on
TILE_BOX = (66, 62, 20, 20)  # the lime tile, its foot on that line
BAR_ROUNDING = 3
TILE_ROUNDING = 4


def mark():
    return (rounded_rect(*BAR, BAR_ROUNDING, 'currentColor')
            + rounded_rect(*STEM, BAR_ROUNDING, 'currentColor')
            + rounded_rect(*TILE_BOX, TILE_ROUNDING, SIGNAL))


def rounded_rect(x, y, width, height, r, fill):
    """A rectangle with rounded corners, as a path: what the PDF and Android's vectors read."""
    d = (f'M{fmt(x + r)} {fmt(y)} H{fmt(x + width - r)} A{fmt(r)} {fmt(r)} 0 0 1 {fmt(x + width)} {fmt(y + r)} '
         f'V{fmt(y + height - r)} A{fmt(r)} {fmt(r)} 0 0 1 {fmt(x + width - r)} {fmt(y + height)} '
         f'H{fmt(x + r)} A{fmt(r)} {fmt(r)} 0 0 1 {fmt(x)} {fmt(y + height - r)} '
         f'V{fmt(y + r)} A{fmt(r)} {fmt(r)} 0 0 1 {fmt(x + r)} {fmt(y)} Z')
    return f'<path d="{d}" fill="{fill}"/>'


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
# The logo: the word and, after it, a lime tile standing on the baseline, as a full stop. In ems
# of the type: the tile is 0.222 wide, rounded 0.042, and 0.142 from the l's ink. Clear space
# around it: the height of the tile.

LOGO_TILE = 0.222
LOGO_TILE_ROUNDING = 0.042
LOGO_GAP = 0.142
# How far round letters (e, s) dip below the baseline, in font units.
OVERSHOOT = 12


def logo(color, height=100):
    """The logo, `height` from the top of the l to the baseline, in `color` with the lime tile."""
    em = EM * height / ASCENDER
    side = LOGO_TILE * em
    x = word_width(height) + LOGO_GAP * em
    width = x + side
    tile = rounded_rect(x, height - side, side, side, LOGO_TILE_ROUNDING * em, SIGNAL)
    # Round letters dip a little below the baseline: the box keeps room for them.
    depth = height + OVERSHOOT * em / EM
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {fmt(width)} {fmt(depth)}" color="{color}">'
            f'{wordmark(0, height, height)}{tile}</svg>')


def fmt(value, places=2):
    return f'{value:.{places}f}'.rstrip('0').rstrip('.')


def main():
    write('mark.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {MARK} {MARK}" color="{PALE}">{mark()}</svg>')
    write('logo.svg', logo(INK))
    # The headers of the app and the site are always ink, so both show a pale copy as an image. The
    # site is static and cannot reach this folder, so it gets its own copy.
    pale = logo(PALE)
    write('logo-pale.svg', pale)
    write(os.path.join('..', 'apps', 'site', 'img', 'logo-pale.svg'), pale)
    print("mark.svg, logo.svg, logo-pale.svg and the site's copy written")


def write(name, svg):
    with open(os.path.join(HERE, name), 'w') as out:
        out.write(svg + '\n')


main()
