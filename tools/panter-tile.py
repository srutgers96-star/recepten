"""Leopard print tiles for the Panter theme (V1c-10b, docs/specs/ei-gabi.md §1d).

Draws one seamless 216 x 216 px tile of leopard rosettes (chunky black broken rings around a brown
core, a share of solid blobs, small dots) and writes it as two CSS custom properties with a data URI
into src/styles/panter.css, between the markers `/* @panter-tiles */` and `/* @/panter-tiles */`:

    --panter-tile-klassiek  sand #dab672, black #1a1411, brown #8e5f36 (few solid blobs)
    --panter-tile-roze      hot pink #ff2d93, black #140b10, light pink #ff5fae (many solid blobs)

The geometry is seeded (default 23), so a rerun reproduces the same print; pass another seed as the
first argument to get a new layout. Rosettes near an edge are repeated on the opposite side with
<use>, which is what makes the tile seamless.

    python tools/panter-tile.py            # rewrite the tiles in src/styles/panter.css
    python tools/panter-tile.py 7 preview  # another seed; also writes scratch/panter-*.svg
"""
import io
import math
import os
import random
import sys
import urllib.parse

W = H = 216
SEED = int(sys.argv[1]) if len(sys.argv) > 1 and sys.argv[1].isdigit() else 23
PREVIEW = 'preview' in sys.argv
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_PATH = os.path.join(ROOT, 'src', 'styles', 'panter.css')
# name: (base, spot, core, share of solid blobs)
VARIANTS = {
    'klassiek': ('#dab672', '#1a1411', '#8e5f36', 0.14),
    'roze': ('#ff2d93', '#140b10', '#ff5fae', 0.38),
}


def wobble_path(cx, cy, rx, ry, rot, n=7, amp=0.22):
    """A closed blobby curve around (cx, cy): n points at a jittered radius, smoothed with quadratic beziers."""
    pts = []
    for i in range(n):
        a = 2 * math.pi * i / n + random.uniform(-0.18, 0.18)
        k = 1 + random.uniform(-amp, amp)
        x, y = math.cos(a) * rx * k, math.sin(a) * ry * k
        c, s = math.cos(rot), math.sin(rot)
        pts.append((cx + x * c - y * s, cy + x * s + y * c))
    d = []
    m0 = ((pts[-1][0] + pts[0][0]) / 2, (pts[-1][1] + pts[0][1]) / 2)
    d.append(f'M{m0[0]:.1f} {m0[1]:.1f}')
    for i in range(n):
        p = pts[i]
        q = pts[(i + 1) % n]
        m = ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
        d.append(f'Q{p[0]:.1f} {p[1]:.1f} {m[0]:.1f} {m[1]:.1f}')
    d.append('Z')
    return ''.join(d)


def arc_blob(cx, cy, r, a0, a1, w):
    """A thick, slightly wobbly arc from angle a0 to a1 (radians): a stroked polyline with round caps."""
    steps = max(2, int((a1 - a0) / 0.5))
    pts = []
    for i in range(steps + 1):
        a = a0 + (a1 - a0) * i / steps
        k = r * (1 + random.uniform(-0.08, 0.08))
        pts.append((cx + math.cos(a) * k, cy + math.sin(a) * k))
    d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f}' + ''.join(f'L{x:.1f} {y:.1f}' for x, y in pts[1:])
    return f'<path d="{d}" stroke-width="{w:.1f}"/>'


