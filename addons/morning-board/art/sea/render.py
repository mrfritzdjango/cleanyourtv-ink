"""Render sea.json the way the app does, to PNG.

Usage:
  venv/bin/python render.py sea.json sheet.png            contact sheet (4 columns)
  venv/bin/python render.py sea.json out.png --id ID [--size 900] [--night]
  venv/bin/python render.py sea.json sheet.png --night --ids a,b

Paper #E6E5DF, ink #1C1C1A. "dots" = grid of ink dots, spacing 1.2% of the
viewBox width, radius 34% of the spacing, clipped to the shape. Fill rule
non-zero. Layers in order: fill, then that layer's stroke.
"""
import json
import math
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PAPER = (0xE6, 0xE5, 0xDF)
INK = (0x1C, 0x1C, 0x1A)
SS = 3

TOK = re.compile(r'[MLCQZ]|[-+]?\d*\.?\d+')


def parse(d):
    toks = TOK.findall(d)
    subs = []
    cur = None
    i = 0
    cmd = None
    pos = (0.0, 0.0)
    while i < len(toks):
        t = toks[i]
        if t in 'MLCQZ':
            cmd = t
            i += 1
            if cmd == 'Z':
                if cur:
                    cur['closed'] = True
                    pos = cur['pts'][0]
                cur = None
                continue
        nums = []
        need = {'M': 2, 'L': 2, 'C': 6, 'Q': 4}[cmd]
        for _ in range(need):
            nums.append(float(toks[i]))
            i += 1
        if cmd == 'M':
            cur = {'pts': [(nums[0], nums[1])], 'closed': False}
            subs.append(cur)
            pos = (nums[0], nums[1])
            cmd = 'L'
        elif cmd == 'L':
            if cur is None:
                cur = {'pts': [pos], 'closed': False}
                subs.append(cur)
            pos = (nums[0], nums[1])
            cur['pts'].append(pos)
        elif cmd == 'C':
            if cur is None:
                cur = {'pts': [pos], 'closed': False}
                subs.append(cur)
            p0 = pos
            c1, c2, p1 = (nums[0], nums[1]), (nums[2], nums[3]), (nums[4], nums[5])
            L = math.dist(p0, c1) + math.dist(c1, c2) + math.dist(c2, p1)
            n = max(6, int(L / 1.5))
            for k in range(1, n + 1):
                tt = k / n
                u = 1 - tt
                cur['pts'].append((u ** 3 * p0[0] + 3 * u * u * tt * c1[0] + 3 * u * tt * tt * c2[0] + tt ** 3 * p1[0],
                                   u ** 3 * p0[1] + 3 * u * u * tt * c1[1] + 3 * u * tt * tt * c2[1] + tt ** 3 * p1[1]))
            pos = p1
        elif cmd == 'Q':
            if cur is None:
                cur = {'pts': [pos], 'closed': False}
                subs.append(cur)
            p0 = pos
            c, p1 = (nums[0], nums[1]), (nums[2], nums[3])
            n = max(6, int((math.dist(p0, c) + math.dist(c, p1)) / 1.5))
            for k in range(1, n + 1):
                tt = k / n
                u = 1 - tt
                cur['pts'].append((u * u * p0[0] + 2 * u * tt * c[0] + tt * tt * p1[0],
                                   u * u * p0[1] + 2 * u * tt * c[1] + tt * tt * p1[1]))
            pos = p1
    return subs


