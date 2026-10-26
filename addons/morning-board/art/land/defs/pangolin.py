from geom import Animal, cr, ell, circ, poly, ribbon, Spine, lerp_w, tufts


def build():
    A = Animal("sunda-pangolin", "Sunda pangolin", "Manis javanica", 600, 360)
    sp = Spine([(26, 296), (66, 284), (104, 262), (150, 222), (214, 176), (290, 154), (366, 164),
                (424, 196), (470, 240), (514, 284), (560, 316)])
    W = [(0, 3), (0.05, 13), (0.1, 20), (0.15, 30), (0.3, 66), (0.47, 70), (0.62, 52), (0.8, 30), (1, 9)]
    w = lambda u: lerp_w(W, u)
    us = [i / 60 for i in range(61)]
    top = [sp.pt(u, -w(u)) for u in us]
    bot = [sp.pt(u, w(u)) for u in us]
    i0 = 9   # start of scaly edge (neck)
    edge = top[:i0] + tufts(top[i0:], 13, 7, side=-1)[0:]
    tailb = bot[40:]
    body_pts = edge + [sp.pt(1.0, 0)] + list(reversed(tufts(tailb, 13, 6, side=1))) + list(reversed(bot[:40]))
    clean = []
    for p in body_pts:
        if not clean or abs(p[0] - clean[-1][0]) + abs(p[1] - clean[-1][1]) > 1:
            clean.append(p)
    body = cr(clean)
    legs_far = [cr([(196, 232), (214, 244), (212, 292), (220, 318), (196, 320), (188, 296)]),
                cr([(380, 218), (410, 226), (412, 290), (420, 316), (394, 318), (388, 290)])]
    A.add(legs_far, "dots", True, 2.5)
    A.add(body, "dots", True, 2.5)
    scales = []
    rows = [-0.8, -0.36, 0.08, 0.5]
    for j, f in enumerate(rows):
        u = 0.14 + (0.025 if j % 2 else 0)
        while u < 0.985:
            ww = w(u)
            if ww < 9:
                break
            s = max(ww * 0.62, 9)
            du = s / sp.len
            h = 0.23
            if f > 0.4 and (u < 0.2 or (0.25 < u < 0.6)):
                u += du
                continue
            pts = [sp.pt(u - du * 0.25, (f - h) * ww), sp.pt(u + du * 0.3, (f - h * 0.75) * ww),
                   sp.pt(u + du * 0.5, f * ww), sp.pt(u + du * 0.3, (f + h * 0.75) * ww),
                   sp.pt(u - du * 0.25, (f + h) * ww)]
            scales.append(ribbon(pts, [(0, 0.4), (0.5, max(2.4, s * 0.12)), (1, 0.4)], n=8))
            u += du
    A.add(scales, "ink", False)
    legs = [cr([(150, 246), (178, 252), (176, 296), (184, 318), (150, 322), (142, 300)]),
            cr([(330, 216), (376, 222), (378, 286), (388, 318), (350, 320), (344, 286)])]
    A.add(legs, "dots", True, 2.5)
    claws = []
    for (x, y) in [(150, 322), (160, 323), (170, 322), (350, 320), (362, 321), (374, 320),
                   (196, 320), (206, 320), (394, 318), (406, 318)]:
        claws.append(ribbon([(x, y - 3), (x - 6, y + 4), (x - 12, y + 2)], [(0, 2.6), (1, 0.3)], n=5))
    A.add(claws, "ink", False)
    A.add(circ(62, 270, 3.2), "ink", False)
    A.add([cr([(26, 296), (40, 297), (52, 294)], closed=False)], "none", True, 1.6)
    return A
