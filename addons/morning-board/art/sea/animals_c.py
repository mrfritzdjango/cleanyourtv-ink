import math
import random

from shapely.geometry import Point, Polygon as SPoly, LineString as SLine
from shapely.ops import unary_union
from geom import *
from animals_a import sym_x, sym_y, eye, bumps, arch
from animals_b import normals_along, eye_ring


def seg_tube(pts, w0, w1):
    """straight jointed limb through pts, width w0 at the start to w1 at the end"""
    parts = []
    n = len(pts) - 1
    for i in range(n):
        a, b = pts[i], pts[i + 1]
        wa = w0 + (w1 - w0) * i / n
        wb = w0 + (w1 - w0) * (i + 1) / n
        parts.append(unary_union([Point(a).buffer(wa / 2, 16), Point(b).buffer(wb / 2, 16)]).convex_hull)
    return from_geom(unary_union(parts))


def polar(c, r, a):
    return (c[0] + r * math.cos(a), c[1] + r * math.sin(a))


# ------------------------------------------------------------------ lionfish
def lionfish():
    W, H = 600, 450
    body = smooth([(482, 232), (474, 206), (454, 186), (414, 172), (354, 167), (294, 174), (244, 188), (204, 206),
                   (180, 216, 'c'), (180, 240, 'c'), (208, 250), (254, 264), (314, 276), (374, 280), (424, 272),
                   (460, 258), (478, 246)])

    def top_y(x):
        g = body.geom.intersection(SLine([(x, 0), (x, 450)]))
        return g.bounds[1]
    spines, bands, roots = [], [], []
    ns = 13
    for i in range(ns):
        t = i / (ns - 1)
        x = 432 - t * 172
        y = top_y(x) + 6
        ang = math.radians(-100 - t * 42)
        L = 168 - t * 80
        tip = (x + L * math.cos(ang), y + L * math.sin(ang))
        mid = (x + 0.5 * L * math.cos(ang) + 5, y + 0.5 * L * math.sin(ang))
        c = [(x, y), mid, tip]
        roots.append((x, y, ang, L))
        spines.append(tube(c, [(0, 9), (1, 3)]))
        pts = centerline_pts(c, 1.0)
        n = len(pts)
        for k in range(int(n * 0.28), n - 4, 22):
            bands.append(tube([pts[k], pts[min(n - 1, k + 11)]], [(0, 12), (1, 12)]))
    spines = combine(spines)
    bands = inter(combine(bands), buffer(spines, -1.2))
    mp = [(446, 192)]
    for i, r in enumerate(roots):
        mp.append((r[0] + 0.4 * r[3] * math.cos(r[2]), r[1] + 0.4 * r[3] * math.sin(r[2]), 'c'))
        if i < ns - 1:
            r2 = roots[i + 1]
            a = (r[2] + r2[2]) / 2
            l = 0.2 * (r[3] + r2[3]) / 2
            mp.append(((r[0] + r2[0]) / 2 + l * math.cos(a), (r[1] + r2[1]) / 2 + l * math.sin(a)))
    mp += [(250, 204), (330, 200), (420, 196)]
    memb = smooth(mp)
    soft = smooth([(262, 190), (244, 154), (214, 136), (186, 142), (172, 172), (182, 214), (236, 206)])
    tail = smooth([(188, 212), (152, 182), (114, 168), (86, 178), (72, 206), (70, 228), (74, 252), (88, 278),
                   (116, 288), (152, 274), (188, 246)])
    anal = smooth([(304, 272), (294, 310), (266, 334), (236, 330), (222, 300), (230, 262)])
    clear = combine([soft, tail, anal])
    tspots = keep_inside([ellipse(x + (7 if (y // 14) % 2 else 0), y, 3.2) for x in range(70, 300, 14) for y in range(130, 345, 14)],
                         diff(buffer(clear, -3), body))
    root = (404, 252)
    fan_pts = [root]
    rays = []
    a0, a1 = math.radians(78), math.radians(172)
    nr = 13
    for i in range(nr):
        a = a0 + (a1 - a0) * i / (nr - 1)
        R = 182 - 36 * abs(i - 5) / 7
        rays.append(line([polar(root, 26, a), polar(root, R * 0.7, a + 0.015), polar(root, R, a + 0.04)]))
        fan_pts.append(polar(root, R * 0.74, a, ))
        if i < nr - 1:
            fan_pts.append(polar(root, R * 0.62, a + (a1 - a0) / (nr - 1) / 2))
    pect = from_geom(poly(fan_pts).geom.buffer(3).buffer(-3))
    pb = []
    for r0 in (54, 88, 120):
        arc = [polar(root, r0, a0 - 0.1 + (a1 - a0 + 0.2) * k / 30) for k in range(31)]
        pb.append(tube(arc, [(0, 9), (1, 9)]))
    pbands = inter(combine(pb), buffer(pect, -3))
    pelv = smooth([(432, 272), (418, 318), (402, 360), (388, 392, 'c'), (390, 352), (394, 310), (408, 272)])
    st = []
    for k in range(12):
        x = 196 + k * 21
        st.append(tube([(x + 16, 158), (x + 4, 220), (x - 6, 292)], [(0, 7), (1, 7)]))
    for a in (1.0, 1.6, 2.3):
        st.append(tube([polar((438, 208), 16, a), polar((438, 208), 62, a)], [(0, 6), (1, 5)]))
    stripes = inter(combine(st), diff(body, ellipse(438, 208, 15)))
    ed = ellipse(438, 208, 12)
    pupil = ellipse(439, 208, 7)
    tent = smooth([(432, 196), (420, 170), (410, 150, 'c'), (426, 166), (442, 194)])
    return dict(id='lionfish', name='Lionfish', latin='Pterois volitans', W=W, H=H, layers=[
        layer(clear, 'paper', True, 2),
        layer(tspots, 'ink'),
        layer(spines, 'paper', True, 1.5),
        layer(bands, 'ink'),
        layer(combine([union(body, memb), tent]), 'dots', True, 2.5),
        layer(stripes, 'ink'),
        layer(pect, 'dots', True, 2),
        layer(combine([pbands, ed]), 'paper'),
        layer(combine(rays + [ed]), 'none', True, 1.6),
        layer(pupil, 'ink'),
    ])


# ------------------------------------------------------------------ pufferfish
def pufferfish():
    W, H = 600, 480
    rng = random.Random(5)
    c = (300, 245)
    R = 165
    ball = ellipse(c[0], c[1], R, R - 8)
    spikes = []
    n = 30
    for i in range(n):
        a = 2 * math.pi * i / n + 0.05
        if abs(math.atan2(math.sin(a), math.cos(a))) < 0.32:
            continue
        b = polar(c, R - 14, a - 0.07)
        e = polar(c, R - 14, a + 0.07)
        tip = polar(c, R + 22, a)
        spikes.append(poly([b, tip, e]))
    sil = union(ball, *spikes)
    tail = smooth([(150, 222), (116, 196), (86, 186), (74, 222), (72, 262), (82, 300), (114, 294), (150, 268)])
    dfin = smooth([(208, 112), (186, 82), (162, 76), (154, 98), (176, 128)])
    afin = smooth(my([(208, 112), (186, 82), (162, 76), (154, 98), (176, 128)], 245))
    back = combine([tail, dfin, afin])
    belly = inter(sil, smooth([(0, 480), (0, 286), (150, 300), (300, 312), (450, 300), (600, 286), (600, 480)]))
    upper = diff(ball, belly)
    spots = scatter(rng, buffer(upper, -6), 30, 4.5, 7, margin=2, gap=7, avoid=buffer(ellipse(398, 200, 26), 4))
    marks = []
    for k in range(40):
        x, y = rng.uniform(150, 460), rng.uniform(100, 390)
        if math.hypot(x - c[0], y - c[1]) < R - 22 and math.hypot(x - 398, y - 200) > 34 and math.hypot(x - 384, y - 280) > 34:
            marks.append(line([(x - 4, y + 3), (x, y - 4), (x + 4, y + 3)]))
    marks = inter(combine(marks), belly)
    pect = smooth([(384, 268), (360, 250), (338, 258), (332, 284), (344, 304), (366, 300), (382, 288)])
    prays = inter(combine([line([(384, 276), (330 + 6 * k, 248 + 14 * k)]) for k in range(5)]), buffer(pect, -2))
    eball, pupil, gl = eye_ring(398, 200, 24, 13)
    mouth = combine([ellipse(468, 252, 9, 7), ellipse(466, 268, 8, 6)])
    lid = line([(372, 184), (396, 170), (424, 180)])
    return dict(id='pufferfish', name='Pufferfish', latin='Arothron nigropunctatus', W=W, H=H, layers=[
        layer(back, 'dots', True, 2.5),
        layer(sil, 'dots', True, 2.5),
        layer(belly, 'paper'),
        layer(combine([marks, lid]), 'none', True, 1.8),
        layer(pect, 'dots', True, 2),
        layer(combine([eball, mouth]), 'paper', True, 2),
        layer(combine([spots, pupil]), 'ink'),
        layer(gl, 'paper'),
        layer(prays, 'none', True, 1.5),
        layer(sil, 'none', True, 2.5),
    ])


# ------------------------------------------------------------------ bumphead parrotfish
def bumphead_parrotfish():
    W, H = 600, 400
    body = smooth([(546, 242), (540, 224), (550, 208), (568, 188), (574, 160), (568, 128), (550, 102), (522, 84),
                   (486, 74), (440, 72), (390, 78), (330, 90), (250, 110), (180, 136), (136, 160), (116, 170, 'c'),
                   (116, 228, 'c'), (140, 240), (200, 272), (280, 300), (370, 312), (440, 302), (494, 284), (528, 266)])
    tail = smooth([(126, 170), (88, 140), (54, 114), (40, 108, 'c'), (48, 158), (50, 200), (48, 242), (40, 292, 'c'),
                   (54, 288), (88, 262), (126, 228)])
    dors = smooth([(460, 84), (446, 58), (390, 56), (330, 68), (252, 88), (186, 116), (150, 142), (176, 154), (300, 114), (420, 94)])
    anal = smooth([(330, 300), (306, 334), (250, 328), (208, 296), (260, 286)])
    pelv = smooth([(424, 300), (414, 334), (396, 352, 'c'), (390, 322), (394, 300)])
    fins = combine([tail, dors, anal, pelv])
    finl = []
    for x in range(180, 450, 22):
        finl.append(line([(x, 140), (x + 10, 40)]))
    for x in range(56, 120, 12):
        finl.append(line([(x + 70, 200), (x - 10, 200 + (x - 88) * 2.6)]))
    finl = inter(combine(finl), buffer(diff(fins, body), -3))
    pect = smooth([(444, 232), (412, 218), (372, 222), (350, 240), (380, 254), (424, 250)])
    scales = []
    for row in range(9):
        y = 112 + row * 22
        off = 11 if row % 2 else 0
        for x in range(150 + off, 470, 22):
            b0, b1 = math.radians(115), math.radians(245)
            scales.append(line([polar((x, y), 12, b0 + (b1 - b0) * k / 6) for k in range(7)]))
    scales = inter(combine(scales), diff(buffer(body, -5), poly([(462, 0), (600, 0), (600, 400), (462, 400)])))
    beak = combine([poly([(553, 212), (536, 208), (520, 216), (516, 226), (530, 232), (550, 233)]),
                    poly([(549, 237), (530, 236), (516, 242), (520, 252), (534, 258), (546, 253)])])
    face = inter(body, smooth([(600, 60), (548, 84), (540, 112), (544, 150), (540, 186), (528, 206), (520, 260), (600, 280)]))
    teeth = combine([line([(536, 210), (533, 231)]), line([(524, 216), (522, 230)]), line([(533, 237), (531, 256)]), line([(522, 241), (522, 252)])])
    eyeo = ellipse(506, 150, 7)
    eyeg = ellipse(506, 150, 11)
    oper = line([(474, 118), (456, 170), (460, 230), (478, 262)])
    hump = combine([line([(548, 108), (562, 140), (562, 176), (548, 200)])])
    return dict(id='bumphead-parrotfish', name='Bumphead parrotfish', latin='Bolbometopon muricatum', W=W, H=H, layers=[
        layer(fins, 'dots', True, 2.5),
        layer(finl, 'none', True, 1.5),
        layer(body, 'dots', True, 2.5),
        layer(combine([face, eyeg]), 'paper'),
        layer(scales, 'none', True, 1.6),
        layer(pect, 'dots', True, 2),
        layer(beak, 'paper', True, 2),
        layer(eyeo, 'ink'),
        layer(combine([oper, teeth, body]), 'none', True, 2),
    ])


# ------------------------------------------------------------------ leatherback turtle
def leatherback_turtle():
    W, H = 600, 400
    rng = random.Random(21)
    shell = smooth([(472, 152), (424, 112), (344, 90), (252, 94), (170, 118), (110, 148), (54, 178, 'c'), (120, 198),
                    (204, 216), (304, 228), (404, 226), (466, 212)])
    head = smooth([(450, 154), (492, 140), (532, 146), (558, 166), (564, 190), (550, 210), (520, 220), (480, 216), (450, 206)])
    flip = smooth([(442, 214), (424, 256), (384, 298), (324, 338), (254, 366), (180, 384, 'c'), (240, 352), (300, 320),
                   (352, 284), (386, 250), (398, 222)])
    rflip = smooth([(134, 196), (114, 226), (92, 248), (74, 244), (82, 220), (102, 200)])
    ridges = []
    for pts in ([(446, 122), (346, 100), (252, 104), (162, 128), (66, 176)],
                [(456, 160), (346, 142), (246, 146), (150, 160), (68, 178)],
                [(460, 196), (346, 192), (244, 192), (144, 188), (70, 180)]):
        ridges.append(tube(pts, [(0, 5), (1, 2.5)]))
    ridges = inter(combine(ridges), buffer(shell, -3))
    plast = inter(shell, smooth([(0, 400), (0, 192), (150, 202), (300, 214), (480, 206), (600, 200), (600, 400)]))
    sp1 = scatter(rng, buffer(shell, -5), 70, 2.2, 3.4, margin=1, gap=4)
    sp2 = scatter(rng, buffer(flip, -4), 22, 2.2, 3.2, margin=1, gap=4)
    sp3 = scatter(rng, buffer(head, -4), 12, 2, 3, margin=1, gap=4, avoid=ellipse(524, 172, 12))
    eball, pupil, gl = eye_ring(524, 172, 8, 4.5)
    beak = line([(562, 196), (540, 200), (520, 198)])
    return dict(id='leatherback-turtle', name='Leatherback turtle', latin='Dermochelys coriacea', W=W, H=H, layers=[
        layer(combine([rflip, head]), 'ink', True, 2.5),
        layer(buffer(shell, 3.5), 'paper'),
        layer(shell, 'ink', True, 2.5),
        layer(combine([ridges, plast, sp1, sp3]), 'paper'),
        layer(buffer(flip, 3.5), 'paper'),
        layer(flip, 'ink', True, 2.5),
        layer(combine([sp2, eball]), 'paper'),
        layer(pupil, 'ink'),
        layer(combine([shell, beak]), 'none', True, 2),
    ])


# ------------------------------------------------------------------ moray eel
def moray_eel():
    W, H = 600, 400
    rng = random.Random(8)
    cl = [(490, 136), (430, 152), (364, 196), (300, 246), (230, 268), (160, 250), (102, 204), (66, 146), (56, 96), (64, 60)]
    bodyt = tube(cl, [(0, 78), (0.15, 76), (0.6, 56), (0.88, 28), (1, 6)])
    head = smooth(sc([(462, 104), (518, 94), (556, 100), (580, 110, 'c'), (548, 120), (522, 128), (502, 134, 'c'), (530, 140),
                   (560, 146), (576, 151, 'c'), (552, 162), (520, 168), (480, 172), (452, 168)], 1.18, 1.18, 500, 136))
    sil = union(bodyt, head)
    fin = tube(cl, [(0, 78), (0.3, 78), (0.6, 72), (0.88, 46), (1, 16)])
    fin = diff(fin, poly([(330, 0), (600, 0), (600, 400), (330, 400)]))
    fin = from_geom(fin.geom.buffer(-1).buffer(1))
    mouth = smooth(sc([(579, 112), (548, 121), (522, 129), (503, 135, 'c'), (530, 140), (559, 146), (575, 150)], 1.18, 1.18, 500, 136))
    teeth = []
    for x in range(520, 576, 9):
        yt = 112 + (578 - x) * 0.25
        teeth.append(poly(sc([(x - 3, yt + 2), (x + 3, yt + 1), (x, yt + 8)], 1.18, 1.18, 500, 136)))
        yb = 150 - (576 - x) * 0.17
        teeth.append(poly(sc([(x - 3, yb - 1), (x + 3, yb - 2), (x, yb - 8)], 1.18, 1.18, 500, 136)))
    teeth = inter(combine(teeth), mouth)
    blot = []
    for k in range(400):
        x, y = rng.uniform(60, 500), rng.uniform(60, 330)
        r = rng.uniform(3.5, 6.5)
        blot.append(ellipse(x, y, r, r * rng.uniform(0.6, 1), rng.uniform(0, 180)))
    blot = keep_inside(blot, diff(buffer(sil, -3), ellipse(538, 108, 18)), 0)
    bl2 = []
    placed = []
    for b in blot.subs:
        pass
    eball, pupil, gl = eye_ring(538, 108, 9, 5)
    gill = ellipse(466, 160, 6, 3.5, -30)
    nost = tube([(578, 98), (584, 88)], [(0, 5), (1, 4)])
    return dict(id='moray-eel', name='Moray eel', latin='Gymnothorax javanicus', W=W, H=H, layers=[
        layer(fin, 'paper', True, 2),
        layer(sil, 'dots', True, 2.5),
        layer(mouth, 'ink'),
        layer(teeth, 'paper'),
        layer(combine([blot, gill, nost]), 'ink'),
        layer(eball, 'paper', True, 2),
        layer(pupil, 'ink'),
        layer(gl, 'paper'),
    ])


# ------------------------------------------------------------------ giant grouper
def giant_grouper():
    W, H = 600, 400
    rng = random.Random(4)
    body = smooth([(549, 192), (538, 172), (512, 146), (462, 118), (382, 100), (302, 102), (232, 116), (172, 142),
                   (134, 166), (118, 176, 'c'), (118, 232, 'c'), (140, 240), (190, 270), (270, 300), (360, 312),
                   (440, 302), (500, 280), (540, 250), (562, 226), (568, 208)])
    tail = smooth([(128, 172), (90, 146), (52, 144), (30, 178), (25, 210), (30, 242), (52, 274), (90, 270), (128, 236)])
    spiny = [(470, 124)]
    for i in range(11):
        t = i / 10
        x = 462 - t * 160
        y = 116 - 18 - 6 * math.sin(t * math.pi) + 0.0004 * (x - 380) ** 2
        spiny.append((x + 6, y + 9))
        spiny.append((x, y - 6, 'c'))
    dors = smooth(spiny + [(280, 96), (240, 70), (196, 74), (160, 100), (146, 150), (200, 150), (320, 116), (440, 128)])
    anal = smooth([(300, 300), (282, 338), (242, 352), (202, 338), (188, 302), (240, 292)])
    pelv = smooth([(432, 300), (420, 336), (400, 354, 'c'), (394, 330), (398, 300)])
    fins = combine([tail, dors, anal, pelv])
    pect = smooth([(442, 228), (412, 212), (370, 214), (344, 238), (348, 266), (380, 274), (422, 258), (444, 242)])
    fspots = scatter(rng, buffer(diff(union(tail, dors, anal), body), -2), 24, 3.5, 5, margin=2, gap=6)
    blot = []
    for bx, by, ang in [(410, 150, 0), (330, 140, 0), (250, 160, 0), (190, 190, 0), (370, 240, 0), (290, 250, 0), (220, 240, 0)]:
        for k in range(4):
            blot.append(ellipse(bx + rng.uniform(-18, 18), by + rng.uniform(-22, 22), rng.uniform(7, 13), rng.uniform(5, 9), rng.uniform(0, 180)))
    blot = inter(combine(blot), diff(buffer(body, -4), ellipse(454, 230, 0.1)))
    psp = scatter(rng, buffer(body, -6), 40, 3.5, 5, margin=2, gap=6, avoid=blot)
    mouth = line([(551, 199), (530, 204), (500, 212), (478, 214), (466, 206)])
    lip = line([(566, 210), (540, 226), (506, 230)])
    oper = line([(470, 136), (450, 180), (452, 230), (470, 268)])
    eyeo, eyeg = eye(496, 158, 6)
    return dict(id='giant-grouper', name='Giant grouper', latin='Epinephelus lanceolatus', W=W, H=H, layers=[
        layer(fins, 'dots', True, 2.5),
        layer(fspots, 'paper'),
        layer(body, 'dots', True, 2.5),
        layer(combine([blot, eyeo]), 'ink'),
        layer(combine([psp, eyeg]), 'paper'),
        layer(pect, 'dots', True, 2),
        layer(combine([mouth, lip, oper]), 'none', True, 2),
        layer(body, 'none', True, 2.5),
    ])


# ------------------------------------------------------------------ blue-spotted stingray (top view)
def blue_spotted_stingray():
    W, H = 400, 600
    rng = random.Random(2)
    disc = smooth([(200, 36, 'c'), (250, 50), (318, 96), (366, 152), (382, 192), (364, 230), (322, 270), (270, 300),
                   (230, 316), (200, 320), (170, 316), (130, 300), (78, 270), (36, 230), (18, 192), (34, 152), (82, 96), (150, 50)])
    pv = [(206, 310), (236, 316), (248, 338), (232, 346), (210, 334)]
    pelv = combine([smooth(pv), smooth(mx(pv, 200))])
    tc = [(200, 316), (204, 400), (214, 480), (206, 540), (194, 586)]
    tail = tube(tc, [(0, 24), (0.3, 14), (1, 3)])
    tb = []
    pts = centerline_pts(tc, 1.0)
    n = len(pts)
    for k in range(int(n * 0.55), n - 10, 26):
        tb.append(tube([pts[k], pts[min(n - 1, k + 13)]], [(0, 16), (1, 16)]))
    tb = inter(combine(tb), tail)
    mask = smooth([(132, 100), (200, 88), (268, 100), (270, 126), (200, 136), (130, 126)])
    eyes = combine([ellipse(170, 108, 11, 9), ellipse(230, 108, 11, 9)])
    pup = combine([ellipse(170, 108, 5, 3), ellipse(230, 108, 5, 3)])
    spir = combine([ellipse(166, 134, 5, 3.5), ellipse(234, 134, 5, 3.5)])
    spots = scatter(rng, buffer(disc, -8), 46, 5.5, 7.5, margin=2, gap=7, avoid=buffer(mask, 6))
    ridge = line([(200, 150), (200, 300)])
    sting = line([(200, 360), (206, 420)])
    return dict(id='blue-spotted-stingray', name='Blue-spotted stingray', latin='Neotrygon kuhlii', W=W, H=H, layers=[
        layer(combine([tail, pelv]), 'dots', True, 2.5),
        layer(tb, 'ink'),
        layer(disc, 'dots', True, 2.5),
        layer(mask, 'ink'),
        layer(combine([spots]), 'paper', True, 1.5),
        layer(eyes, 'paper', True, 2),
        layer(combine([pup, spir]), 'ink'),
        layer(combine([ridge, sting]), 'none', True, 1.8),
    ])


# ------------------------------------------------------------------ chambered nautilus
def chambered_nautilus():
    W, H = 600, 480
    c = (230, 200)
    R = 250.0
    b = math.log(3) / (2 * math.pi)
    ta = math.radians(75)
    pts = []
    N = 260
    for i in range(N + 1):
        th = ta + 2 * math.pi * i / N
        r = R * math.exp(-b * (th - ta))
        pts.append(polar(c, r, th))
    shell = poly(pts)
    shell = from_geom(shell.geom.buffer(0), 0.2)
    # stripes on the older half of the whorl
    st = []
    for k in range(16):
        th = ta + math.radians(70) + k * math.radians(17)
        ro = R * math.exp(-b * (th - ta))
        ri = ro * 0.18
        cpts = []
        for u in [i / 8 for i in range(9)]:
            a = th - 0.25 * u + 0.05 * math.sin(u * 2 * math.pi)
            cpts.append(polar(c, ri + (ro + 6 - ri) * u, a))
        wmax = 6 + 10 * min(1, ro / R)
        st.append(tube(cpts, [(0, 2.5), (0.5, wmax * 0.7), (1, wmax)]))
    stripes = inter(combine(st), buffer(shell, -1))
    umb = ellipse(c[0], c[1], 13)
    a_in = polar(c, R / 3, ta)
    a_out = polar(c, R, ta)
    # head, hood and tentacles in front of the aperture
    hood = smooth([(a_in[0] - 2, a_in[1] - 8), (278, 258), (318, 246), (364, 248), (400, 262), (418, 288), (410, 312),
                   (374, 322), (320, 322), (276, 316)])
    headm = smooth([(262, 310), (340, 318), (392, 316), (398, 352), (382, 404), (330, 432), (294, 436), (272, 380)])
    tent = []
    for i in range(15):
        t = i / 14
        y0 = 330 + t * 90
        a = math.radians(-28 + 62 * t)
        L = 150 + 30 * math.sin(t * math.pi)
        p0 = (370, y0)
        p1 = (p0[0] + L * 0.5 * math.cos(a) , p0[1] + L * 0.5 * math.sin(a) - 8)
        p2 = (p0[0] + L * math.cos(a + 0.12), p0[1] + L * math.sin(a + 0.12))
        tent.append(tube([p0, p1, p2], [(0, 9), (1, 3)]))
    tents = combine(tent)
    hspots = scatter(random.Random(9), buffer(hood, -5), 12, 4, 6.5, margin=1, gap=4)
    eball, pupil, gl = eye_ring(326, 354, 13, 7)
    lip = line([a_in, a_out])
    return dict(id='chambered-nautilus', name='Chambered nautilus', latin='Nautilus pompilius', W=W, H=H, layers=[
        layer(tents, 'dots', True, 2),
        layer(headm, 'dots', True, 2.5),
        layer(shell, 'paper', True, 2.5),
        layer(stripes, 'ink'),
        layer(umb, 'ink'),
        layer(hood, 'dots', True, 2.5),
        layer(combine([hspots, eball]), 'paper'),
        layer(pupil, 'ink'),
        layer(combine([shell, eball]), 'none', True, 2.5),
    ])


# ------------------------------------------------------------------ mudskipper
def mudskipper():
    W, H = 600, 340
    rng = random.Random(6)
    body = smooth([(560, 216), (554, 196), (538, 180), (520, 172), (496, 174), (460, 182), (400, 192), (330, 200),
                   (260, 208), (190, 216), (132, 224), (98, 228, 'c'), (98, 244, 'c'), (140, 250), (220, 254),
                   (320, 256), (420, 256), (490, 254), (530, 248), (552, 236)])
    tail = smooth([(108, 226), (72, 212), (42, 208), (28, 228), (30, 246), (52, 260), (86, 254), (108, 244)])
    d1 = smooth([(452, 186), (452, 140), (438, 104), (414, 86), (392, 98), (380, 140), (372, 196)])
    d2 = smooth([(350, 200), (342, 176), (300, 168), (240, 174), (180, 190), (150, 216), (200, 214)])
    anal = smooth([(330, 252), (300, 272), (240, 274), (180, 262), (150, 246)])
    fins = combine([tail, d1, d2, anal])
    d1edge = diff(ring(d1, 7), body)
    d1sp = keep_inside([ellipse(x, y, 4.2) for x, y in [(420, 112), (404, 126), (432, 140), (414, 150), (396, 160), (440, 166), (420, 172), (400, 182)]], buffer(diff(d1, body), -6))
    pect = smooth([(476, 236), (474, 264), (462, 282), (440, 288), (430, 282), (440, 264), (450, 242)])
    farball = ellipse(504, 160, 12)
    nearball = ellipse(524, 166, 15)
    pupils = combine([ellipse(504, 157, 7), ellipse(527, 163, 8.5)])
    gls = combine([ellipse(506, 154, 2.2), ellipse(530, 160, 2.6)])
    spots = scatter(rng, buffer(body, -5), 40, 2.5, 4.2, margin=1, gap=6, avoid=buffer(nearball, 6))
    mouth = line([(558, 224), (540, 232), (520, 232)])
    gill = line([(486, 190), (478, 220), (484, 248)])
    mud = smooth([(20, 296), (120, 288), (260, 292), (400, 286), (480, 290), (580, 286), (580, 300, 'c'), (20, 300, 'c')])
    mudl = combine([line([(30, 292), (140, 287), (260, 291), (400, 286), (520, 290), (575, 288)]),
                    line([(200, 302), (240, 300)]), line([(340, 300), (390, 302)]), line([(470, 302), (500, 300)])])
    return dict(id='mudskipper', name='Mudskipper', latin='Periophthalmodon schlosseri', W=W, H=H, layers=[
        layer(farball, 'paper', True, 2),
        layer(fins, 'dots', True, 2.5),
        layer(d1edge, 'ink'),
        layer(body, 'dots', True, 2.5),
        layer(combine([d1sp, spots, pupils]), 'ink'),
        layer(pect, 'dots', True, 2),
        layer(nearball, 'paper', True, 2),
        layer(combine([pupils, gls]) if False else ellipse(527, 163, 8.5), 'ink'),
        layer(gls, 'paper'),
        layer(combine([mouth, gill, mudl]), 'none', True, 2),
    ])


# ------------------------------------------------------------------ fiddler crab
def fiddler_crab():
    W, H = 600, 420
    legsL = [[(176, 172), (104, 132), (52, 210), (36, 262)],
             [(172, 196), (96, 170), (52, 262), (44, 318)],
             [(180, 220), (110, 212), (82, 300), (78, 356)],
             [(198, 238), (148, 250), (136, 326), (138, 380)]]
    legsR = [[(364, 180), (426, 214), (500, 256), (536, 300)],
             [(366, 202), (420, 244), (488, 290), (514, 340)],
             [(358, 222), (404, 268), (450, 320), (462, 372)],
             [(340, 238), (370, 286), (396, 336), (398, 386)]]
    legs = combine([seg_tube(l, 15, 6) for l in legsL + legsR])
    joints = []
    for l in legsL + legsR:
        for k in (1, 2):
            p = l[k]
            joints.append(line([(p[0] - 5, p[1] - 5), (p[0] + 5, p[1] + 5)]))
    cara = smooth([(166, 152), (270, 140), (374, 152), (388, 172), (374, 210), (342, 240), (270, 252), (198, 240), (166, 210), (152, 172)])
    stalks = combine([seg_tube([(244, 150), (238, 84)], 9, 7), seg_tube([(296, 150), (302, 84)], 9, 7)])
    eyes = combine([ellipse(237, 76, 9, 12), ellipse(303, 76, 9, 12)])
    egl = combine([ellipse(240, 71, 2.5), ellipse(306, 71, 2.5)])
    small = combine([seg_tube([(176, 202), (140, 228), (128, 262)], 15, 10), seg_tube([(126, 260), (118, 290)], 9, 4),
                     seg_tube([(136, 262), (140, 288)], 8, 4)])
    arm = seg_tube([(376, 196), (426, 222), (454, 200)], 26, 30)
    palm = ellipse(484, 186, 52, 76, -12)
    fixed = tube([(506, 126), (516, 78), (500, 26)], [(0, 30), (0.6, 18), (1, 8)])
    dact = tube([(462, 128), (446, 80), (474, 32)], [(0, 26), (0.6, 16), (1, 7)])
    claw = union(palm, fixed, dact)
    teeth = []
    for p, n, t in normals_along([(462, 128), (446, 80), (474, 32)], 9):
        if 0.25 < t < 0.85:
            q = (p[0] + n[0] * -8, p[1] + n[1] * -8)
            teeth.append(Point(q).buffer(3.2, 8))
    for p, n, t in normals_along([(506, 126), (516, 78), (500, 26)], 9):
        if 0.25 < t < 0.85:
            q = (p[0] + n[0] * 10, p[1] + n[1] * 10)
            teeth.append(Point(q).buffer(3.2, 8))
    claw = from_geom(unary_union([claw.geom] + teeth))
    gran = keep_inside([ellipse(x, y, 2.2) for x, y in [(470, 200), (486, 214), (500, 196), (478, 230), (496, 234), (512, 218), (462, 222), (488, 250), (506, 252)]], claw)
    face = combine([line([(230, 200), (270, 212), (310, 200)]), line([(200, 168), (240, 176)]), line([(340, 168), (300, 176)])])
    return dict(id='fiddler-crab', name='Fiddler crab', latin='Austruca annulipes', W=W, H=H, layers=[
        layer(combine([legs]), 'dots', True, 2),
        layer(combine(joints), 'none', True, 1.5) if False else None,
        layer(combine([cara, stalks, small, arm]), 'dots', True, 2.5),
        layer(eyes, 'ink'),
        layer(egl, 'paper'),
        layer(claw, 'paper', True, 2.5),
        layer(gran, 'ink'),
        layer(face, 'none', True, 1.6),
    ])


# ------------------------------------------------------------------ barracuda
def barracuda():
    W, H = 600, 300
    body = smooth([(590, 161), (577, 151), (548, 141), (500, 132), (440, 126), (360, 124), (280, 128), (200, 136),
                   (140, 145), (100, 150, 'c'), (100, 166, 'c'), (140, 170), (200, 176), (280, 184), (360, 188),
                   (440, 186), (500, 180), (552, 172), (588, 166)])
    d1 = smooth([(376, 126), (364, 100), (354, 88, 'c'), (346, 108), (330, 128)])
    d2 = smooth([(214, 138), (202, 116), (194, 108, 'c'), (190, 124), (176, 142)])
    an = smooth([(212, 176), (200, 198), (192, 206, 'c'), (188, 190), (174, 172)])
    pv = smooth([(372, 186), (354, 204), (340, 212, 'c'), (344, 198), (342, 184)])
    tail = smooth([(112, 146), (86, 120), (58, 94), (36, 74, 'c'), (54, 114), (72, 150), (72, 166), (54, 202), (36, 242, 'c'),
                   (58, 222), (86, 196), (112, 170)])
    fins = combine([d1, d2, an, pv, tail])
    pect = smooth([(476, 164), (446, 172), (424, 182, 'c'), (438, 166), (456, 158)])
    belly = inter(body, smooth([(0, 300), (0, 156), (200, 158), (400, 162), (520, 164), (600, 160), (600, 300)]))
    bars = []
    for k in range(15):
        x = 160 + k * 21
        bars.append(tube([(x + 10, 120), (x, 157)], [(0, 9), (1, 7)]))
    bars = inter(combine(bars), diff(buffer(body, -3), belly))
    blots = keep_inside([ellipse(x, y, 4.5, 3.5) for x, y in [(130, 162), (160, 166), (196, 170), (236, 174)]], body, 1)
    mouth = smooth([(589, 159), (548, 158), (520, 160, 'c'), (548, 163), (588, 164)])
    fangs = combine([poly([(x - 2.5, 158), (x + 2.5, 158), (x, 164)]) for x in (530, 545, 560, 575)])
    eball, pupil, gl = eye_ring(530, 146, 8, 5)
    lat = line([(500, 160), (400, 160), (300, 158), (200, 156), (112, 158)])
    return dict(id='barracuda', name='Barracuda', latin='Sphyraena barracuda', W=W, H=H, layers=[
        layer(fins, 'dots', True, 2.2),
        layer(body, 'dots', True, 2.5),
        layer(belly, 'paper'),
        layer(combine([bars, blots, mouth]), 'ink'),
        layer(fangs, 'paper'),
        layer(pect, 'dots', True, 2),
        layer(eball, 'paper', True, 2),
        layer(pupil, 'ink'),
        layer(gl, 'paper'),
        layer(combine([body, lat]), 'none', True, 2),
    ])


# ------------------------------------------------------------------ sea star (chocolate chip)
def sea_star():
    W, H = 500, 500
    c = (250, 256)
    arms = []
    mids = []
    for k in range(5):
        a = math.radians(-90 + 72 * k)
        bend = 0.12 if k % 2 else -0.1
        p1 = polar(c, 110, a + bend * 0.4)
        p2 = polar(c, 228, a + bend)
        mids.append([c, p1, p2])
        arms.append(tube([c, p1, p2], [(0, 116), (0.45, 74), (0.9, 36), (1, 28)]))
    star = union(ellipse(c[0], c[1], 74), *arms)
    rim = ring(star, 7)
    ridge = inter(combine([tube(m, [(0, 7), (1, 4)]) for m in mids]), buffer(star, -14))
    knobs, gl = [], []
    for m in mids:
        pts = centerline_pts(m, 1.0)
        n = len(pts)
        for t, r in [(0.28, 12), (0.45, 11), (0.6, 10), (0.74, 8.5), (0.87, 7)]:
            p = pts[int(t * (n - 1))]
            knobs.append(ellipse(p[0], p[1], r))
            gl.append(ellipse(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.28))
    for k in range(5):
        a = math.radians(-90 + 36 + 72 * k)
        p = polar(c, 42, a)
        knobs.append(ellipse(p[0], p[1], 10))
        gl.append(ellipse(p[0] - 3, p[1] - 3, 2.8))
    knobs.append(ellipse(c[0], c[1], 9))
    gl.append(ellipse(c[0] - 2.5, c[1] - 2.5, 2.5))
    return dict(id='sea-star', name='Sea star', latin='Protoreaster nodosus', W=W, H=H, layers=[
        layer(star, 'dots', True, 2.5),
        layer(combine([rim, ridge]), 'paper'),
        layer(combine(knobs), 'ink'),
        layer(combine(gl), 'paper'),
        layer(star, 'none', True, 2.5),
    ])


ANIMALS = [lionfish, pufferfish, bumphead_parrotfish, leatherback_turtle, moray_eel, giant_grouper,
           blue_spotted_stingray, chambered_nautilus, mudskipper, fiddler_crab, barracuda, sea_star]


# ------------------------------------------------------------------ titan triggerfish
def titan_triggerfish():
    W, H = 600, 440
    body = smooth([(548, 212), (530, 192), (500, 162), (460, 128), (410, 100), (360, 88), (300, 96), (240, 118),
                   (190, 150), (150, 182), (132, 196, 'c'), (132, 236, 'c'), (150, 250), (190, 282), (240, 314),
                   (300, 336), (360, 342), (410, 328), (450, 300), (490, 268), (520, 246), (546, 228)])
    trig = combine([tube([(384, 96), (376, 60), (364, 24)], [(0, 12), (1, 4)]),
                    tube([(366, 96), (360, 74), (352, 56)], [(0, 8), (1, 3)])])
    spmem = smooth([(388, 98), (372, 50), (358, 62), (348, 96)])
    dp = [(314, 100), (292, 74), (252, 58), (206, 58), (160, 68, 'c'), (174, 100), (178, 140), (200, 152), (262, 122)]
    dors = smooth(dp)
    anal = smooth(my(dp, 217))
    tail = smooth([(142, 192), (112, 168), (82, 138), (60, 114, 'c'), (76, 168), (82, 216), (76, 264), (60, 318, 'c'),
                   (82, 294), (112, 264), (142, 240)])
    fins = combine([dors, anal, tail, spmem])
    finedge = diff(ring(union(dors, anal, tail), 6), body)
    scl = []
    for k in range(-12, 14):
        scl.append(line([(120 + k * 26, 60), (120 + k * 26 + 300, 400)]))
        scl.append(line([(120 + k * 26 + 300, 60), (120 + k * 26, 400)]))
    scales = inter(combine(scl), diff(buffer(body, -6), poly([(418, 0), (600, 0), (600, 440), (418, 440)])))
    band = inter(body, smooth([(436, 80), (478, 100), (494, 160), (480, 250), (452, 330), (414, 330), (432, 250),
                               (440, 170), (414, 104)]))
    mouth = smooth([(552, 211), (536, 213), (518, 220, 'c'), (536, 227), (550, 229)])
    teeth = combine([poly([(x, 213 + (548 - x) * 0.12), (x + 5, 213 + (548 - x) * 0.12), (x + 2.5, 219)]) for x in (530, 538)] +
                    [poly([(x, 227 - (548 - x) * 0.12), (x + 5, 227 - (548 - x) * 0.12), (x + 2.5, 221)]) for x in (530, 538)] +
                    [poly([(545, 211), (551, 211), (549, 218), (545, 218)]), poly([(545, 222), (549, 222), (550, 229), (545, 229)])])
    lip = tube([(516, 204), (494, 208), (472, 220)], [(0, 6), (1, 3)])
    ering = ellipse(430, 140, 16)
    pupil = ellipse(431, 140, 8.5)
    glint = ellipse(434, 137, 2.5)
    pect = smooth([(408, 236), (388, 222), (366, 228), (358, 248), (372, 258), (398, 252)])
    gill = line([(410, 196), (404, 230), (410, 262)])
    return dict(id='titan-triggerfish', name='Titan triggerfish, also known as "TITANE"', latin='Balistoides viridescens',
                W=W, H=H, layers=[
        layer(trig, 'ink', True, 2),
        layer(fins, 'dots', True, 2.5),
        layer(finedge, 'ink'),
        layer(body, 'dots', True, 2.5),
        layer(scales, 'none', True, 1.5),
        layer(combine([band, mouth]), 'ink'),
        layer(pect, 'dots', True, 2),
        layer(combine([ering, lip, teeth]), 'paper'),
        layer(combine([pupil]), 'ink'),
        layer(combine([body, gill, glint]), 'none', True, 2.5),
    ])


ANIMALS.append(titan_triggerfish)
