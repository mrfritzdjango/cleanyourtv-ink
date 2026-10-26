import math
import random

from shapely.geometry import Point, Polygon as SPoly, LineString as SLine
from shapely.ops import unary_union
from geom import *
from animals_a import sym_x, sym_y, eye, bumps, arch


def normals_along(center, step):
    """(point, unit normal, t) samples along a smooth centre line."""
    pts = centerline_pts(center, 1.0)
    total = len(pts) - 1
    out = []
    i = 0
    acc = 0.0
    k = 0
    while k < len(pts) - 1:
        a, b = pts[max(0, k - 2)], pts[min(len(pts) - 1, k + 2)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        out.append((pts[k], (-dy / L, dx / L), k / total))
        k += max(1, int(step))
    return out


def eye_ring(cx, cy, r, pr):
    """paper eyeball with ink pupil: returns (ball, pupil, glint)"""
    return ellipse(cx, cy, r), ellipse(cx + r * 0.08, cy, pr), ellipse(cx + pr * 0.35, cy - pr * 0.35, max(1.3, pr * 0.32))


# ------------------------------------------------------------------ scalloped hammerhead (top view)
def scalloped_hammerhead():
    W, H = 600, 400
    set_warp(lambda x, y: (x, y + (0.00022 * (470 - x) ** 2 if x < 470 else 0)))
    top = [(556, 200, 'c'), (566, 187), (567, 172), (558, 160, 'c'), (561, 145), (553, 125), (539, 105), (523, 89),
           (509, 78), (499, 72, 'c'), (487, 75), (483, 88), (485, 104), (483, 128), (477, 150), (469, 167),
           (450, 172), (420, 169), (390, 167), (340, 171), (290, 177), (230, 183), (170, 188), (120, 192),
           (80, 195), (56, 197), (24, 200, 'c')]
    body = smooth(sym_y(top, 200))
    pf = [(414, 170), (388, 140), (360, 112), (326, 86, 'c'), (334, 118), (346, 150), (348, 172)]
    pv = [(206, 186), (188, 172), (168, 166, 'c'), (176, 180), (180, 190)]
    fins = combine([smooth(pf), smooth(my(pf, 200)), smooth(pv), smooth(my(pv, 200))])
    dors = combine([smooth([(352, 200), (310, 196.5), (270, 200, 'c'), (310, 203.5)]),
                    smooth([(150, 200), (134, 198), (118, 200, 'c'), (134, 202)])])
    eyes = combine([ellipse(495, 80, 6), ellipse(495, 320, 6)])
    gl = combine([ellipse(496, 78, 2), ellipse(496, 318, 2)])
    nos = combine([line([(560, 150), (552, 136)]), line([(560, 250), (552, 264)])])
    head_line = line([(476, 160), (482, 200), (476, 240)])
    set_warp(None)
    return dict(id='scalloped-hammerhead', name='Scalloped hammerhead', latin='Sphyrna lewini', W=W, H=H, layers=[
        layer(fins, 'dots', True, 2.5),
        layer(body, 'dots', True, 2.5),
        layer(combine([dors, eyes]), 'ink'),
        layer(gl, 'paper'),
        layer(combine([nos, head_line]), 'none', True, 1.8),
    ])


# ------------------------------------------------------------------ clownfish
def clownfish():
    W, H = 600, 400
    body = smooth([(502, 212), (494, 175), (470, 140), (425, 113), (360, 100), (290, 100), (225, 112), (170, 140),
                   (135, 168), (118, 180, 'c'), (118, 222, 'c'), (138, 234), (175, 262), (232, 290), (300, 302),
                   (370, 300), (430, 286), (476, 262), (498, 236)])
    tail = smooth([(130, 176), (94, 140), (60, 120), (36, 126), (26, 160), (23, 200), (26, 240), (36, 274), (60, 282),
                   (94, 262), (130, 226)])
    dors = smooth([(448, 130), (436, 94), (410, 72), (372, 66), (344, 78), (330, 92, 'c'), (312, 74), (282, 54), (244, 48),
                   (206, 58), (176, 84), (158, 124), (180, 160), (260, 132), (380, 125)])
    anal = smooth([(292, 292), (274, 324), (244, 342), (208, 338), (182, 318), (172, 282), (230, 270)])
    pelv = smooth([(404, 286), (394, 320), (374, 348, 'c'), (362, 322), (360, 294), (380, 280)])
    fins = combine([tail, dors, anal, pelv])
    finedge = ring(union(tail, dors, anal, pelv), 6)
    pect = smooth([(424, 214), (402, 198), (370, 202), (346, 224), (338, 250), (358, 260), (394, 248), (420, 230)])
    pedge = diff(ring(pect, 5), poly([(410, 180), (440, 180), (440, 260), (410, 260)]))
    hb = smooth([(424, 86), (448, 150), (454, 200), (446, 252), (422, 316), (392, 316), (406, 252), (412, 200), (406, 150), (392, 86)])
    mb = smooth([(302, 86), (322, 140), (332, 190), (318, 250), (300, 316), (256, 316), (272, 250), (278, 195), (268, 140), (256, 86)])
    tb = smooth([(172, 130), (178, 200), (172, 270), (138, 270), (144, 200), (138, 130)])
    bands = union(hb, mb, tb)
    inkb = inter(body, bands)
    papb = inter(body, buffer(bands, -6))
    ball, pupil, gl = eye_ring(462, 168, 15, 8)
    mouth = line([(501, 220), (490, 224), (482, 222)])
    return dict(id='clownfish', name='Clownfish', latin='Amphiprion ocellaris', W=W, H=H, layers=[
        layer(fins, 'dots', True, 2.5),
        layer(finedge, 'ink'),
        layer(body, 'dots', True, 2.5),
        layer(inkb, 'ink'),
        layer(papb, 'paper'),
        layer(pect, 'dots', True, 2),
        layer(ball, 'paper', True, 2),
        layer(combine([pedge, pupil]), 'ink'),
        layer(gl, 'paper'),
        layer(combine([body, mouth]), 'none', True, 2.5),
    ])


# ------------------------------------------------------------------ seahorse
def seahorse():
    W, H = 400, 600
    head = smooth([(334, 125), (336, 135), (334, 145), (316, 143), (290, 142), (268, 147), (254, 161), (246, 178),
                   (220, 190), (176, 170), (172, 150), (178, 128), (186, 108), (192, 88), (190, 70, 'c'), (200, 62),
                   (204, 50, 'c'), (212, 56), (218, 46, 'c'), (224, 58), (230, 54, 'c'), (230, 76), (238, 94),
                   (256, 106), (276, 115), (304, 119)])
    trunk = smooth([(176, 150), (220, 160), (248, 172), (262, 204), (290, 250), (302, 300), (294, 350), (270, 392),
                    (246, 420), (222, 414), (210, 390), (194, 350), (182, 300), (172, 250), (168, 200)])
    tc = [(234, 400), (226, 456), (232, 506), (254, 546), (290, 560), (318, 546), (324, 514), (308, 492), (286, 496),
          (282, 516), (296, 526)]
    tailt = tube(tc, [(0, 50), (0.15, 34), (0.5, 18), (0.8, 10), (1, 6)])
    sil = union(head, trunk, tailt)
    rings = []
    for y in range(206, 410, 19):
        rings.append(line([(150, y - 12), (230, y + 2), (320, y - 10)]))
    for p, n, t in normals_along(tc, 13):
        if 0.08 < t < 0.86:
            rings.append(line([(p[0] - n[0] * 40, p[1] - n[1] * 40), (p[0] + n[0] * 40, p[1] + n[1] * 40)]))
    rl = inter(combine(rings), sil)
    knobs = []
    if rl is not None:
        for sub in rl.subs:
            for q in (sub['start'], sub['segs'][-1][-1]):
                knobs.append(Point(q).buffer(4.2, 12))
    sil = from_geom(unary_union([sil.geom] + knobs))
    rl = inter(rl, buffer(sil, -1)) if rl is not None else None
    dfin = smooth([(184, 262), (150, 268), (128, 288), (124, 316), (138, 336), (192, 344)])
    rays = inter(combine([line([(186, 300), (186 - 70 * math.cos(a), 300 - 70 * math.sin(a))]) for a in [-0.75, -0.4, -0.1, 0.2, 0.5, 0.8]]), buffer(dfin, -2))
    pfin = smooth([(214, 168), (200, 156), (188, 158), (184, 170), (194, 182), (210, 182)])
    prays = inter(combine([line([(214, 172), (186 + 4 * k, 150 + 8 * k)]) for k in range(5)]), buffer(pfin, -1.5))
    ball, pupil, gl = eye_ring(228, 122, 10, 5.5)
    lines = combine([line([(256, 129), (296, 131)]), line([(204, 138), (216, 152), (238, 158)])])
    return dict(id='seahorse', name='Seahorse', latin='Hippocampus kuda', W=W, H=H, layers=[
        layer(dfin, 'paper', True, 2),
        layer(rays, 'none', True, 1.5),
        layer(sil, 'dots', True, 2.5),
        layer(rl, 'none', True, 1.8),
        layer(pfin, 'dots', True, 1.8),
        layer(ball, 'paper', True, 2),
        layer(pupil, 'ink'),
        layer(gl, 'paper'),
        layer(lines, 'none', True, 1.6),
    ])


# ------------------------------------------------------------------ day octopus
def day_octopus():
    W, H = 600, 460
    rng = random.Random(3)
    mant = smooth(rot([(300, 30), (352, 40), (388, 80), (396, 132), (380, 180), (346, 208), (300, 214), (254, 206),
                       (220, 176), (206, 128), (218, 78), (250, 42)], -24, 300, 230))
    headb = ellipse(300, 236, 86, 42)
    arms_c = [
        [(262, 250), (180, 270), (110, 252), (66, 210), (72, 176), (98, 172), (102, 192)],
        [(272, 262), (206, 306), (134, 332), (84, 364), (66, 404), (92, 424), (108, 406)],
        [(290, 268), (264, 326), (226, 382), (210, 418), (230, 440), (248, 426)],
        [(308, 270), (318, 334), (312, 388), (330, 428), (356, 424), (356, 404)],
        [(326, 266), (368, 322), (414, 368), (462, 396), (494, 388), (488, 366)],
        [(340, 256), (412, 290), (482, 300), (532, 278), (548, 246), (530, 234), (518, 250)],
        [(350, 244), (430, 236), (498, 206), (538, 164), (532, 132), (510, 134), (512, 154)],
    ]
    arms = [tube(c, [(0, 40), (0.3, 26), (0.7, 12), (0.9, 7), (1, 4)]) for c in arms_c]
    sil = union(mant, headb, *arms)
    suck = []
    for c in arms_c:
        for p, n, t in normals_along(c, 9):
            if 0.22 < t < 0.93:
                w = 40 * (1 - t) * 0.75 + 4
                r = max(1.8, 4.6 * (1 - t) + 1.4)
                q = (p[0] + n[0] * (w * 0.42), p[1] + n[1] * (w * 0.42))
                suck.append(ellipse(q[0], q[1], r))
    suck = keep_inside(suck, sil, 0.5)
    eyeL, eyeR = (240, 214), (360, 214)
    spots = scatter(rng, buffer(mant, -6), 26, 4.5, 7.5, margin=2, gap=5,
                    avoid=union(ellipse(eyeL[0], eyeL[1], 20), ellipse(eyeR[0], eyeR[1], 20)))
    balls = combine([ellipse(eyeL[0], eyeL[1], 12, 11), ellipse(eyeR[0], eyeR[1], 12, 11)])
    pupils = combine([tube([(eyeL[0] - 7, eyeL[1]), (eyeL[0] + 7, eyeL[1])], [(0, 4.5), (1, 4.5)]),
                      tube([(eyeR[0] - 7, eyeR[1]), (eyeR[0] + 7, eyeR[1])], [(0, 4.5), (1, 4.5)])])
    folds = combine([line([(224, 199), (240, 193), (256, 197)]), line([(344, 197), (360, 193), (376, 199)])])
    siphon = tube([(372, 236), (392, 250), (404, 252)], [(0, 14), (1, 10)])
    return dict(id='day-octopus', name='Day octopus', latin='Octopus cyanea', W=W, H=H, layers=[
        layer(siphon, 'dots', True, 2),
        layer(sil, 'dots', True, 2.5),
        layer(spots, 'paper'),
        layer(suck, 'paper', True, 1.5),
        layer(balls, 'paper', True, 2),
        layer(pupils, 'ink'),
        layer(folds, 'none', True, 1.8),
    ])


# ------------------------------------------------------------------ moon jellyfish
def moon_jellyfish():
    W, H = 400, 560
    rim = []
    pts = [(372, 200), (300, 210), (200, 214), (100, 210), (28, 200)]
    for a, b in zip(pts[:-1], pts[1:]):
        rim.extend(bumps(a, b, 6, 6, side=-1)[1:])
    bell = smooth([(28, 200), (38, 158), (80, 110), (140, 82), (200, 74), (260, 82), (320, 110), (362, 158)] + rim[:-1])
    shade = inter(bell, smooth([(0, 600), (0, 150), (100, 178), (200, 186), (300, 178), (400, 150), (400, 600)]))
    ctr = (200, 138)
    canals = []
    for k in range(16):
        a = 2 * math.pi * k / 16 + 0.1
        canals.append(line([(ctr[0] + 20 * math.cos(a), ctr[1] + 10 * math.sin(a)),
                            (ctr[0] + 200 * math.cos(a), ctr[1] + 80 * math.sin(a))]))
    gon = []
    for cx, cy, rx, ry in [(200, 104, 25, 13), (200, 172, 32, 16), (138, 138, 26, 15), (262, 138, 26, 15)]:
        a0 = math.atan2((ctr[1] - cy) / ry, (ctr[0] - cx) / rx)
        arc = []
        for i in range(25):
            t = a0 + 0.6 + i * (2 * math.pi - 1.2) / 24
            arc.append((cx + rx * math.cos(t), cy + ry * math.sin(t)))
        gon.append(tube(arc, [(0, 7), (1, 7)]))
    gon = combine(gon)
    canals = inter(combine(canals), diff(buffer(bell, -4), buffer(gon, 4)))
    oral = []
    for x0, sway, ln, w0 in [(184, -1, 440, 30), (216, 1, 430, 30), (160, -1, 390, 22), (242, 1, 396, 22)]:
        c = [(x0, 205)]
        for i in range(1, 7):
            y = 205 + (ln - 205) * i / 6
            c.append((x0 + sway * (i * 7) + 10 * math.sin(i * 1.4 + x0), y))
        oral.append(tube(c, [(0, w0), (0.5, w0 * 0.8), (1, 6)]))
    frill = []
    for o in oral:
        g = o.geom
        for p in list(g.exterior.coords)[::7]:
            if p[1] > 222:
                frill.append(Point(p).buffer(5, 10))
    oral = from_geom(unary_union([o.geom for o in oral] + frill))
    tent = []
    for i, p in enumerate(rim[1:-1]):
        L = 60 + 40 * ((i * 7) % 5) / 4
        s = 1 if i % 2 else -1
        tent.append(line([(p[0], p[1] + 2), (p[0] + 5 * s, p[1] + L * 0.5), (p[0] - 3 * s, p[1] + L)]))
    tent = combine(tent)
    bub = combine([ellipse(356, 48, 7), ellipse(374, 24, 4.5), ellipse(340, 16, 3)])
    return dict(id='moon-jellyfish', name='Moon jellyfish', latin='Aurelia aurita', W=W, H=H, layers=[
        layer(tent, 'none', True, 1.5),
        layer(oral, 'dots', True, 2),
        layer(bell, 'paper', True, 2.5),
        layer(shade, 'dots'),
        layer(canals, 'none', True, 1.5),
        layer(gon, 'ink'),
        layer(combine([bell, bub]), 'none', True, 2.5),
    ])


# ------------------------------------------------------------------ horseshoe crab (top view)
def horseshoe_crab():
    W, H = 400, 600
    pros = smooth([(200, 34), (296, 56), (354, 126), (374, 218), (370, 296, 'c'), (338, 254), (274, 242), (200, 238),
                   (126, 242), (62, 254), (30, 296, 'c'), (26, 218), (46, 126), (104, 56)])
    opis = smooth([(200, 236), (300, 244), (298, 300), (284, 356), (256, 406), (224, 432), (200, 438), (176, 432),
                   (144, 406), (116, 356), (102, 300), (100, 244)])
    sp = []
    for i in range(6):
        t = i / 5
        y = 266 + t * 134
        x = 298 - (t ** 1.6) * 44
        sp.append(poly([(x - 4, y - 8), (x + 16, y + 4), (x - 6, y + 8)]))
        sp.append(poly(mx([(x - 4, y - 8), (x + 16, y + 4), (x - 6, y + 8)], 200)))
    opis = union(opis, *sp)
    tel = tube([(200, 428), (202, 500), (198, 586)], [(0, 18), (0.7, 8), (1, 3)])
    eyes = combine([smooth([(116, 136), (126, 140), (130, 156), (124, 168), (114, 164), (112, 148)]),
                    smooth(mx([(116, 136), (126, 140), (130, 156), (124, 168), (114, 164), (112, 148)], 200))])
    ocel = combine([ellipse(193, 80, 3), ellipse(207, 80, 3)])
    ridges = combine([line([(200, 64), (200, 234)]),
                      line([(160, 70), (138, 120), (134, 180), (146, 238)]),
                      line(mx([(160, 70), (138, 120), (134, 180), (146, 238)], 200)),
                      line([(200, 262), (200, 420)]),
                      line([(150, 262), (160, 340), (186, 420)]), line(mx([(150, 262), (160, 340), (186, 420)], 200))])
    rim = inter(lines_from_geom(buffer(pros, -13).geom.exterior), poly([(0, 0), (400, 0), (400, 228), (0, 228)]))
    dimples = combine([ellipse(174 - i * 2.4, 278 + i * 24, 4, 3) for i in range(6)] + [ellipse(226 + i * 2.4, 278 + i * 24, 4, 3) for i in range(6)])
    return dict(id='horseshoe-crab', name='Horseshoe crab', latin='Tachypleus gigas', W=W, H=H, layers=[
        layer(tel, 'dots', True, 2.5),
        layer(opis, 'dots', True, 2.5),
        layer(pros, 'dots', True, 2.5),
        layer(combine([ridges, rim]), 'none', True, 1.8),
        layer(combine([eyes, ocel, dimples]), 'ink'),
    ])


# ------------------------------------------------------------------ cuttlefish
def cuttlefish():
    W, H = 600, 400
    rng = random.Random(12)
    mant = smooth([(410, 142), (360, 120), (280, 110), (200, 116), (134, 134), (84, 160), (58, 196), (70, 230),
                   (108, 254), (176, 272), (264, 280), (352, 272), (410, 256)])
    pts = resample([p for p in mant.geom.exterior.coords], 2.0)
    outer = []
    n = len(pts)
    for i in range(n):
        a, b = pts[(i - 2) % n], pts[(i + 2) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = dy / L, -dx / L
        off = 17 + 3.5 * math.sin(i * 2.0 * math.pi / 22)
        outer.append((pts[i][0] + nx * off, pts[i][1] + ny * off))
    op = SPoly(outer)
    if op.area < mant.geom.area:
        outer = [(2 * p[0] - q[0], 2 * p[1] - q[1]) for p, q in zip(pts, outer)]
        op = SPoly(outer)
    fin = from_geom(op.buffer(0).difference(SPoly([(404, 0), (600, 0), (600, 400), (404, 400)])))
    finl = []
    for i in range(0, n, 11):
        finl.append(line([pts[i], outer[i]]))
    finl = inter(combine(finl), diff(fin, mant))
    head = smooth([(398, 146), (436, 138), (470, 144), (494, 164), (500, 200), (492, 234), (470, 252), (436, 258), (398, 252)])
    arm_c = [[(480, 160), (526, 160), (566, 176), (586, 192)],
             [(488, 176), (534, 180), (574, 192), (592, 200)],
             [(492, 196), (540, 198), (578, 204), (594, 208)],
             [(490, 216), (536, 216), (574, 214), (590, 214)],
             [(482, 236), (526, 234), (566, 226), (584, 220)]]
    arms = [tube(c, [(0, 28), (0.5, 17), (0.85, 8), (1, 3)]) for c in arm_c]
    headarms = union(head, *arms)
    armlines = inter(combine([line(c[1:]) for c in arm_c[1:4]]), buffer(headarms, -4)) if False else None
    stripes = []
    for k in range(8):
        x = 108 + k * 36 + rng.uniform(-4, 4)
        w = rng.uniform(10, 12)
        stripes.append(tube([(x + 8, 104), (x + 2, 140), (x - 4, 182)], [(0, w), (0.6, w * 0.7), (1, 2.5)]))
    stripes = inter(combine(stripes), buffer(mant, -7))
    edge = ring(mant, 6)
    ball = ellipse(450, 184, 19, 15)
    wpup = tube([(436, 181), (443, 191), (450, 183), (457, 191), (464, 181)], [(0, 5), (1, 5)])
    lid = line([(428, 176), (450, 162), (474, 172)])
    return dict(id='cuttlefish', name='Cuttlefish', latin='Sepia pharaonis', W=W, H=H, layers=[
        layer(fin, 'paper', True, 2),
        layer(finl, 'none', True, 1.5),
        layer(mant, 'dots', True, 2.5),
        layer(stripes, 'ink'),
        layer(edge, 'paper'),
        layer(headarms, 'dots', True, 2.5),
        layer(ball, 'paper', True, 2),
        layer(wpup, 'ink'),
        layer(combine([mant, lid]), 'none', True, 2.5),
    ])


ANIMALS = [scalloped_hammerhead, clownfish, seahorse, day_octopus, moon_jellyfish, horseshoe_crab, cuttlefish]
