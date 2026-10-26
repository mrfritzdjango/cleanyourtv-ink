import math
import random

from shapely.geometry import Polygon as SPoly, LineString as SLine
from geom import *
from shapely.geometry import Point
from shapely.ops import unary_union


def sym_x(right, axis):
    """right half from the top of the axis to the bottom; returns the full loop."""
    left = mx(list(reversed(right[1:-1])), axis)
    return right + left


def sym_y(top, axis):
    """top half from the right end of the axis to the left end; returns the full loop."""
    bottom = my(list(reversed(top[1:-1])), axis)
    return top + bottom


def eye(cx, cy, r, glint=True):
    """ink eye and its paper glint"""
    e = ellipse(cx, cy, r)
    g = ellipse(cx + r * 0.3, cy - r * 0.3, max(1.2, r * 0.3)) if glint else None
    return e, g


def bumps(p0, p1, n, amp, side=1):
    """points along p0->p1 with every other point pushed sideways by amp (scallops)."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * side, dx / L * side
    out = []
    for i in range(n + 1):
        t = i / n
        o = amp if i % 2 else 0
        out.append((p0[0] + dx * t + nx * o, p0[1] + dy * t + ny * o))
    return out


def arch(k, x0, dy=0.0):
    set_warp(lambda x, y: (x, y + k * (x - x0) ** 2 + dy))


# ------------------------------------------------------------------ green sea turtle
def green_sea_turtle():
    W, H = 600, 400
    cx, cy = 300, 200
    shell = smooth(sym_y([(454, 200), (444, 140), (402, 104), (326, 90), (246, 96), (184, 120), (148, 160), (136, 200)], cy))
    head = smooth(sym_y([(562, 200), (552, 174), (520, 160), (474, 162), (424, 174)], cy))
    fl = [(410, 126), (428, 98), (430, 66), (414, 42), (382, 26), (336, 18), (280, 16, 'c'), (322, 36), (352, 56),
          (374, 80), (384, 106), (376, 124)]
    rf = [(214, 134), (190, 108), (160, 90), (128, 86), (110, 96), (120, 116), (158, 142)]
    flippers = combine([smooth(fl), smooth(my(fl, cy)), smooth(rf), smooth(my(rf, cy)),
                        smooth([(142, 188), (102, 200, 'c'), (142, 212)])])
    inner = buffer(shell, -16)
    ringz = diff(shell, inner)
    tiles = []
    n = 22
    for i in range(n):
        a0 = 2 * math.pi * i / n + 0.07
        a1 = 2 * math.pi * (i + 1) / n + 0.07
        wedge = poly([(cx, cy), (cx + 400 * math.cos(a0), cy + 400 * math.sin(a0)), (cx + 400 * math.cos(a1), cy + 400 * math.sin(a1))])
        tiles.append(inter(ringz, wedge, 0))
    bx = [440, 392, 340, 286, 232, 140]
    vert = []
    for i in range(5):
        xa, xb = bx[i], bx[i + 1]
        m = (xa + xb) / 2
        hexa = poly([(xa, 162), (m, 150), (xb, 162), (xb, 238), (m, 250), (xa, 238)])
        vert.append(inter(hexa, inner, 0))
    vband = union(*vert, simplify=0)
    upper = diff(inter(inner, poly([(0, 0), (600, 0), (600, 200), (0, 200)]), 0), vband, 0)
    lower = diff(inter(inner, poly([(0, 200), (600, 200), (600, 400), (0, 400)]), 0), vband, 0)
    cb = [470, 366, 312, 256, 120]
    for half, sgn in ((upper, -1), (lower, 1)):
        for i in range(4):
            xa, xb = cb[i], cb[i + 1]
            ya = cy + sgn * 38
            yb = cy + sgn * 400
            qa = (xa + (xa - cx) * 0.9, yb)
            qb = (xb + (xb - cx) * 0.9, yb)
            if i == 0:
                cell = poly([(600, ya), (xb, ya), qb, (600, yb)])
            elif i == 3:
                cell = poly([(xa, ya), (0, ya), (0, yb), qa])
            else:
                cell = poly([(xa, ya), (xb, ya), qb, qa])
            tiles.append(inter(half, cell, 0))
    tiles.extend(vert)
    plates = combine([buffer(t, -2.6) for t in tiles if t is not None])
    eyes = combine([ellipse(524, 178, 7, 5, -12), ellipse(524, 222, 7, 5, 12)])
    glints = combine([ellipse(526, 176, 2), ellipse(526, 220, 2)])
    hl = combine([line([(552, 200), (500, 200)]),
                  line([(528, 184), (536, 200, 'c'), (528, 216)]),
                  line([(500, 180), (508, 200, 'c'), (500, 220)]),
                  line([(476, 172), (484, 200, 'c'), (476, 228)])])
    fmid = smooth(fl)
    cuts = combine([line([(420, 92), (392, 104)]), line([(416, 62), (380, 74)]), line([(390, 36), (360, 52)]), line([(350, 24), (330, 40)])])
    fls = inter(cuts, buffer(fmid, -3))
    flsm = inter(combine([line(my([sub['start'], sub['segs'][-1][-1]], cy)) for sub in cuts.subs]), buffer(smooth(my(fl, cy)), -3))
    return dict(id='green-sea-turtle', name='Green sea turtle', latin='Chelonia mydas', W=W, H=H, layers=[
        layer(flippers, 'dots', True, 2.5),
        layer(head, 'dots', True, 2.5),
        layer(shell, 'paper', True, 3),
        layer(plates, 'dots', True, 1.6),
        layer(eyes, 'ink'),
        layer(glints, 'paper'),
        layer(combine([hl, fls, flsm]), 'none', True, 1.6),
    ])


# ------------------------------------------------------------------ whale shark
def whale_shark():
    W, H = 600, 340
    rng = random.Random(7)
    body = smooth([(571, 150), (562, 133), (532, 119), (470, 107), (390, 101), (300, 103), (220, 113), (160, 127),
                   (112, 141), (84, 150, 'c'), (84, 170, 'c'), (130, 184), (220, 206), (320, 220), (420, 217),
                   (500, 206), (548, 194), (571, 184)])
    tail = smooth([(114, 140), (86, 106), (60, 64), (36, 26, 'c'), (52, 80), (63, 122), (68, 158), (60, 198),
                   (46, 250, 'c'), (78, 216), (98, 190), (116, 174)])
    d1 = smooth([(330, 106), (302, 80), (276, 56), (258, 42, 'c'), (254, 74), (244, 102), (230, 118)])
    d2 = smooth([(190, 122), (172, 106), (160, 94, 'c'), (156, 112), (146, 132)])
    pel = smooth([(240, 207), (224, 223), (206, 237, 'c'), (208, 220), (204, 200)])
    ana = smooth([(165, 191), (150, 205), (138, 215, 'c'), (139, 201), (132, 185)])
    back_fins = combine([tail, d1, d2, pel, ana])
    pect = smooth([(446, 204), (424, 236), (394, 262), (356, 284, 'c'), (370, 258), (384, 230), (396, 208)])
    belly_cut = smooth([(600, 180), (520, 186), (420, 194), (320, 198), (220, 188), (140, 174), (60, 166),
                        (60, 340, 'c'), (600, 340, 'c')])
    belly = inter(body, belly_cut)
    upper = diff(body, belly_cut, 0)
    marks = []
    xs = list(range(128, 440, 30))
    for x in xs:
        marks.append(tube([(x + 6, 96), (x, 150), (x - 4, 204)], [(0, 4), (1, 4)], 2.5))
    spots = []
    for x0, x1 in zip(xs[:-1], xs[1:]):
        xm = (x0 + x1) / 2 - 1
        for y in range(106, 205, 17):
            spots.append(ellipse(xm + rng.uniform(-1.5, 1.5), y + rng.uniform(-2, 2), rng.uniform(5.6, 6.6)))
    sp = keep_inside(spots, upper, 1.5)
    region = inter(upper, poly([(452, 0), (600, 0), (600, 340), (452, 340)]))
    hs = scatter(rng, region, 22, 4.6, 5.6, margin=4, gap=4.5)
    marks_all = inter(combine(marks), upper)
    ridges = combine([line([(440, 126), (360, 121), (260, 127), (170, 143), (104, 156)]),
                      line([(430, 152), (340, 154), (240, 160), (150, 166)])])
    ridges = inter(ridges, buffer(body, -3))
    pspots = keep_inside([ellipse(418, 228, 5.5), ellipse(400, 246, 5), ellipse(380, 262, 4.5)], pect, 1)
    eyeo, eyeg = eye(526, 152, 4.5)
    gills = combine([line([(484 - i * 11, 126 + i * 2), (480 - i * 11, 160), (482 - i * 11, 194 - i)]) for i in range(5)])
    mouth = smooth([(572, 157), (552, 165), (532, 170, 'c'), (552, 173), (572, 178)])
    return dict(id='whale-shark', name='Whale shark', latin='Rhincodon typus', W=W, H=H, layers=[
        layer(back_fins, 'dots', True, 2.5),
        layer(body, 'dots', True, 2.5),
        layer(belly, 'paper'),
        layer(marks_all, 'paper'),
        layer(combine([sp, hs]), 'paper', True, 1.5),
        layer(pect, 'dots', True, 2.5),
        layer(combine([pspots, eyeg]), 'paper'),
        layer(combine([eyeo, mouth]), 'ink'),
        layer(body, 'none', True, 2.5),
        layer(combine([gills, ridges]), 'none', True, 2),
    ])


# ------------------------------------------------------------------ reef manta ray
def reef_manta_ray():
    W, H = 600, 400
    right = [(300, 98), (326, 98), (346, 106), (392, 114), (452, 128), (510, 152), (554, 182), (584, 226, 'c'),
             (540, 214), (486, 212), (432, 224), (390, 246), (358, 274), (332, 298), (314, 312), (300, 316)]
    disc = smooth(sym_x(right, 300))
    cf = [(320, 100), (342, 102), (352, 80), (348, 58), (334, 44, 'c'), (334, 62), (330, 82)]
    ceph = combine([smooth(cf), smooth(mx(cf, 300))])
    tailc = tube([(300, 310), (302, 350), (296, 388)], [(0, 9), (1, 2)])
    pv = [(304, 308), (322, 314), (334, 330), (324, 340), (306, 328)]
    pelv = combine([smooth(pv), smooth(mx(pv, 300))])
    sh = [(328, 118), (384, 122), (446, 138), (500, 162), (456, 170), (404, 182), (360, 198), (338, 166)]
    patch = combine([smooth(sh), smooth(mx(sh, 300))])
    eyes = combine([ellipse(346, 110, 5), ellipse(254, 110, 5)])
    bub = combine([ellipse(556, 112, 7), ellipse(572, 84, 4.5), ellipse(552, 62, 3)])
    mid = tube([(300, 214), (300, 296)], [(0, 3.5), (1, 2.5)])
    return dict(id='reef-manta-ray', name='Reef manta ray', latin='Mobula alfredi', W=W, H=H, layers=[
        layer(combine([pelv, tailc]), 'ink', True, 2),
        layer(disc, 'ink', True, 2.5),
        layer(ceph, 'ink', True, 2),
        layer(patch, 'dots'),
        layer(combine([eyes, mid]), 'paper'),
        layer(bub, 'none', True, 2),
    ])


# ------------------------------------------------------------------ dugong
def dugong():
    W, H = 600, 340
    arch(0.0005, 340, -16)
    body = smooth([(571, 204), (568, 182), (558, 165), (538, 151), (506, 139), (450, 129), (380, 123), (300, 123),
                   (230, 131), (180, 145), (140, 161), (112, 173), (94, 181, 'c'), (94, 195, 'c'), (116, 203),
                   (150, 214), (200, 231), (270, 247), (350, 255), (430, 251), (482, 243), (510, 247), (536, 244),
                   (556, 236), (567, 223)])
    fluke = smooth([(104, 179), (80, 165), (58, 142), (38, 110, 'c'), (34, 132), (38, 160), (52, 182), (62, 188),
                    (52, 194), (38, 216), (34, 244), (38, 266, 'c'), (58, 234), (80, 210), (104, 197)])
    flip = smooth([(480, 240), (474, 268), (456, 294), (434, 306), (422, 298), (432, 272), (448, 246)])
    belly_cut = smooth([(600, 238), (520, 236), (440, 236), (340, 240), (240, 232), (160, 214), (80, 196), (80, 340, 'c'), (600, 340, 'c')])
    belly = inter(body, belly_cut)
    eyeo, eyeg = eye(514, 160, 4)
    nost = combine([ellipse(556, 166, 3.4, 2, 50), ellipse(549, 159, 3.4, 2, 50)])
    bristle = combine([ellipse(x, y, 1.7) for x, y in [(562, 206), (556, 214), (563, 219), (552, 224), (546, 230), (558, 228)]])
    scars = combine([tube([(330, 131), (300, 134)], [(0, 3), (1, 3)]), tube([(256, 137), (234, 143)], [(0, 3), (1, 3)]),
                     tube([(392, 135), (376, 145)], [(0, 3), (1, 3)])])
    lines = combine([line([(568, 196), (556, 214), (538, 236), (528, 243)]), line([(494, 168), (488, 205), (492, 236)]),
                     line([(80, 172), (74, 188), (80, 204)])])
    set_warp(None)
    bub = combine([ellipse(584, 132, 5), ellipse(576, 106, 3.5), ellipse(588, 86, 2.5)])
    return dict(id='dugong', name='Dugong', latin='Dugong dugon', W=W, H=H, layers=[
        layer(fluke, 'dots', True, 2.5),
        layer(body, 'dots', True, 2.5),
        layer(combine([belly, scars]), 'paper'),
        layer(flip, 'dots', True, 2.5),
        layer(combine([eyeo, nost, bristle]), 'ink'),
        layer(eyeg, 'paper'),
        layer(body, 'none', True, 2.5),
        layer(combine([lines, bub]), 'none', True, 1.6),
    ])


# ------------------------------------------------------------------ irrawaddy dolphin
def irrawaddy_dolphin():
    W, H = 600, 340
    arch(0.0011, 340, -30)
    body = smooth([(572, 192), (566, 164), (546, 142), (510, 128), (450, 118), (380, 116), (310, 122), (250, 134),
                   (200, 150), (160, 164), (130, 174), (106, 180), (96, 182, 'c'), (96, 192, 'c'), (110, 194),
                   (140, 200), (190, 214), (260, 232), (350, 244), (430, 242), (495, 232), (545, 218), (566, 205)])
    dors = smooth([(304, 124), (286, 108), (268, 96), (252, 92, 'c'), (254, 108), (246, 124), (232, 140)])
    fluke = smooth([(108, 180), (86, 168), (62, 154), (36, 140, 'c'), (40, 158), (50, 176), (62, 187),
                    (50, 198), (40, 216), (36, 234, 'c'), (62, 220), (86, 206), (108, 194)])
    flip = smooth([(478, 226), (470, 258), (448, 286), (422, 298), (410, 290), (424, 260), (444, 232)])
    belly_cut = smooth([(600, 202), (520, 204), (430, 210), (320, 212), (220, 200), (140, 192), (60, 188), (60, 340, 'c'), (600, 340, 'c')])
    belly = inter(body, belly_cut)
    eyeo, eyeg = eye(524, 178, 5)
    lines = combine([line([(569, 199), (550, 202), (528, 201), (518, 196)]),
                     line([(488, 124), (480, 128), (472, 125)]),
                     line([(534, 188), (524, 190), (514, 188)])])
    return dict(id='irrawaddy-dolphin', name='Irrawaddy dolphin', latin='Orcaella brevirostris', W=W, H=H, layers=[
        layer(combine([fluke, dors]), 'dots', True, 2.5),
        layer(body, 'dots', True, 2.5),
        layer(belly, 'paper'),
        layer(flip, 'dots', True, 2.5),
        layer(eyeo, 'ink'),
        layer(eyeg, 'paper'),
        layer(body, 'none', True, 2.5),
        layer(lines, 'none', True, 2),
    ])


# ------------------------------------------------------------------ humpback whale
def humpback_whale():
    W, H = 600, 340
    arch(0.0005, 330, -20)
    body = smooth([(582, 177), (570, 166), (540, 158), (500, 150), (460, 142), (410, 134), (350, 130), (290, 132),
                   (240, 136), (205, 141), (160, 153), (120, 166), (92, 176, 'c'), (94, 190, 'c'), (126, 200),
                   (180, 220), (250, 240), (330, 256), (410, 263), (470, 257), (520, 241), (556, 220), (576, 197)])
    dors = smooth([(240, 138), (224, 126), (210, 118, 'c'), (206, 132), (194, 146)])
    fl_top = [(104, 175), (80, 160), (58, 136), (36, 116, 'c')]
    trail = bumps((36, 116), (62, 184), 6, 3.5, side=1)[1:] + bumps((62, 184), (38, 254), 6, 3.5, side=1)[1:]
    fluke = smooth(fl_top + trail[:-1] + [(38, 254, 'c'), (58, 234), (80, 210), (104, 192)])
    throat = inter(body, smooth([(600, 190), (576, 194), (522, 214), (462, 226), (390, 246), (310, 250), (240, 240),
                                 (240, 340, 'c'), (600, 340, 'c')]))
    pleats = []
    for i in range(6):
        o = i * 7
        pleats.append(line([(566 - i * 9, 206 + o * 0.6), (510, 224 + o * 0.9), (440, 238 + o * 0.8), (360, 252 + o * 0.5), (290, 256)]))
    pleats = inter(combine(pleats), buffer(throat, -3))
    mouth = line([(580, 181), (556, 188), (516, 200), (484, 206), (466, 200)])
    tub = combine([ellipse(x, y, 3.6) for x, y in [(560, 164), (543, 160), (526, 156), (509, 153), (492, 150),
                                                   (552, 178), (534, 182), (516, 186)]])
    eyeb = ellipse(470, 190, 6)
    pup = ellipse(471, 190, 3)
    ctr = [(452, 226), (402, 258), (332, 290), (264, 310), (208, 318)]
    flip = tube(ctr, [(0, 40), (0.25, 34), (0.7, 22), (1, 8)], 2.5)
    knobs = []
    for p in resample(spline_pts(ctr), 22)[1:-1]:
        knobs.append(Point(p[0] - 3, p[1] + 10).buffer(5.5, 16))
    set_warp(None)
    flip = from_geom(unary_union([flip.geom] + knobs).buffer(1.5).buffer(-1.5))
    return dict(id='humpback-whale', name='Humpback whale', latin='Megaptera novaeangliae', W=W, H=H, layers=[
        layer(combine([fluke, dors]), 'ink', True, 2.5),
        layer(body, 'ink', True, 2.5),
        layer(throat, 'paper'),
        layer(combine([pleats, mouth]), 'none', True, 1.8),
        layer(combine([tub, eyeb]), 'paper'),
        layer(pup, 'ink'),
        layer(body, 'none', True, 2.5),
        layer(flip, 'paper', True, 2.5),
    ])


ANIMALS = [green_sea_turtle, whale_shark, reef_manta_ray, dugong, irrawaddy_dolphin, humpback_whale]
