import math
from geom import Animal, cr, ell, circ, poly, ribbon, Spine, lerp_w


def build():
    A = Animal("asian-water-monitor", "Asian water monitor", "Varanus salvator", 600, 400)
    sp = Spine([(26, 170), (60, 176), (100, 188), (150, 206), (210, 214), (270, 204), (330, 190),
                (390, 206), (440, 246), (490, 290), (540, 316), (588, 304)])
    W = [(0, 2), (0.025, 13), (0.065, 22), (0.1, 16), (0.14, 20), (0.2, 37), (0.31, 47), (0.4, 35),
         (0.48, 25), (0.7, 15), (0.9, 7), (1, 1.5)]
    w = lambda u: lerp_w(W, u)
    body = sp.outline(W, n=80)

    def leg(u, side, fwd):
        (x, y), (nx, ny) = sp.at(u)
        tx, ty = -ny, nx
        s = side
        sh = sp.pt(u, s * w(u) * 0.88)
        el = (sh[0] + nx * s * 56 + tx * fwd * 6, sh[1] + ny * s * 56 + ty * fwd * 6)
        wr = (el[0] + tx * fwd * 40 + nx * s * 8, el[1] + ty * fwd * 40 + ny * s * 8)
        limb = ribbon([sh, el, wr], [(0, 13), (0.5, 9), (1, 6)], n=8)
        toes = []
        base = math.atan2(ty * fwd, tx * fwd)
        for k in range(5):
            a = base + (k - 2) * 0.42
            tip = (wr[0] + math.cos(a) * 19, wr[1] + math.sin(a) * 19)
            toes.append(ribbon([wr, tip], [(0, 2.6), (1, 0.6)], n=3))
        return [limb] + toes

    legs = leg(0.19, -1, 1) + leg(0.19, 1, 1) + leg(0.41, -1, -1) + leg(0.41, 1, -1)
    A.add(body, "dots", False)
    grid = []
    for u in [0.17, 0.21, 0.25, 0.29, 0.33, 0.37, 0.41]:
        for f in [-0.62, -0.2, 0.2, 0.62]:
            grid.append(sp.pt(u + (0.01 if f in (-0.2, 0.62) else 0), f * w(u)))
    bands = []
    for u in [0.5, 0.57, 0.64, 0.71, 0.78, 0.85, 0.92]:
        ww = w(u) + 8
        bands.append(ribbon([sp.pt(u, -ww), sp.pt(u + 0.006, 0), sp.pt(u, ww)], [(0, 5), (0.5, 6), (1, 5)], n=5))
    A.add([circ(x, y, 6.4) for x, y in grid] + bands, "ink", False)
    A.add([circ(x, y, 3.2) for x, y in grid], "paper", False)
    A.mask(body)
    A.add(legs, "dots", True, 2)
    A.add(body, "none", True, 2.5)
    eyes = [circ(*sp.pt(0.06, -15), 3.6), circ(*sp.pt(0.06, 15), 3.6)]
    A.add(eyes, "ink", False)
    A.add([cr([(26, 170), (14, 170), (6, 164)], closed=False),
           cr([(14, 170), (6, 176)], closed=False)], "none", True, 1.6)
    return A
