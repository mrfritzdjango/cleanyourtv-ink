"""Render land.json the way the app will: paper bg, halftone dots clipped to shapes, solid ink,
paper knock-outs and strokes in layer order. Own path parser + Bezier flattening, non-zero fill.

usage: render.py land.json out.png [--night] [--only id,id] [--cell 420] [--cols 4]
"""
import json
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

PAPER = (0xE6, 0xE5, 0xDF)
INK = (0x1C, 0x1C, 0x1A)
SS = 3  # supersampling


def parse(d):
    toks = re.findall(r"[MLCQZ]|-?\d+(?:\.\d+)?", d)
    subs = []
    cur = None
    i = 0
    pos = (0, 0)
    while i < len(toks):
        c = toks[i]
        i += 1
        if c == "M":
            if cur:
                subs.append(cur)
            pos = (float(toks[i]), float(toks[i + 1]))
            i += 2
            cur = {"pts": [pos], "closed": False}
        elif c == "L":
            pos = (float(toks[i]), float(toks[i + 1]))
            i += 2
            cur["pts"].append(pos)
        elif c == "C":
            v = [float(x) for x in toks[i:i + 6]]
            i += 6
            p0 = pos
            n = 16
            for k in range(1, n + 1):
                u = k / n
                w = 1 - u
                x = w**3 * p0[0] + 3 * w * w * u * v[0] + 3 * w * u * u * v[2] + u**3 * v[4]
                y = w**3 * p0[1] + 3 * w * w * u * v[1] + 3 * w * u * u * v[3] + u**3 * v[5]
                cur["pts"].append((x, y))
            pos = (v[4], v[5])
        elif c == "Q":
            v = [float(x) for x in toks[i:i + 4]]
            i += 4
            p0 = pos
            n = 12
            for k in range(1, n + 1):
                u = k / n
                w = 1 - u
                x = w * w * p0[0] + 2 * w * u * v[0] + u * u * v[2]
                y = w * w * p0[1] + 2 * w * u * v[1] + u * u * v[3]
                cur["pts"].append((x, y))
            pos = (v[2], v[3])
        elif c == "Z":
            cur["closed"] = True
            pos = cur["pts"][0]
    if cur:
        subs.append(cur)
    return subs


def fill_mask(subs, w, h, s, ox, oy):
    """Non-zero winding mask. s = px per unit, (ox, oy) pixel offset."""
    X0, Y0, X1, Y1 = [], [], [], []
    for sb in subs:
        P = np.array(sb["pts"]) * s + np.array([ox, oy])
        Q = np.roll(P, -1, axis=0)
        X0.append(P[:, 0]); Y0.append(P[:, 1]); X1.append(Q[:, 0]); Y1.append(Q[:, 1])
    if not X0:
        return np.zeros((h, w), bool)
    x0, y0, x1, y1 = map(np.concatenate, (X0, Y0, X1, Y1))
    keep = y0 != y1
    x0, y0, x1, y1 = x0[keep], y0[keep], x1[keep], y1[keep]
    dirn = np.where(y1 > y0, 1, -1)
    ymin = np.minimum(y0, y1)
    ymax = np.maximum(y0, y1)
    r0 = np.clip(np.ceil(ymin - 0.5), 0, h).astype(int)
    r1 = np.clip(np.ceil(ymax - 0.5), 0, h).astype(int)
    cnt = np.maximum(r1 - r0, 0)
    tot = cnt.sum()
    diff = np.zeros((h, w + 1), np.int32)
    if tot:
        idx = np.repeat(np.arange(len(cnt)), cnt)
        offs = np.cumsum(cnt) - cnt
        r = r0[idx] + (np.arange(tot) - offs[idx])
        yc = r + 0.5
        xs = x0[idx] + (yc - y0[idx]) * (x1[idx] - x0[idx]) / (y1[idx] - y0[idx])
        col = np.clip(np.ceil(xs - 0.5), 0, w).astype(int)
        np.add.at(diff, (r, col), dirn[idx])
    wind = np.cumsum(diff, axis=1)[:, :w]
    return wind != 0


