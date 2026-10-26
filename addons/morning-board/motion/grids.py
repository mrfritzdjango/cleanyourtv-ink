"""Draws grid0.png, grid1.png, ...: every animal with a 10% grid, twelve to a sheet in animals.json order, so a show's
author can read where legs, fins and tails sit in the drawing's 0..1 coordinates (BRIEF.md). Needs Pillow.

Usage: python3 grids.py [out_dir]   (default: this folder; the sheets are not kept in git)
"""
import json
import os
import re
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ASSET = os.path.join(HERE, '..', 'app', 'src', 'main', 'assets', 'animals.json')
CELL, COLS, PER_SHEET = 600, 4, 12
INK, PAPER, DOTS, GRID = (28, 28, 26), (230, 229, 223), (120, 120, 116), (200, 60, 50)


def polylines(d):
    """The path's subpaths as point lists: absolute M, L, C, Q, Z, curves cut into 16 steps."""
    t = re.findall(r'[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?', d)
    out, cur, i, cmd = [], [], 0, None
    num = lambda k: [float(v) for v in t[i:i + k]]
    while i < len(t):
        if t[i] in 'MLCQZ':
            cmd = t[i]
            i += 1
            if cmd == 'Z' and cur:
                cur.append(cur[0])
            continue
        if cmd == 'M':
            if cur:
                out.append(cur)
            cur = [tuple(num(2))]
            i += 2
            cmd = 'L'
        elif cmd == 'L':
            cur.append(tuple(num(2)))
            i += 2
        elif cmd in 'CQ':
            n = 6 if cmd == 'C' else 4
            p = [cur[-1]] + [tuple(num(n)[j:j + 2]) for j in range(0, n, 2)]
            for s in range(1, 17):
                u = s / 16
                if cmd == 'C':
                    w = [(1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u * u * (1 - u), u ** 3]
                else:
                    w = [(1 - u) ** 2, 2 * u * (1 - u), u * u]
                cur.append((sum(wk * q[0] for wk, q in zip(w, p)), sum(wk * q[1] for wk, q in zip(w, p))))
            i += n
        else:
            raise ValueError('number without a command')
    if cur:
        out.append(cur)
    return out


def cell(a):
    w, h = [float(v) for v in a['viewBox'].split()[2:]]
    k = (CELL - 60) / max(w, h)
    img = Image.new('RGB', (CELL, CELL), PAPER)
    g = ImageDraw.Draw(img)
    ox, oy = (CELL - w * k) / 2, (CELL - h * k) / 2 + 10
    at = lambda p: (ox + p[0] * k, oy + p[1] * k)
    for layer in a['layers']:
        fill = {'ink': INK, 'dots': DOTS, 'paper': PAPER}.get(layer['fill'])
        for pts in polylines(layer['d']):
            pts = [at(p) for p in pts]
            if fill and len(pts) > 2:
                g.polygon(pts, fill=fill)
            if layer.get('stroke') and len(pts) > 1:
                g.line(pts, fill=INK, width=max(1, round(layer.get('width', 2.5) * k)))
    for n in range(11):   # the 10% grid, numbered 0..10 along the top and the left
        x, y = ox + w * k * n / 10, oy + h * k * n / 10
        g.line([(x, oy), (x, oy + h * k)], fill=GRID, width=1)
        g.line([(ox, y), (ox + w * k, y)], fill=GRID, width=1)
        g.text((x - 3, oy - 14), str(n), fill=GRID)
        g.text((ox - 16, y - 5), str(n), fill=GRID)
    g.text((8, CELL - 16), a['id'], fill=INK)
    return img


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else HERE
    animals = json.load(open(ASSET, encoding='utf-8'))['animals']
    for s in range(0, len(animals), PER_SHEET):
        group = animals[s:s + PER_SHEET]
        rows = (len(group) + COLS - 1) // COLS
        sheet = Image.new('RGB', (COLS * CELL, rows * CELL), PAPER)
        for j, a in enumerate(group):
            sheet.paste(cell(a), ((j % COLS) * CELL, (j // COLS) * CELL))
        path = os.path.join(out, f'grid{s // PER_SHEET}.png')
        sheet.save(path)
        print(path, ', '.join(a['id'] for a in group))


if __name__ == '__main__':
    main()
