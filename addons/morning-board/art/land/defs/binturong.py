import random
from geom import Animal, cr, ell, circ, poly, ribbon, tufts


def build():
    A = Animal("binturong", "Binturong", "Arctictis binturong", 600, 400)
    branch = ribbon([(8, 304), (300, 298), (592, 288)], [(0, 11), (1, 10)], n=8)
    A.add(branch, "paper", True, 2.5)
    tail_c = [(410, 196), (470, 214), (520, 260), (534, 320), (514, 366), (474, 376), (448, 352), (456, 326)]
    tail = ribbon(tail_c, [(0, 30), (0.5, 24), (0.85, 15), (1, 8)], n=16)
    A.add(tail, "ink", True, 2.5)
    top = [(130, 172), (180, 164), (226, 162), (260, 156), (300, 158), (340, 160), (380, 164),
           (408, 174), (430, 192)]
    bel = tufts([(396, 242), (340, 250), (260, 250), (204, 244)], 22, 1, (4, 10), 0.4, 4, side=-1)
    sil = cr([(38, 214), (50, 198), (78, 180), (90, 170), (94, 148), (104, 136, 'c'), (114, 150),
              (120, 170)] + top[:] + [(436, 230), (438, 268), (444, 288), (446, 300, 'c'), (402, 300, 'c'),
              (410, 282), (406, 252)] + bel + [(192, 252), (188, 282), (196, 298), (196, 302, 'c'),
              (150, 302, 'c'), (158, 284), (160, 252), (150, 238), (122, 236), (82, 232), (56, 228),
              (42, 222)])
    A.add(sil, "ink", True, 2.5)
    R = random.Random(9)
    flecks = []
    for i in range(60):
        x = R.uniform(150, 420)
        y = R.uniform(176, 238)
        if (x - 290) ** 2 / 140 ** 2 + (y - 206) ** 2 / 32 ** 2 > 1:
            continue
        L = R.uniform(10, 16)
        flecks.append(ribbon([(x, y), (x + L * 0.5, y + L * 0.3), (x + L * 0.9, y + L * 0.7)],
                             [(0, 0.3), (0.4, 1.2), (1, 0.2)], n=4))
    for i in range(16):
        t = R.uniform(0.05, 0.8)
        import math
        from geom import Spine
        sp = Spine(tail_c)
        p = sp.pt(t, R.uniform(-14, 14))
        flecks.append(ribbon([p, (p[0] + 4, p[1] + 5), (p[0] + 5, p[1] + 11)], [(0, 0.3), (0.4, 1.3), (1, 0.2)], n=4))
    flecks.append(ribbon([(94, 150), (104, 138), (112, 152)], [(0, 0.5), (0.5, 2.2), (1, 0.5)], n=5))
    flecks.append(ell(72, 196, 6.5, 5.5))
    A.add(flecks, "paper", False)
    A.add([circ(71, 196, 3.4), cr([(36, 210), (46, 206), (48, 216), (40, 222)])], "ink", False)
    A.add([cr([(36, 218), (40, 216)], closed=False)], "none", True, 1.5)
    wh = [cr([(52, 214), (26, 206), (6, 206)], closed=False),
          cr([(52, 218), (28, 220), (8, 228)], closed=False),
          cr([(54, 222), (34, 234), (18, 248)], closed=False),
          cr([(56, 210), (36, 196), (20, 188)], closed=False)]
    A.add(wh, "none", True, 1.5)
    return A
