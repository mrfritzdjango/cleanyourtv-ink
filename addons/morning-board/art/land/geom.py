"""Geometry helpers that build the restricted path syntax (M L C Q Z, absolute, 1 decimal).

A subpath is a dict: {"start": (x, y), "segs": [(c1, c2, p) | (p,)], "closed": bool}
"""
import math

K = 0.5523


def _pt(p):
    return (float(p[0]), float(p[1]))


def cr(pts, closed=True, t=1.0):
    """Catmull-Rom spline through points -> cubic Bezier subpath.
    A point given as (x, y, 'c') is a sharp corner. t scales tangent length."""
    P = [_pt(p) for p in pts]
    corner = [len(p) > 2 and p[2] == 'c' for p in pts]
    n = len(P)
    segs = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        i0 = (i - 1) % n if closed else max(i - 1, 0)
        i1 = i
        i2 = (i + 1) % n
        i3 = (i + 2) % n if closed else min(i + 2, n - 1)
        p0, p1, p2, p3 = P[i0], P[i1], P[i2], P[i3]
        if corner[i1]:
            c1 = p1
        else:
            c1 = (p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t)
        if corner[i2]:
            c2 = p2
        else:
            c2 = (p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t)
        segs.append((c1, c2, p2))
    return {"start": P[0], "segs": segs, "closed": closed}


def poly(pts, closed=True):
    P = [_pt(p) for p in pts]
    return {"start": P[0], "segs": [(p,) for p in P[1:]], "closed": closed}


def ell(cx, cy, rx, ry, rot=0.0):
    """Ellipse as four cubic Beziers, optional rotation in degrees."""
    a = math.radians(rot)
    ca, sa = math.cos(a), math.sin(a)

    def tr(x, y):
        return (cx + x * ca - y * sa, cy + x * sa + y * ca)
    kx, ky = K * rx, K * ry
    start = tr(rx, 0)
    segs = [
        (tr(rx, ky), tr(kx, ry), tr(0, ry)),
        (tr(-kx, ry), tr(-rx, ky), tr(-rx, 0)),
        (tr(-rx, -ky), tr(-kx, -ry), tr(0, -ry)),
        (tr(kx, -ry), tr(rx, -kx * ry / rx if rx else 0), tr(rx, 0)),
    ]
    # fix last control (keep it simple & exact)
    segs[3] = (tr(kx, -ry), tr(rx, -ky), tr(rx, 0))
    return {"start": start, "segs": segs, "closed": True}


def circ(cx, cy, r):
    return ell(cx, cy, r, r)


def flatten(sub, steps=12):
    pts = [sub["start"]]
    cur = sub["start"]
    for s in sub["segs"]:
        if len(s) == 1:
            pts.append(s[0])
        else:
            c1, c2, p = s
            for k in range(1, steps + 1):
                u = k / steps
                v = 1 - u
                x = v**3 * cur[0] + 3 * v * v * u * c1[0] + 3 * v * u * u * c2[0] + u**3 * p[0]
                y = v**3 * cur[1] + 3 * v * v * u * c1[1] + 3 * v * u * u * c2[1] + u**3 * p[1]
                pts.append((x, y))
        cur = s[-1]
    return pts


def area(sub):
    P = flatten(sub)
    a = 0.0
    for i in range(len(P)):
        x0, y0 = P[i]
        x1, y1 = P[(i + 1) % len(P)]
        a += x0 * y1 - x1 * y0
    return a / 2


def reverse(sub):
    pts = [sub["start"]] + [s[-1] for s in sub["segs"]]
    segs = []
    for i in range(len(sub["segs"]) - 1, -1, -1):
        s = sub["segs"][i]
        prev = pts[i]
        if len(s) == 1:
            segs.append((prev,))
        else:
            segs.append((s[1], s[0], prev))
    return {"start": pts[-1], "segs": segs, "closed": sub["closed"]}


def orient(sub, positive=True):
    a = area(sub)
    if (a > 0) != positive:
        return reverse(sub)
    return sub


def xform(sub, dx=0, dy=0, sx=1, sy=1, rot=0, ox=0, oy=0):
    """Scale about (ox, oy), rotate (deg) about (ox, oy), then translate."""
    a = math.radians(rot)
    ca, sa = math.cos(a), math.sin(a)

    def f(p):
        x = (p[0] - ox) * sx
        y = (p[1] - oy) * sy
        x, y = x * ca - y * sa, x * sa + y * ca
        return (x + ox + dx, y + oy + dy)
    return {"start": f(sub["start"]), "segs": [tuple(f(q) for q in s) for s in sub["segs"]],
            "closed": sub["closed"]}


