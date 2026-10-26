from geom import Animal, cr, ell, circ, poly, ribbon


def build():
    A = Animal("sunda-slow-loris", "Sunda slow loris", "Nycticebus coucang", 600, 400)
    branch = ribbon([(16, 340), (300, 268), (590, 196)], [(0, 13), (1, 11)], n=8)
    A.add(branch, "paper", True, 2.5)
    leg = cr([(430, 168), (474, 176), (488, 206), (480, 226), (466, 232), (440, 236), (424, 222),
              (434, 204)])
    foot = cr([(440, 222), (470, 214), (490, 220), (488, 236), (470, 242), (446, 244)])
    A.add([leg, foot], "dots", True, 2.5)
    body = ell(352, 176, 120, 68, -12)
    ears = [ell(150, 140, 12, 11, -20), ell(244, 132, 12, 11, 20)]
    A.add([body] + ears, "dots", True, 2.5)
    arm = cr([(222, 214), (252, 222), (260, 252), (252, 274), (234, 280), (214, 280), (210, 254)])
    hand = cr([(204, 268), (232, 264), (254, 270), (254, 290), (232, 296), (208, 292)])
    A.add([arm, hand], "dots", True, 2.5)
    head = ell(198, 186, 64, 58)
    A.add(head, "dots", True, 2.5)
    darks = [
        ell(170, 178, 24, 30, 18), ell(226, 178, 24, 30, -18),
        ribbon([(206, 136), (262, 132), (330, 124), (408, 126), (452, 142)], [(0, 2), (0.4, 6), (1, 1.5)], n=8),
        cr([(190, 222), (206, 222), (202, 230), (194, 230)]),
    ]
    A.add(darks, "ink", False)
    whites = [ribbon([(198, 132), (198, 170), (198, 218)], [(0, 2), (0.6, 5), (1, 3)], n=6),
              circ(172, 182, 15), circ(224, 182, 15)]
    A.add(whites, "paper", False)
    A.add([circ(173, 183, 11), circ(223, 183, 11)], "ink", False)
    A.add([circ(169, 178, 3.4), circ(219, 178, 3.4)], "paper", False)
    A.add([cr([(186, 238), (198, 242), (210, 238)], closed=False),
           cr([(220, 276), (222, 292)], closed=False), cr([(236, 274), (238, 292)], closed=False),
           cr([(456, 220), (458, 240)], closed=False), cr([(472, 218), (474, 238)], closed=False)],
          "none", True, 1.6)
    return A
