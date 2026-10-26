from geom import Animal, cr, ell, circ, poly, ribbon, sym, mirror_x


def build():
    A = Animal("malayan-sun-bear", "Malayan sun bear", "Helarctos malayanus", 400, 600)
    sil = sym([
        (200, 40), (230, 44), (244, 32), (262, 36), (268, 54), (272, 80), (274, 110),
        (262, 140), (254, 160), (290, 174), (326, 206), (348, 256), (354, 304), (364, 330),
        (352, 352), (322, 346), (314, 302), (292, 254), (292, 300), (302, 380), (298, 430),
        (308, 470), (302, 522), (308, 556), (292, 574, 'c'), (244, 574, 'c'), (240, 540),
        (224, 482), (200, 474),
    ], 200)
    A.add(sil, "ink", True, 2.5)
    patch = cr([(138, 184, 'c'), (146, 228), (200, 266), (254, 228), (262, 184, 'c'),
                (242, 188, 'c'), (230, 216), (200, 234), (170, 216), (158, 188, 'c')])
    muzzle = sym([(200, 96), (222, 100), (238, 116), (236, 138), (220, 152), (200, 155)], 200)
    A.add([patch, muzzle], "paper", False)
    A.add([patch, muzzle], "dots", True, 2)
    A.add(sym([(200, 103), (213, 105), (216, 114), (207, 121), (200, 123)], 200), "ink", False)
    A.add(cr([(200, 122), (200, 134), (190, 142), (182, 140)], closed=False) and
          [cr([(200, 122), (200, 134)], closed=False),
           cr([(182, 138), (191, 142), (200, 134), (209, 142), (218, 138)], closed=False)],
          "none", True, 2)
    eyes = [circ(174, 88, 5.5), circ(226, 88, 5.5)]
    ears = [cr([(246, 40), (258, 40), (262, 52), (254, 56)]), cr([(154, 40), (142, 40), (138, 52), (146, 56)])]
    # paper contour lines: arms and legs on the black body
    lines = [
        ribbon([(292, 176), (300, 206), (296, 244)], [(0, 0), (0.5, 1.6), (1, 0)], n=6),
        ribbon([(270, 410), (262, 450), (266, 500)], [(0, 0), (0.5, 1.6), (1, 0)], n=6),
    ]
    lines += [mirror_x(l, 200) for l in lines]
    A.add(eyes + ears + lines, "paper", False)
    A.add([circ(174, 88, 3), circ(226, 88, 3)], "ink", False)
    claws = []
    for i, bx in enumerate([328, 337, 346, 355]):
        c = ribbon([(bx, 344), (bx + 1, 360), (bx - 5, 376)], [(0, 3.4), (1, 0.3)], n=6)
        claws += [c, mirror_x(c, 200)]
    for bx in [256, 270, 284, 298]:
        c = ribbon([(bx, 570), (bx - 1, 580), (bx - 5, 588)], [(0, 3), (1, 0.3)], n=5)
        claws += [c, mirror_x(c, 200)]
    A.add(claws, "paper", True, 1.6)
    return A
