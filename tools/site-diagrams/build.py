"""Writes the three mesh diagrams of the home page (apps/site/img/net-*.svg), ADR-0113.

Run with `python3 tools/site-diagrams/build.py`; standard library only. The colours are the site's
(apps/site/styles.css): the panels are ink raised, the phones and the server grey, and lime marks
what travels over the mesh and the nodes, drawn after the MeshTracker X1.
"""
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'apps', 'site', 'img')
INK_RAISED = '#1f2123'
EDGE = '#2e3135'
DOT = '#2c2f33'
LIME = '#99c938'
LINE = '#6c7177'
DIM = '#3e4247'
BODY = '#111213'
SCREEN = '#25282c'
FRAME = '#8a8f95'
NODE = '#2b2d30'
NODE_EDGE = '#62676d'
MUTED = '#9fa3a8'
W, H = 400, 260

def head(name):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">\n'
            f'<!-- The {name} diagram of the home page (index.html, en/): no words, so both languages share it. -->\n'
            '<defs>'
            f'<pattern id="grid" width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="8" cy="8" r="0.9" fill="{DOT}"/></pattern>'
            f'<radialGradient id="glow"><stop offset="0" stop-color="{LIME}" stop-opacity="0.22"/><stop offset="1" stop-color="{LIME}" stop-opacity="0"/></radialGradient>'
            '</defs>\n'
            f'<rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" rx="14" fill="{INK_RAISED}" stroke="{EDGE}"/>\n'
            f'<rect x="0.5" y="0.5" width="{W-1}" height="{H-1}" rx="14" fill="url(#grid)"/>\n')

def cloud(cx, cy, off=False):
    # A cloud 76 wide, with a padlock: the server passes on what it cannot read.
    d = ('M-26 14h52a14 14 0 0 0 2-27.8a20 20 0 0 0-38.5-5.5a15 15 0 0 0-15.5 33.3z')
    if off:
        return (f'<g transform="translate({cx} {cy})"><path d="{d}" fill="none" stroke="{DIM}" stroke-width="1.6" stroke-dasharray="3 4" stroke-linejoin="round"/>'
                f'<path d="M-30 -24 L30 22" stroke="{LINE}" stroke-width="2" stroke-linecap="round"/></g>\n')
    return (f'<g transform="translate({cx} {cy})"><path d="{d}" fill="#2a2d31" stroke="#4d5258" stroke-width="1.6" stroke-linejoin="round"/>'
            f'<rect x="-7" y="-3" width="14" height="11" rx="2" fill="{MUTED}"/>'
            f'<path d="M-4.2 -3v-3a4.2 4.2 0 0 1 8.4 0v3" fill="none" stroke="{MUTED}" stroke-width="1.8"/>'
            f'<circle cx="0" cy="2.5" r="1.5" fill="#2a2d31"/></g>\n')

def phone(x, y):
    # 36 by 64; (x, y) its top left corner. On the screen, a map with this device.
    return (f'<g transform="translate({x} {y})">'
            f'<rect width="36" height="64" rx="7" fill="{BODY}" stroke="{FRAME}" stroke-width="1.5"/>'
            f'<rect x="3.5" y="8" width="29" height="48" rx="2.5" fill="{SCREEN}"/>'
            f'<path d="M3.5 22c8-5 14 4 29-2M3.5 36c9-6 16 5 29-3M3.5 48c7-3 13 3 29-1" fill="none" stroke="#33373c" stroke-width="1"/>'
            f'<circle cx="18" cy="31" r="5" fill="{LIME}" fill-opacity="0.25"/><circle cx="18" cy="31" r="2.6" fill="{LIME}"/>'
            f'<path d="M14 4h8" stroke="{FRAME}" stroke-width="1.5" stroke-linecap="round"/></g>\n')