def mirror_x(sub, cx):
    return xform(sub, sx=-1, ox=cx)


def segs_between(sub, i, j):
    """Segments of a closed subpath going from vertex i to vertex j (forward)."""
    n = len(sub["segs"])
    pts = [sub["start"]] + [s[-1] for s in sub["segs"]]
    out = []
    k = i
    while k != j:
        out.append(sub["segs"][k % n])
        k = (k + 1) % n
    return pts[i % n], out


def region(sub, i, j, back_pts, t=1.0):
    """Closed region: follow `sub` from vertex i to j, then a smooth curve through back_pts
    returning to vertex i. Good for markings that share an edge with the outline."""
    start, segs = segs_between(sub, i, j)
    end = segs[-1][-1] if segs else start
    chain = [end] + [_pt(p) for p in back_pts] + [start]
    tail = cr(chain, closed=False, t=t)
    return {"start": start, "segs": segs + tail["segs"], "closed": True}


def fmt(v):
    v = round(v, 1)
    if v == int(v):
        return str(int(v))
    return ("%.1f" % v)


def to_d(subs, W, H, positive=True, fix_orient=True):
    out = []
    for sub in subs:
        if sub["closed"] and fix_orient:
            sub = orient(sub, positive != bool(sub.get("hole")))

        def c(p):
            return "%s %s" % (fmt(min(max(p[0], 0), W)), fmt(min(max(p[1], 0), H)))
        parts = ["M" + c(sub["start"])]
        for s in sub["segs"]:
            if len(s) == 1:
                parts.append("L" + c(s[0]))
            else:
                parts.append("C" + " ".join(c(q) for q in s))
        if sub["closed"]:
            parts.append("Z")
        out.append(" ".join(parts))
    return " ".join(out)


def mask_d(subs, W, H):
    """Paper mask: the whole viewBox minus the given closed shapes (non-zero winding)."""
    rect = poly([(0, 0), (W, 0), (W, H), (0, H)])
    rect = orient(rect, True)
    d1 = to_d([rect], W, H, fix_orient=False)
    d2 = to_d(subs, W, H, positive=False)
    return d1 + " " + d2


class Animal:
    MARGIN = 0.04

    def __init__(self, id, name, latin, W, H, group="land", fit=True):
        self.id, self.name, self.latin, self.W, self.H, self.group = id, name, latin, W, H, group
        self.layers = []
        self.fit = fit

    def add(self, subs, fill="dots", stroke=True, width=2.5):
        if isinstance(subs, dict):
            subs = [subs]
        self.layers.append({"subs": subs, "fill": fill, "stroke": bool(stroke), "width": width, "mask": False})

    def mask(self, subs):
        if isinstance(subs, dict):
            subs = [subs]
        self.layers.append({"subs": subs, "fill": "paper", "stroke": False, "width": 0, "mask": True})

    def bbox(self):
        has_mask = any(L["mask"] for L in self.layers)
        seen_mask = False
        xs, ys = [], []
        for L in self.layers:
            if L["mask"]:
                seen_mask = True
                continue
            vis = L["stroke"] or (L["fill"] in ("dots", "ink") and (seen_mask or not has_mask))
            if not vis:
                continue
            pad = L["width"] / 2 if L["stroke"] else 0
            for sub in L["subs"]:
                for x, y in flatten(sub, 8):
                    xs += [x - pad, x + pad]
                    ys += [y - pad, y + pad]
        return min(xs), min(ys), max(xs), max(ys)

    def json(self):
        W, H = self.W, self.H
        s, dx, dy = 1.0, 0.0, 0.0
        if self.fit:
            x0, y0, x1, y1 = self.bbox()
            bw, bh = x1 - x0, y1 - y0
            m = self.MARGIN
            Wn, Hn = bw / (1 - 2 * m), bh / (1 - 2 * m)
            s = min(600 / Wn, 600 / Hn, 1.15)
            Wn, Hn = Wn * s, Hn * s
            W = int(round(min(max(Wn, 300), 600)))
            H = int(round(min(max(Hn, 300), 600)))
            dx = (W - bw * s) / 2 - x0 * s
            dy = (H - bh * s) / 2 - y0 * s
        out = []
        for L in self.layers:
            subs = [dict(xform(sb, dx=dx, dy=dy, sx=s, sy=s), hole=sb.get("hole", False)) for sb in L["subs"]]
            if L["mask"]:
                d = mask_d(subs, W, H)
            else:
                d = to_d(subs, W, H)
            o = {"d": d, "fill": L["fill"], "stroke": L["stroke"]}
            if L["stroke"]:
                o["width"] = round(min(max(L["width"], 1.5), 4), 1)
            out.append(o)
        return {"id": self.id, "name": self.name, "latin": self.latin, "group": self.group,
                "viewBox": "0 0 %d %d" % (W, H), "layers": out}


