import math
from geom import Animal, cr, ell, circ, poly, ribbon, sym, mirror_x


def build():
    A = Animal("rajah-brookes-birdwing", "Rajah Brooke's birdwing", "Trogonoptera brookiana", 600, 400)
    fore = cr([(306, 160), (380, 118), (470, 90), (560, 70), (592, 66, 'c'), (582, 98), (556, 144),
               (520, 192), (500, 212, 'c'), (420, 206), (350, 200), (310, 196)])
    hind = cr([(308, 196), (380, 204), (452, 214), (488, 232), (480, 276), (446, 316), (396, 340),
               (352, 336), (322, 300), (306, 250)])
    wings = [fore, hind, mirror_x(fore, 300), mirror_x(hind, 300)]
    A.add(wings[1::2] + wings[0::2], "ink", True, 2.5)
    teeth = []
    # tooth-shaped green marks along the forewing, base on the trailing side, tip toward the leading edge
    lead = lambda x: 160 - 0.329 * (x - 306)
    trail = lambda x: 196 + 0.084 * (x - 310)
    for k in range(7):
        bx = 342 + k * 26
        by = trail(bx) - 9
        depth = by - lead(bx + 8)
        tx, ty = bx + 7, by - depth * 0.62
        wb = 12.5 - k * 0.5
        teeth.append(cr([(bx - wb, by, 'c'), (tx, ty, 'c'), (bx + wb, by - 1, 'c')]))
    band = cr([(318, 214), (370, 212), (420, 220), (448, 236), (432, 258), (382, 264), (338, 260), (320, 240)])
    spots = [ell(452, 300, 7, 5, -40), ell(418, 322, 7, 5, -20), ell(380, 330, 6, 4.5, 0)]
    green = teeth + [band]
    green += [mirror_x(m, 300) for m in green]
    spots += [mirror_x(m, 300) for m in spots]
    A.add(green + spots, "paper", False)
    A.add(green, "dots", False)
    veins = []
    for (a, b) in [((316, 190), (500, 208)), ((320, 178), (560, 120)), ((316, 168), (580, 82))]:
        veins.append(cr([a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 4), b], closed=False))
    veins += [mirror_x(v, 300) for v in veins]
    body = sym([(300, 150), (310, 158), (312, 186), (310, 230), (306, 290), (300, 310)], 300)
    A.add(body, "ink", True, 2)
    head = [circ(300, 146, 10), sym([(300, 160), (312, 164), (314, 178), (300, 182)], 300)]
    A.add(head, "dots", True, 2)
    ant = [cr([(296, 138), (284, 100), (268, 64)], closed=False),
           cr([(304, 138), (316, 100), (332, 64)], closed=False)]
    A.add(ant, "none", True, 2)
    A.add([circ(268, 64, 4), circ(332, 64, 4)], "ink", False)
    return A