def node(x, y):
    # The pocket node, after the MeshTracker X1: a dark card with a lime button. 24 by 34.
    return (f'<g transform="translate({x} {y})">'
            f'<rect width="24" height="34" rx="6" fill="{NODE}" stroke="{NODE_EDGE}" stroke-width="1.3"/>'
            f'<circle cx="12" cy="14" r="5.5" fill="{LIME}"/><circle cx="17.5" cy="7" r="1" fill="{MUTED}"/>'
            f'<path d="M8 28h8" stroke="{NODE_EDGE}" stroke-width="1.3" stroke-linecap="round"/>'
            # Waves: it is sending.
            f'<path d="M6.5 -4a8 8 0 0 1 11 0" fill="none" stroke="{LIME}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.9"/>'
            f'<path d="M2.5 -8.5a13.5 13.5 0 0 1 19 0" fill="none" stroke="{LIME}" stroke-width="1.5" stroke-linecap="round" stroke-opacity="0.45"/>'
            '</g>\n')

def wire(x1, y1, x2, y2):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{LINE}" stroke-width="1.6" stroke-linecap="round"/>\n'

def hop(x1, x2, y, lift):
    mx = (x1 + x2) / 2
    return (f'<path d="M{x1} {y} Q{mx} {y - lift} {x2} {y}" fill="none" stroke="{LIME}" stroke-width="1.8" '
            f'stroke-dasharray="2 6" stroke-linecap="round"/>\n')

def packet(x, y):
    return (f'<circle cx="{x}" cy="{y}" r="9" fill="{LIME}" fill-opacity="0.16"/>'
            f'<circle cx="{x}" cy="{y}" r="3.6" fill="{LIME}"/>\n')

def write(name, body):
    with open(os.path.join(OUT, f'net-{name}.svg'), 'w') as f:
        f.write(head(name) + body + '</svg>\n')

PY = 162  # the phones' top
CLOUD = (200, 64)

# With coverage: three phones, each wired to the server, a message on its way.
xs = [62, 182, 302]
body = ''.join(wire(x + 18, PY - 6, 200 + (x + 18 - 200) * 0.32, 82) for x in xs)
body += cloud(*CLOUD) + ''.join(phone(x, PY) for x in xs)
# A message on the first wire, on its way to the server.
x0, y0, x1, y1 = 80, PY - 6, 200 + (80 - 200) * 0.32, 82
body += packet(x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.45)
write('coverage', body)

# Without coverage: the server out of reach; each phone with its node, the message hopping.
xs = [52, 172, 292]
body = cloud(*CLOUD, off=True)
nodes = [(x + 30, PY + 26) for x in xs]
for (a, _), (b, _) in zip(nodes, nodes[1:]):
    body += hop(a + 12, b + 12, PY + 10, 70)
body += ''.join(phone(x, PY) for x in xs) + ''.join(node(*n) for n in nodes)
body += packet((nodes[0][0] + nodes[1][0]) / 2 + 12, PY + 10 - 35)
write('mesh', body)

# Both: the middle phone has coverage and a node, and joins the two.
left, mid, right = 52, 172, 292
body = f'<circle cx="{mid + 27}" cy="{PY + 32}" r="62" fill="url(#glow)"/>\n'
body += f'<circle cx="{mid + 27}" cy="{PY + 32}" r="50" fill="none" stroke="{LIME}" stroke-width="1.2" stroke-opacity="0.55"/>\n'
body += wire(left + 18, PY - 6, 176, 82) + wire(mid + 18, PY - 18, 200, 82)
body += hop(mid + 42, right + 42, PY + 10, 70)
body += cloud(*CLOUD)
body += phone(left, PY) + phone(mid, PY) + phone(right, PY) + node(mid + 30, PY + 26) + node(right + 30, PY + 26)
body += packet((mid + right) / 2 + 42, PY + 10 - 35)
body += packet(mid + 18 + (200 - mid - 18) * 0.5, PY - 18 + (82 - PY + 18) * 0.5)
write('bridge', body)