def hole(sub):
    """Mark a closed subpath as a hole (opposite winding) for to_d."""
    s = dict(sub)
    s["hole"] = True
    return s


def sym(pts, cx, t=1.0):
    """Closed symmetric shape: pts run from the top (on the axis x=cx) down the right-hand
    side to the bottom (on the axis). The left side is mirrored."""
    P = list(pts)
    left = []
    for p in reversed(P[1:-1]):
        q = (2 * cx - p[0], p[1]) + tuple(p[2:])
        left.append(q)
    return cr(P + left, closed=True, t=t)


def lerp_w(widths, u):
    """widths: list of (u, w) sorted by u; piecewise-linear (smoothstep) interpolation."""
    if u <= widths[0][0]:
        return widths[0][1]
    for (u0, w0), (u1, w1) in zip(widths, widths[1:]):
        if u <= u1:
            f = (u - u0) / (u1 - u0) if u1 > u0 else 0
            f = f * f * (3 - 2 * f)
            return w0 + (w1 - w0) * f
    return widths[-1][1]


class Spine:
    def __init__(self, pts, t=1.0):
        sub = cr(pts, closed=False, t=t)
        P = flatten(sub, steps=40)
        L = [0.0]
        for a, b in zip(P, P[1:]):
            L.append(L[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
        self.P, self.L, self.len = P, L, L[-1]

    def at(self, u):
        s = min(max(u, 0), 1) * self.len
        import bisect
        i = min(max(bisect.bisect_right(self.L, s) - 1, 0), len(self.P) - 2)
        a, b = self.P[i], self.P[i + 1]
        seg = self.L[i + 1] - self.L[i] or 1
        f = (s - self.L[i]) / seg
        x, y = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy) or 1
        return (x, y), (-dy / n, dx / n)

    def pt(self, u, d):
        (x, y), (nx, ny) = self.at(u)
        return (x + nx * d, y + ny * d)

    def outline(self, widths, n=24, tip0=None, tip1=None, us=None):
        """Closed outline; widths [(u, half-width)] (or [(u, wl, wr)] for asymmetric)."""
        us = us or [i / n for i in range(n + 1)]
        def W(u, k):
            ws = [(w[0], w[k]) for w in widths]
            return lerp_w(ws, u)
        k2 = 2 if len(widths[0]) > 2 else 1
        left = [self.pt(u, W(u, 1)) for u in us]
        right = [self.pt(u, -W(u, k2)) for u in us]
        pts = left + list(reversed(right))
        # drop duplicate tip points where width is zero
        out = []
        for p in pts:
            if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 0.5:
                out.append(p)
        if math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) <= 0.5:
            out.pop()
        return cr(out, closed=True)


def ribbon(center, widths, n=10, closed_tip=True):
    """Tapered closed stroke shape along a smooth centre line."""
    sp = Spine(center)
    return sp.outline(widths, n=n)


def resample(pts, step, closed=False):
    """Points along a Catmull-Rom curve through pts, spaced ~step apart (includes ends)."""
    sp = Spine(list(pts) + ([pts[0]] if closed else []))
    n = max(2, int(round(sp.len / step)))
    return [sp.at(i / n)[0] for i in range(n + 1)], sp


def tufts(pts, step, amp, down=(0, 0), jitter=0.0, seed=1, side=1):
    """Hairy edge along an open curve through pts: alternating base points and pointed tips.
    Tips go along the curve's left normal * side * amp, plus a `down` bias vector."""
    import random
    R = random.Random(seed)
    sp = Spine(pts)
    n = max(2, int(round(sp.len / step)))
    out = []
    for i in range(n + 1):
        u = i / n
        (x, y), (nx, ny) = sp.at(u)
        if i % 2 == 1 and 0 < i < n:
            a = amp * (1 + R.uniform(-jitter, jitter))
            out.append((x + side * nx * a + down[0], y + side * ny * a + down[1], 'c'))
        else:
            out.append((x, y))
    return out
