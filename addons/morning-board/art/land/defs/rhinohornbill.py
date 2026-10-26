import math
from geom import Animal, cr, ell, circ, poly, ribbon


def band(p0, p1, t0, t1, hw):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = -uy, ux
    a = (p0[0] + dx * t0, p0[1] + dy * t0)
    b = (p0[0] + dx * t1, p0[1] + dy * t1)
    return poly([(a[0] + nx * hw, a[1] + ny * hw), (b[0] + nx * hw, b[1] + ny * hw),
                 (b[0] - nx * hw, b[1] - ny * hw), (a[0] - nx * hw, a[1] - ny * hw)])


def build():
    A = Animal("rhinoceros-hornbill", "Rhinoceros hornbill", "Buceros rhinoceros", 600, 400)
    sil = cr([
        (196, 104), (224, 94), (252, 106), (266, 138), (300, 160), (360, 190), (410, 222),
        (462, 256), (520, 298), (560, 330), (570, 352), (552, 366), (502, 342), (452, 318),
        (408, 302), (360, 292), (318, 270), (282, 240), (252, 202), (232, 172), (206, 160),
    ])
    A.add(sil, "ink", False)
    axis = ((420, 264), (566, 350))
    whites = [
        cr([(300, 268), (330, 252), (380, 262), (420, 284), (430, 320), (380, 330), (320, 300)]),
        band(axis[0], axis[1], 0.12, 0.42, 40),
        band(axis[0], axis[1], 0.72, 1.3, 40),
    ]
    feathers = [ribbon([(290 + k * 18, 176 + k * 4), (336 + k * 20, 206 + k * 6), (380 + k * 18, 238 + k * 5)],
                       [(0, 0), (0.5, 1.7), (1, 0)], n=6) for k in range(4)]
    A.add(whites + feathers, "paper", False)
    A.add(sil, "none", True, 2.5)
    branch = ribbon([(120, 318), (360, 306), (594, 296)], [(0, 10), (1, 8)], n=8)
    A.add(branch, "dots", True, 2.5)
    feet = [cr([(334, 284), (352, 288), (350, 306), (330, 306)]),
            ribbon([(326, 302), (318, 310), (322, 322)], [(0, 4), (1, 2)], n=4),
            ribbon([(340, 302), (336, 314), (340, 324)], [(0, 4), (1, 2)], n=4),
            ribbon([(352, 300), (352, 312), (358, 322)], [(0, 4), (1, 2)], n=4)]
    A.add(feet, "ink", False)
    bill = cr([(204, 118, 'c'), (150, 124), (100, 140), (60, 164), (28, 198, 'c'), (64, 184),
               (110, 172), (160, 164), (210, 160, 'c')])
    A.add(bill, "paper", True, 2.5)
    casque = cr([(210, 104, 'c'), (172, 98), (134, 96), (112, 90), (100, 76), (100, 56), (110, 34, 'c'),
                 (88, 44), (76, 66), (72, 96), (76, 124), (86, 146, 'c'), (130, 132), (170, 122),
                 (206, 118, 'c')])
    A.add(casque, "dots", True, 2.5)
    det = [cr([(206, 140), (150, 148), (100, 160), (54, 186)], closed=False),
           cr([(90, 132), (112, 116), (150, 108)], closed=False)]
    A.add(det, "none", True, 1.6)
    A.add(circ(228, 128, 9), "paper", False)
    A.add(circ(227, 128, 4.5), "ink", False)
    return A
