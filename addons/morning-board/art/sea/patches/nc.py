def lionfish():
    W, H = 600, 450
    body = smooth([(482, 232), (474, 206), (454, 186), (414, 172), (354, 167), (294, 174), (244, 188), (204, 206),
                   (180, 216, 'c'), (180, 240, 'c'), (208, 250), (254, 264), (314, 276), (374, 280), (424, 272),
                   (460, 258), (478, 246)])

    def top_y(x):
        g = body.geom.intersection(SLine([(x, 0), (x, 450)]))
        return g.bounds[1]
    spines, bands, roots = [], [], []
    ns = 13
    for i in range(ns):
        t = i / (ns - 1)
        x = 432 - t * 172
        y = top_y(x) + 6
        ang = math.radians(-100 - t * 42)
        L = 168 - t * 80
        tip = (x + L * math.cos(ang), y + L * math.sin(ang))
        mid = (x + 0.5 * L * math.cos(ang) + 5, y + 0.5 * L * math.sin(ang))
        c = [(x, y), mid, tip]
        roots.append((x, y, ang, L))
        spines.append(tube(c, [(0, 9), (1, 3)]))
        pts = centerline_pts(c, 1.0)
        n = len(pts)
        for k in range(int(n * 0.28), n - 4, 22):
            bands.append(tube([pts[k], pts[min(n - 1, k + 11)]], [(0, 12), (1, 12)]))
    spines = combine(spines)
    bands = inter(combine(bands), buffer(spines, -1.2))
    mp = [(446, 192)]
    for i, r in enumerate(roots):
        mp.append((r[0] + 0.4 * r[3] * math.cos(r[2]), r[1] + 0.4 * r[3] * math.sin(r[2]), 'c'))
        if i < ns - 1:
            r2 = roots[i + 1]
            a = (r[2] + r2[2]) / 2
            l = 0.2 * (r[3] + r2[3]) / 2
            mp.append(((r[0] + r2[0]) / 2 + l * math.cos(a), (r[1] + r2[1]) / 2 + l * math.sin(a)))
    mp += [(250, 204), (330, 200), (420, 196)]
    memb = smooth(mp)
    soft = smooth([(262, 190), (244, 154), (214, 136), (186, 142), (172, 172), (182, 214), (236, 206)])
    tail = smooth([(188, 212), (152, 182), (114, 168), (86, 178), (72, 206), (70, 228), (74, 252), (88, 278),
                   (116, 288), (152, 274), (188, 246)])
    anal = smooth([(304, 272), (294, 310), (266, 334), (236, 330), (222, 300), (230, 262)])
    clear = combine([soft, tail, anal])
    tspots = keep_inside([ellipse(x + (7 if (y // 14) % 2 else 0), y, 3.2) for x in range(70, 300, 14) for y in range(130, 345, 14)],
                         diff(buffer(clear, -3), body))
    root = (404, 252)
    fan_pts = [root]
    rays = []
    a0, a1 = math.radians(78), math.radians(172)
    nr = 13
    for i in range(nr):
        a = a0 + (a1 - a0) * i / (nr - 1)
        R = 182 - 36 * abs(i - 5) / 7
        rays.append(line([polar(root, 26, a), polar(root, R * 0.7, a + 0.015), polar(root, R, a + 0.04)]))
        fan_pts.append(polar(root, R * 0.74, a, ))
        if i < nr - 1:
            fan_pts.append(polar(root, R * 0.62, a + (a1 - a0) / (nr - 1) / 2))
    pect = from_geom(poly(fan_pts).geom.buffer(3).buffer(-3))
    pb = []
    for r0 in (54, 88, 120):
        arc = [polar(root, r0, a0 - 0.1 + (a1 - a0 + 0.2) * k / 30) for k in range(31)]
        pb.append(tube(arc, [(0, 9), (1, 9)]))
    pbands = inter(combine(pb), buffer(pect, -3))
    pelv = smooth([(432, 272), (418, 318), (402, 360), (388, 392, 'c'), (390, 352), (394, 310), (408, 272)])
    st = []
    for k in range(12):
        x = 196 + k * 21
        st.append(tube([(x + 16, 158), (x + 4, 220), (x - 6, 292)], [(0, 7), (1, 7)]))
    for a in (1.0, 1.6, 2.3):
        st.append(tube([polar((438, 208), 16, a), polar((438, 208), 62, a)], [(0, 6), (1, 5)]))
    stripes = inter(combine(st), diff(body, ellipse(438, 208, 15)))
    ed = ellipse(438, 208, 12)
    pupil = ellipse(439, 208, 7)
    tent = smooth([(432, 196), (420, 170), (410, 150, 'c'), (426, 166), (442, 194)])
    return dict(id='lionfish', name='Lionfish', latin='Pterois volitans', W=W, H=H, layers=[
        layer(clear, 'paper', True, 2),
        layer(tspots, 'ink'),
        layer(spines, 'paper', True, 1.5),
        layer(bands, 'ink'),
        layer(combine([union(body, memb), tent]), 'dots', True, 2.5),
        layer(stripes, 'ink'),
        layer(combine([pect, pelv]), 'dots', True, 2),
        layer(combine([pbands, ed]), 'paper'),
        layer(combine(rays + [ed]), 'none', True, 1.6),
        layer(pupil, 'ink'),
    ])


def bumphead_parrotfish():
    W, H = 600, 400
    body = smooth([(546, 242), (540, 224), (550, 208), (568, 188), (574, 160), (568, 128), (550, 102), (522, 84),
                   (486, 74), (440, 72), (390, 78), (330, 90), (250, 110), (180, 136), (136, 160), (116, 170, 'c'),
                   (116, 228, 'c'), (140, 240), (200, 272), (280, 300), (370, 312), (440, 302), (494, 284), (528, 266)])
    tail = smooth([(126, 170), (88, 140), (54, 114), (40, 108, 'c'), (48, 158), (50, 200), (48, 242), (40, 292, 'c'),
                   (54, 288), (88, 262), (126, 228)])
    dors = smooth([(460, 84), (446, 58), (390, 56), (330, 68), (252, 88), (186, 116), (150, 142), (176, 154), (300, 114), (420, 94)])
    anal = smooth([(330, 300), (306, 334), (250, 328), (208, 296), (260, 286)])
    pelv = smooth([(424, 300), (414, 334), (396, 352, 'c'), (390, 322), (394, 300)])
    fins = combine([tail, dors, anal, pelv])
    finl = []
    for x in range(180, 450, 22):
        finl.append(line([(x, 140), (x + 10, 40)]))
    for x in range(56, 120, 12):
        finl.append(line([(x + 70, 200), (x - 10, 200 + (x - 88) * 2.6)]))
    finl = inter(combine(finl), buffer(diff(fins, body), -3))
    pect = smooth([(444, 232), (412, 218), (372, 222), (350, 240), (380, 254), (424, 250)])
    scales = []
    for row in range(9):
        y = 112 + row * 22
        off = 11 if row % 2 else 0
        for x in range(150 + off, 470, 22):
            b0, b1 = math.radians(115), math.radians(245)
            scales.append(line([polar((x, y), 12, b0 + (b1 - b0) * k / 6) for k in range(7)]))
    scales = inter(combine(scales), diff(buffer(body, -5), poly([(462, 0), (600, 0), (600, 400), (462, 400)])))
    beak = combine([smooth([(552, 210), (532, 208), (516, 220), (532, 232), (548, 232)]),
                    smooth([(548, 236), (530, 236), (516, 246), (530, 258), (544, 254)])])
    eyeo, eyeg = eye(506, 150, 7)
    oper = line([(474, 118), (456, 170), (460, 230), (478, 262)])
    hump = combine([line([(548, 108), (562, 140), (562, 176), (548, 200)])])
    return dict(id='bumphead-parrotfish', name='Bumphead parrotfish', latin='Bolbometopon muricatum', W=W, H=H, layers=[
        layer(fins, 'dots', True, 2.5),
        layer(finl, 'none', True, 1.5),
        layer(body, 'dots', True, 2.5),
        layer(scales, 'none', True, 1.6),
        layer(pect, 'dots', True, 2),
        layer(beak, 'paper', True, 2),
        layer(eyeo, 'ink'),
        layer(eyeg, 'paper'),
        layer(combine([oper, hump]), 'none', True, 2),
    ])
