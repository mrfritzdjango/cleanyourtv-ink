from geom import Animal, cr, ell, circ, poly, ribbon, sym, mirror_x


def build():
    A = Animal("buffy-fish-owl", "Buffy fish owl", "Ketupa ketupu", 400, 520)
    branch = ribbon([(8, 452), (200, 446), (392, 440)], [(0, 13), (1, 12)], n=8)
    A.add(branch, "dots", True, 2.5)
    body = sym([(200, 78), (236, 72), (270, 58), (308, 48, 'c'), (292, 70), (266, 96), (268, 124),
                (284, 164), (298, 230), (298, 310), (286, 372), (262, 420), (230, 450), (212, 460),
                (200, 462)], 200)
    A.add(body, "dots", False)
    disc = sym([(200, 96), (232, 96), (258, 116), (264, 150), (250, 184), (224, 200), (200, 204)], 200)
    A.add(disc, "paper", False)
    A.add(disc, "dots", False)
    streaks = []
    for (x, y, L) in [(170, 236, 34), (200, 230, 30), (230, 236, 34), (156, 280, 36), (186, 276, 34),
                      (214, 276, 34), (244, 280, 36), (166, 326, 34), (200, 320, 34), (234, 326, 34),
                      (182, 368, 30), (218, 368, 30)]:
        streaks.append(ribbon([(x, y), (x + 1, y + L * 0.5), (x - 1, y + L)], [(0, 0.5), (0.4, 3.6), (1, 0.4)], n=5))
    for k in range(5):
        w = ribbon([(268, 190 + k * 42), (284, 196 + k * 42), (296, 204 + k * 42)], [(0, 1), (0.5, 4.5), (1, 1)], n=4)
        streaks += [w, mirror_x(w, 200)]
    tuft = ribbon([(246, 76), (272, 66), (298, 56)], [(0, 1), (0.5, 4), (1, 0.5)], n=5)
    streaks += [tuft, mirror_x(tuft, 200)]
    A.add(streaks, "ink", False)
    A.add(body, "none", True, 2.6)
    wing = cr([(266, 150), (290, 196), (300, 270), (294, 340), (276, 396), (258, 420), (250, 360),
               (248, 270), (252, 196)])
    A.add([wing, mirror_x(wing, 200)], "none", True, 2)
    brows = ribbon([(160, 112), (182, 104), (198, 124)], [(0, 1), (0.5, 5), (1, 1)], n=6)
    eyes = [circ(170, 146, 25), circ(230, 146, 25)]
    feet = []
    for x0 in (176, 224):
        for dx in (-14, -4, 6, 16):
            feet.append(ribbon([(x0 + dx * 0.4, 426), (x0 + dx, 440), (x0 + dx * 1.1, 448)], [(0, 6), (1, 4)], n=4))
    A.add([brows, mirror_x(brows, 200)] + eyes + feet, "paper", True, 2.2)
    pupils = [circ(170, 147, 14), circ(230, 147, 14),
              cr([(192, 156), (208, 156), (204, 176), (200, 184), (196, 176)])]
    talons = []
    for x0 in (176, 224):
        for dx in (-14, -4, 6, 16):
            x = x0 + dx * 1.1
            talons.append(ribbon([(x, 446), (x + 1, 452), (x - 3, 458)], [(0, 2.6), (1, 0.4)], n=4))
    A.add(pupils + talons, "ink", False)
    A.add([circ(165, 141, 4), circ(225, 141, 4)], "paper", False)
    return A
