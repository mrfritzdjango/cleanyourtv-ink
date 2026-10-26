"""Build sea.json from the drawings in animals_*.py.

Usage: venv/bin/python gen.py [id ...]   (no ids = all)
"""
import json
import os
import sys

from geom import to_d, set_warp, affine_shape, shape_bounds

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'sea.json')

import animals_a
import animals_b
import animals_c

ORDER = []
for mod in (animals_a, animals_b, animals_c):
    ORDER.extend(mod.ANIMALS)


def build(fn):
    try:
        a = fn()
    finally:
        set_warp(None)
    W, H = a['W'], a['H']
    # fit the drawing to the viewBox with a 4% margin on the tighter axis
    bx = [W, H, 0, 0]
    for L in a['layers']:
        if L is None or L['shape'] is None:
            continue
        b = shape_bounds(L['shape'])
        hw = L['width'] / 2 if L['stroke'] else 0
        bx = [min(bx[0], b[0] - hw), min(bx[1], b[1] - hw), max(bx[2], b[2] + hw), max(bx[3], b[3] + hw)]
    m = a.get('margin', 0.04)
    s = min(W * (1 - 2 * m) / (bx[2] - bx[0]), H * (1 - 2 * m) / (bx[3] - bx[1]))
    dx = W / 2 - s * (bx[0] + bx[2]) / 2
    dy = H / 2 - s * (bx[1] + bx[3]) / 2
    layers = []
    for L in a['layers']:
        if L is None or L['shape'] is None:
            continue
        d = to_d(affine_shape(L['shape'], s, dx, dy), W, H)
        if not d:
            continue
        out = {'d': d, 'fill': L['fill'], 'stroke': bool(L['stroke'])}
        if L['stroke']:
            out['width'] = L['width']
        layers.append(out)
    return {'id': a['id'], 'name': a['name'], 'latin': a['latin'], 'group': 'sea',
            'viewBox': '0 0 %d %d' % (W, H), 'layers': layers}


def main():
    want = set(sys.argv[1:])
    animals = []
    for fn in ORDER:
        a = build(fn)
        if want and a['id'] not in want:
            continue
        animals.append(a)
    with open(OUT, 'w') as f:
        f.write('{"animals":[\n')
        f.write(',\n'.join(json.dumps(a, separators=(',', ':')) for a in animals))
        f.write('\n]}\n')
    print('wrote %d animals, %d bytes' % (len(animals), os.path.getsize(OUT)))


if __name__ == '__main__':
    main()