def rosette(i, cx, cy, blobs):
    size = random.uniform(8.5, 12)  # ring radius
    rot = random.uniform(0, math.pi)
    if random.random() < blobs:
        # a solid blob instead of a rosette (the pink print has many)
        blob = wobble_path(cx, cy, size * 0.9, size * random.uniform(0.55, 0.75), rot, 6, 0.36)
        return f'<g id="r{i}"><path class="s" d="{blob}"/></g>'
    # The core FILLS the ring (Stijn, 15 Nov: "niet als tepels"): the brown blob reaches out to the black
    # arcs, which sit on its edge; where an arc is missing the brown meets the sand directly.
    rx, ry = size * random.uniform(0.92, 1.0), size * random.uniform(0.78, 0.9)
    core = wobble_path(cx, cy, rx, ry, rot, 6, 0.26)
    nseg = random.choice([2, 2, 3, 3])  # chunky arcs with small gaps
    a = random.uniform(0, 2 * math.pi)
    arcs = []
    for _ in range(nseg):
        span = random.uniform(1.5, 2.6)
        arcs.append(arc_blob(cx, cy, size, a, a + span, random.uniform(5.2, 7)))
        a += span + random.uniform(0.3, 0.7)
    return f'<g id="r{i}"><path class="k" d="{core}"/><g class="s" fill="none" stroke-linecap="round">' + ''.join(arcs) + '</g></g>'


def dot(i, cx, cy):
    r = random.uniform(2.6, 4.2)
    return f'<g id="d{i}"><path class="s" d="{wobble_path(cx, cy, r, r * random.uniform(0.5, 0.8), random.uniform(0, 3), 6, 0.35)}"/></g>'


def layout():
    """A jittered 5 x 5 grid of rosettes (odd rows shifted half a cell) plus 9 small spots in the gaps."""
    items = []
    cell = W / 5
    i = 0
    for gy in range(5):
        for gx in range(5):
            cx = (gx + 0.5) * cell + random.uniform(-12, 12) + (cell / 2 if gy % 2 else 0)
            cy = (gy + 0.5) * cell + random.uniform(-13, 13)
            items.append(('r', i, cx % W, cy % H))
            i += 1
    for j in range(9):
        items.append(('d', j, random.uniform(0, W), random.uniform(0, H)))
    return items


def build(base, spot, core, blobs):
    random.seed(SEED)
    defs, uses = [], []
    for kind, i, cx, cy in layout():
        defs.append(rosette(i, cx, cy, blobs) if kind == 'r' else dot(i, cx, cy))
        ref = f'#{kind}{i}'
        xs = [0] + ([-W] if cx > W - 18 else []) + ([W] if cx < 18 else [])
        ys = [0] + ([-H] if cy > H - 18 else []) + ([H] if cy < 18 else [])
        for dx in xs:
            for dy in ys:
                uses.append(f'<use href="{ref}" x="{dx}" y="{dy}"/>')
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">'
        f'<style>.k{{fill:{core}}}.s{{fill:{spot};stroke:{spot}}}</style>'
        f'<rect width="{W}" height="{H}" fill="{base}"/><defs>' + ''.join(defs) + '</defs>' + ''.join(uses) + '</svg>'
    )


def data_uri(svg):
    enc = urllib.parse.quote(svg, safe="=:/ ,;-_.'()")
    return 'url("data:image/svg+xml,' + enc.replace('"', '%22') + '")'


def main():
    lines = []
    for name, (base, spot, core, blobs) in VARIANTS.items():
        svg = build(base, spot, core, blobs)
        if PREVIEW:
            os.makedirs(os.path.join(ROOT, 'scratch'), exist_ok=True)
            io.open(os.path.join(ROOT, 'scratch', f'panter-{name}.svg'), 'w', encoding='utf-8').write(svg)
        lines.append(f'  --panter-tile-{name}: {data_uri(svg)};')
        print(f'{name}: {len(svg)} bytes svg')
    css = io.open(CSS_PATH, encoding='utf-8').read()
    start = css.index('/* @panter-tiles */')
    end = css.index('/* @/panter-tiles */')
    css = css[:start] + '/* @panter-tiles */\n' + '\n'.join(lines) + '\n  ' + css[end:]
    io.open(CSS_PATH, 'w', encoding='utf-8', newline='\n').write(css)
    print(f'wrote {CSS_PATH} (seed {SEED})')


if __name__ == '__main__':
    main()