def area(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
    return a / 2


def fill_mask(subs, s, w, h):
    acc = np.zeros((h, w), dtype=np.int16)
    for sub in subs:
        pts = sub['pts']
        if len(pts) < 3:
            continue
        sign = 1 if area(pts) >= 0 else -1
        im = Image.new('L', (w, h), 0)
        ImageDraw.Draw(im).polygon([(x * s, y * s) for x, y in pts], fill=1)
        acc += sign * np.asarray(im, dtype=np.int16)
    return acc != 0


def stroke_mask(subs, s, w, h, width):
    im = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(im)
    lw = max(1, int(round(width * s)))
    r = width * s / 2
    for sub in subs:
        pts = [(x * s, y * s) for x, y in sub['pts']]
        if sub['closed']:
            pts = pts + [pts[0], pts[1] if len(pts) > 1 else pts[0]]
        if len(pts) >= 2:
            dr.line(pts, fill=1, width=lw, joint='curve')
        ends = [pts[0], pts[-1]] if not sub['closed'] else []
        for (x, y) in ends:
            dr.ellipse([x - r, y - r, x + r, y + r], fill=1)
    return np.asarray(im, dtype=bool)


def dots_mask(W, s, w, h):
    sp = 0.012 * W
    rad = 0.34 * sp
    im = Image.new('L', (w, h), 0)
    dr = ImageDraw.Draw(im)
    ny = int(h / (sp * s)) + 2
    nx = int(w / (sp * s)) + 2
    for j in range(ny):
        for i in range(nx):
            cx, cy = (i + 0.5) * sp * s, (j + 0.5) * sp * s
            dr.ellipse([cx - rad * s, cy - rad * s, cx + rad * s, cy + rad * s], fill=1)
    return np.asarray(im, dtype=bool)


def render_animal(a, scale, night=False):
    vb = [float(v) for v in a['viewBox'].split()]
    W, H = vb[2], vb[3]
    s = scale * SS
    w, h = int(round(W * s)), int(round(H * s))
    ink = np.zeros((h, w), dtype=np.float32)
    dots = None
    for L in a['layers']:
        subs = parse(L['d'])
        f = L['fill']
        if f != 'none':
            m = fill_mask(subs, s, w, h)
            if f == 'ink':
                ink[m] = 1
            elif f == 'paper':
                ink[m] = 0
            elif f == 'dots':
                if dots is None:
                    dots = dots_mask(W, s, w, h)
                ink[m] = dots[m].astype(np.float32)
        if L.get('stroke'):
            sm = stroke_mask(subs, s, w, h, float(L.get('width', 2.5)))
            ink[sm] = 1
    im = Image.fromarray((ink * 255).astype(np.uint8))
    im = im.resize((int(round(W * scale)), int(round(H * scale))), Image.LANCZOS)
    v = np.asarray(im, dtype=np.float32)[..., None] / 255.0
    pa, ik = (np.array(INK), np.array(PAPER)) if night else (np.array(PAPER), np.array(INK))
    rgb = pa * (1 - v) + ik * v
    return Image.fromarray(rgb.astype(np.uint8))


def font(sz):
    for p in ['/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Supplemental/Arial.ttf']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


def sheet(animals, out, cols=4, cell=420, night=False):
    lab = 34
    rows = math.ceil(len(animals) / cols)
    bg, fg = (INK, PAPER) if night else (PAPER, INK)
    img = Image.new('RGB', (cols * cell, rows * (cell + lab)), bg)
    dr = ImageDraw.Draw(img)
    f = font(17)
    for k, a in enumerate(animals):
        vb = [float(v) for v in a['viewBox'].split()]
        sc = min((cell - 20) / vb[2], (cell - 20) / vb[3])
        im = render_animal(a, sc, night)
        cx, cy = (k % cols) * cell, (k // cols) * (cell + lab)
        img.paste(im, (cx + (cell - im.width) // 2, cy + (cell - im.height) // 2))
        dr.rectangle([cx, cy, cx + cell - 1, cy + cell + lab - 1], outline=(180, 180, 175) if not night else (70, 70, 68))
        t = '%d. %s' % (k + 1, a['name'])
        tw = dr.textlength(t, font=f)
        dr.text((cx + (cell - tw) / 2, cy + cell + 4), t, fill=fg, font=f)
    img.save(out)


def main():
    args = sys.argv[1:]
    src, out = args[0], args[1]
    data = json.load(open(src))['animals']
    night = '--night' in args
    if '--id' in args:
        aid = args[args.index('--id') + 1]
        size = int(args[args.index('--size') + 1]) if '--size' in args else 900
        a = [x for x in data if x['id'] == aid][0]
        vb = [float(v) for v in a['viewBox'].split()]
        render_animal(a, size / max(vb[2], vb[3]), night).save(out)
        return
    if '--ids' in args:
        ids = args[args.index('--ids') + 1].split(',')
        data = [x for x in data if x['id'] in ids]
    cols = int(args[args.index('--cols') + 1]) if '--cols' in args else 4
    cell = int(args[args.index('--cell') + 1]) if '--cell' in args else 420
    sheet(data, out, cols=cols, cell=cell, night=night)


if __name__ == '__main__':
    main()
