import math
import random
from geom import Animal, cr, ell, circ, poly, ribbon, sym, mirror_x


def blob(R, cx, cy, r, k=6):
    pts = []
    for i in range(k):
        a = 2 * math.pi * i / k + R.uniform(-0.3, 0.3)
        rr = r * (1 + R.uniform(-0.35, 0.35))
        pts.append((cx + math.cos(a) * rr * 1.3, cy + math.sin(a) * rr))
    return cr(pts)


def build():
    A = Animal("sunda-colugo", "Sunda colugo", "Galeopterus variegatus", 600, 400)
    mem = sym([(300, 108), (350, 112), (430, 120), (500, 132), (552, 146, 'c'), (560, 200), (552, 252),
               (530, 304, 'c'), (462, 318), (390, 334), (326, 360), (300, 380)], 300)
    A.add(mem, "dots", False)
    R = random.Random(4)
    inks, papers = [], []
    for i in range(140):
        x = R.uniform(40, 560)
        y = R.uniform(110, 375)
        if abs(x - 300) < 48 and 104 < y < 326:
            continue
        r = R.uniform(3.5, 8)
        (inks if R.random() < 0.5 else papers).append(blob(R, x, y, r))
    A.add(papers, "paper", False)
    A.add(inks, "ink", False)
    A.mask(mem)
    A.add(mem, "none", True, 2.5)
    body = [cr([(300, 104), (330, 116), (344, 170), (340, 250), (324, 306), (300, 322), (276, 306),
                (260, 250), (256, 170), (270, 116)])]
    limbs = [cr([(332, 136), (440, 136), (550, 148)], closed=False),
             cr([(336, 268), (420, 286), (528, 302)], closed=False),
             cr([(310, 318), (304, 350), (300, 378)], closed=False)]
    limbs += [mirror_x(l, 300) for l in limbs[:2]]
    A.add(body + limbs, "none", True, 1.8)
    claws = []
    for (x, y, dx, dy) in [(552, 146, 10, -4), (530, 304, 10, 6)]:
        for k in range(3):
            c = ribbon([(x, y), (x + dx, y + dy + (k - 1) * 6), (x + dx * 1.2, y + dy * 1.6 + (k - 1) * 8)],
                       [(0, 2.4), (1, 0.4)], n=4)
            claws += [c, mirror_x(c, 300)]
    A.add(claws, "ink", False)
    head = sym([(300, 42), (312, 44), (320, 34, 'c'), (328, 50), (338, 72), (334, 98), (320, 118),
                (300, 126)], 300)
    A.add(head, "dots", True, 2.5)
    A.add([ell(322, 74, 8, 10, 15), ell(278, 74, 8, 10, -15),
           cr([(294, 46), (306, 46), (304, 54), (296, 54)])], "ink", False)
    A.add([circ(323, 70, 2.4), circ(279, 70, 2.4)], "paper", False)
    return A