def stroke_mask(subs, w, h, s, ox, oy, width):
    im = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(im)
    lw = max(1, int(round(width * s)))
    rad = width * s / 2
    for sb in subs:
        P = [(x * s + ox, y * s + oy) for x, y in sb["pts"]]
        if sb["closed"]:
            P = P + [P[0]]
        if len(P) >= 2:
            dr.line(P, fill=255, width=lw, joint="curve")
        for x, y in (P[0], P[-1]):
            dr.ellipse([x - rad, y - rad, x + rad, y + rad], fill=255)
    return np.array(im) > 127


def render_animal(a, box_w, box_h, night=False):
    _, _, W, H = [float(v) for v in a["viewBox"].split()]
    s = min(box_w / W, box_h / H) * SS
    w, h = int(round(W * s)), int(round(H * s))
    ink = np.zeros((h, w), np.float32)  # 1 = ink
    spacing = 0.012 * W * s
    rad = 0.34 * spacing
    yy, xx = np.mgrid[0:h, 0:w]
    gx = (xx + 0.5) / spacing
    gy = (yy + 0.5) / spacing
    dx = (gx - np.floor(gx) - 0.5) * spacing
    dy = (gy - np.floor(gy) - 0.5) * spacing
    dots = (dx * dx + dy * dy) <= rad * rad
    for L in a["layers"]:
        subs = parse(L["d"])
        f = L["fill"]
        if f != "none":
            m = fill_mask(subs, w, h, s, 0, 0)
            if f == "ink":
                ink[m] = 1
            elif f == "paper":
                ink[m] = 0
            elif f == "dots":
                ink[m] = dots[m]
        if L.get("stroke"):
            m = stroke_mask(subs, w, h, s, 0, 0, L.get("width", 2.5))
            ink[m] = 1
    img = Image.fromarray((ink * 255).astype(np.uint8)).resize((w // SS, h // SS), Image.LANCZOS)
    a_ = np.array(img).astype(np.float32)[..., None] / 255
    pc, ic = (INK, PAPER) if night else (PAPER, INK)
    rgb = np.array(pc, np.float32) * (1 - a_) + np.array(ic, np.float32) * a_
    return Image.fromarray(rgb.astype(np.uint8))


def main():
    args = sys.argv[1:]
    src, out = args[0], args[1]
    night = "--night" in args
    only = None
    cell = 420
    cols = 4
    if "--only" in args:
        only = args[args.index("--only") + 1].split(",")
    if "--cell" in args:
        cell = int(args[args.index("--cell") + 1])
    if "--cols" in args:
        cols = int(args[args.index("--cols") + 1])
    animals = json.load(open(src))["animals"]
    if only:
        animals = [a for a in animals if a["id"] in only]
    cols = min(cols, len(animals))
    rows = (len(animals) + cols - 1) // cols
    lab = 34
    pad = 10
    bg = INK if night else PAPER
    fg = PAPER if night else INK
    sheet = Image.new("RGB", (cols * cell, rows * (cell + lab)), bg)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", max(14, cell // 24))
    except Exception:
        font = ImageFont.load_default()
    dr = ImageDraw.Draw(sheet)
    for k, a in enumerate(animals):
        c, r = k % cols, k // cols
        im = render_animal(a, cell - 2 * pad, cell - 2 * pad, night)
        x = c * cell + (cell - im.width) // 2
        y = r * (cell + lab) + (cell - im.height) // 2
        sheet.paste(im, (x, y))
        dr.rectangle([c * cell, r * (cell + lab), (c + 1) * cell - 1, (r + 1) * (cell + lab) - 1],
                     outline=(170, 170, 165))
        t = a["name"]
        tw = dr.textlength(t, font=font)
        dr.text((c * cell + (cell - tw) / 2, r * (cell + lab) + cell + 4), t, fill=fg, font=font)
    sheet.save(out)
    print("wrote", out, sheet.size)


if __name__ == "__main__":
    main()
