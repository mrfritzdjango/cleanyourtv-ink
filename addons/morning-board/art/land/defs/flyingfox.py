from geom import Animal, cr, ell, circ, poly, ribbon, sym, mirror_x


def build():
    A = Animal("large-flying-fox", "Large flying fox", "Pteropus vampyrus", 600, 400)
    wing = cr([(316, 150), (380, 128), (470, 98), (482, 96, 'c'), (582, 128, 'c'), (544, 176),
               (566, 236, 'c'), (506, 246), (488, 304, 'c'), (428, 284), (386, 326, 'c'),
               (348, 300), (330, 290, 'c'), (322, 240)])
    A.add([wing, mirror_x(wing, 300)], "ink", True, 2.5)
    bones = []
    for tip in [(582, 128), (566, 236), (488, 304)]:
        bones.append(ribbon([(482, 100), ((482 + tip[0]) / 2, (100 + tip[1]) / 2 + 4), tip],
                            [(0, 2.2), (1, 0.4)], n=6))
    bones.append(ribbon([(330, 148), (390, 132), (476, 102)], [(0, 2.6), (1, 1.6)], n=6))
    bones.append(ribbon([(380, 136), (384, 220), (386, 320)], [(0, 1.8), (1, 0.4)], n=6))
    bones += [mirror_x(b, 300) for b in bones]
    A.add(bones, "paper", False)
    claws = [ribbon([(484, 98), (486, 86), (478, 80)], [(0, 3), (1, 0.5)], n=4)]
    claws += [mirror_x(c, 300) for c in claws]
    A.add(claws, "ink", False)
    legs = [ribbon([(312, 266), (324, 284), (332, 296)], [(0, 6), (1, 4)], n=4),
            ribbon([(288, 266), (276, 284), (268, 296)], [(0, 6), (1, 4)], n=4)]
    A.add(legs, "dots", True, 2)
    body = sym([(300, 118), (328, 132), (340, 172), (336, 230), (322, 276), (300, 292)], 300)
    A.add(body, "dots", True, 2.5)
    head = sym([(300, 54), (310, 64), (316, 82), (322, 76), (334, 52), (340, 84), (334, 112),
                (318, 128), (300, 132)], 300)
    A.add(head, "dots", True, 2.5)
    A.add([ell(312, 92, 5, 6, 20), ell(288, 92, 5, 6, -20),
           cr([(295, 58), (305, 58), (303, 66), (297, 66)])], "ink", False)
    A.add([circ(313, 90, 1.6), circ(289, 90, 1.6)], "paper", False)
    A.add([cr([(296, 70), (300, 76), (304, 70)], closed=False),
           cr([(312, 150), (300, 158), (288, 150)], closed=False)], "none", True, 1.6)
    return A
