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
