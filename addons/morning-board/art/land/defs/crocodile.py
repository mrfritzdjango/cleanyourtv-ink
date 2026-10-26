import math
from geom import Animal, cr, ell, circ, poly, ribbon, Spine, lerp_w, tufts


def build():
    A = Animal("saltwater-crocodile", "Saltwater crocodile", "Crocodylus porosus", 600, 400)
    sp = Spine([(20, 228), (90, 224), (150, 218), (200, 216), (280, 214), (360, 216), (420, 224),
                (480, 238), (540, 254), (592, 268)])
    Wb = [(0, 4), (0.05, 11), (0.12, 16), (0.19, 20), (0.24, 24), (0.31, 44), (0.42, 52), (0.52, 46),
          (0.59, 32), (0.75, 16), (1, 1.5)]   # belly side
    Wt = [(0, 5), (0.05, 9), (0.12, 11), (0.17, 15), (0.195, 27), (0.22, 16), (0.26, 20), (0.33, 32),
          (0.44, 38), (0.54, 30), (0.75, 18), (1, 2)]   # back side
    us = [i / 100 for i in range(101)]
    bot = [sp.pt(u, lerp_w(Wb, u)) for u in us]
    top = [sp.pt(u, -lerp_w(Wt, u)) for u in us]
    i0 = 24
    ridge = tufts(top[i0:], 14, 9, side=-1)
    pts = list(reversed(bot)) + top[1:i0] + ridge
    clean = []
    for p in pts:
        if not clean or abs(p[0] - clean[-1][0]) + abs(p[1] - clean[-1][1]) > 1:
            clean.append(p)
    body = cr(clean)

    def leg(sh, el, ft, w0, toes_dir=1):
        L = [ribbon([sh, el, ft], [(0, w0), (0.5, w0 * 0.7), (1, w0 * 0.55)], n=8)]
        for k in range(4):
            a = math.radians(-20 + k * 22)
            tip = (ft[0] - math.cos(a) * 18, ft[1] + 3 + math.sin(a) * 5)
            L.append(ribbon([ft, tip], [(0, 3.4), (1, 1)], n=3))
        return L

    far = leg((204, 244), (226, 276), (210, 302), 14) + leg((404, 248), (434, 280), (418, 306), 17)
    A.add(far, "dots", True, 2.2)
    A.add(body, "dots", True, 2.5)
    near = leg((172, 250), (198, 282), (180, 310), 16) + leg((366, 256), (402, 288), (384, 312), 21)
    A.add(near, "dots", True, 2.5)
    marks = []
    for u in [0.6, 0.67, 0.74, 0.81, 0.88, 0.95]:
        a = sp.pt(u, -lerp_w(Wt, u) * 0.92)
        b = sp.pt(u + 0.006, 0)
        c = sp.pt(u, lerp_w(Wb, u) * 0.8)
        marks.append(ribbon([a, b, c], [(0, 5), (0.5, 4.5), (1, 1)], n=5))
    for u in [0.27, 0.31, 0.35, 0.39, 0.43, 0.47, 0.51, 0.55]:
        for f in [-0.72, -0.4]:
            p = sp.pt(u + (0.02 if f == -0.4 else 0), f * lerp_w(Wt, u))
            marks.append(ell(p[0], p[1], 5, 3.4))
    marks.append(ell(24, 222, 3.4, 2.4))
    A.add(marks, "ink", False)
    teeth = []
    for k in range(10):
        x = 32 + k * 13
        teeth.append(poly([(x, 230), (x + 7, 230), (x + 3.5, 239)]))
        if k < 9:
            teeth.append(poly([(x + 6, 233), (x + 13, 233), (x + 9.5, 225)]))
    eye = ell(150, 196, 7.5, 5.5)
    A.add(teeth + [eye], "paper", True, 1.5)
    A.add(ell(150, 196, 1.8, 4.5), "ink", False)
    A.add([cr([(22, 231), (90, 231), (150, 230), (180, 222)], closed=False)], "none", True, 2)
    return A
