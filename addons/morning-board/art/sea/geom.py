"""Small geometry kit for building the sea-animal path data.

Shapes keep two forms: the path commands that are written to JSON (cubic
Beziers where the shape is drawn by hand, polylines where it comes out of a
boolean operation) and a shapely geometry used for clipping and checks.
All closed exteriors are oriented with positive shoelace area and holes with
negative area, so layers can be combined under the non-zero winding rule.
"""
import math
import random
from shapely.geometry import Polygon, MultiPolygon, LineString, MultiLineString, Point, GeometryCollection
from shapely.ops import unary_union
from shapely.geometry.polygon import orient

K = 0.5523
WARP = [None]


def set_warp(f):
    """f(x, y) -> (x, y) applied to every point of later primitives (None to clear)."""
    WARP[0] = f


def _w(p):
    f = WARP[0]
    if f is None:
        return (p[0], p[1])
    return f(p[0], p[1])


# ---------------------------------------------------------------- basics
def _cubic(p0, c1, c2, p1, n):
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append((u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p1[0],
                    u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p1[1]))
    return out


def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def flatten_sub(sub):
    pts = [sub['start']]
    cur = sub['start']
    for seg in sub['segs']:
        if seg[0] == 'L':
            pts.append(seg[1])
            cur = seg[1]
        else:
            _, c1, c2, p = seg
            L = _dist(cur, c1) + _dist(c1, c2) + _dist(c2, p)
            n = max(4, int(L / 2.0))
            pts.extend(_cubic(cur, c1, c2, p, n))
            cur = p
    return pts


def shoelace(pts):
    a = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
    return a / 2


def reverse_sub(sub):
    pts = [sub['start']]
    for seg in sub['segs']:
        pts.append(seg[-1])
    segs = []
    n = len(sub['segs'])
    for i in range(n - 1, -1, -1):
        seg = sub['segs'][i]
        end = pts[i]
        if seg[0] == 'L':
            segs.append(('L', end))
        else:
            segs.append(('C', seg[2], seg[1], end))
    return {'start': pts[-1], 'segs': segs, 'closed': sub['closed']}


class Shape:
    def __init__(self, subs, geom):
        self.subs = subs
        self.geom = geom

    def __add__(self, other):
        if other is None:
            return self
        g = self.geom
        if g is None:
            g = other.geom
        elif other.geom is not None:
            if g.geom_type in ('Polygon', 'MultiPolygon') and other.geom.geom_type in ('Polygon', 'MultiPolygon'):
                g = unary_union([g, other.geom])
            elif _is_lines(g) and _is_lines(other.geom):
                ls = list(getattr(g, 'geoms', [g])) + list(getattr(other.geom, 'geoms', [other.geom]))
                g = MultiLineString(ls)
            else:
                g = GeometryCollection([g, other.geom])
        return Shape(self.subs + other.subs, g)

    __radd__ = lambda self, other: self if other in (0, None) else other.__add__(self)

    @property
    def area(self):
        return self.geom.area


def _closed_shape(sub):
    pts = flatten_sub(sub)
    if shoelace(pts) < 0:
        sub = reverse_sub(sub)
        pts = pts[::-1]
    poly = Polygon(pts)
    return Shape([sub], poly)


def combine(shapes):
    out = None
    for s in shapes:
        if s is None:
            continue
        out = s if out is None else out + s
    return out


# ---------------------------------------------------------------- primitives
def smooth(pts, closed=True, t=1.0):
    """Catmull-Rom spline through pts. A point given as (x, y, 'c') is a corner."""
    P = [_w(p) for p in pts]
    corner = [len(p) > 2 for p in pts]
    n = len(P)
    segs = []
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = P[(i - 1) % n] if (closed or i > 0) else P[i]
        p1 = P[i]
        p2 = P[(i + 1) % n]
        p3 = P[(i + 2) % n] if (closed or i + 2 < n) else p2
        if corner[i]:
            c1 = (p1[0] + (p2[0] - p1[0]) * 0.2, p1[1] + (p2[1] - p1[1]) * 0.2)
        else:
            c1 = (p1[0] + (p2[0] - p0[0]) / 6 * t, p1[1] + (p2[1] - p0[1]) / 6 * t)
        if corner[(i + 1) % n]:
            c2 = (p2[0] - (p2[0] - p1[0]) * 0.2, p2[1] - (p2[1] - p1[1]) * 0.2)
        else:
            c2 = (p2[0] - (p3[0] - p1[0]) / 6 * t, p2[1] - (p3[1] - p1[1]) / 6 * t)
        segs.append(('C', c1, c2, p2))
    sub = {'start': P[0], 'segs': segs, 'closed': closed}
    if closed:
        return _closed_shape(sub)
    return Shape([sub], LineString(flatten_sub(sub)))


def poly(pts, closed=True):
    P = [_w(p) for p in pts]
    sub = {'start': P[0], 'segs': [('L', p) for p in P[1:]], 'closed': closed}
    if closed:
        return _closed_shape(sub)
    return Shape([sub], LineString(P))


def line(pts):
    return smooth(pts, closed=False)


def ellipse(cx, cy, rx, ry=None, rot=0.0):
    if ry is None:
        ry = rx
    cx, cy = _w((cx, cy))
    ca, sa = math.cos(math.radians(rot)), math.sin(math.radians(rot))

    def T(x, y):
        return (cx + x * ca - y * sa, cy + x * sa + y * ca)
    kx, ky = K * rx, K * ry
    segs = [
        ('C', T(rx, ky), T(kx, ry), T(0, ry)),
        ('C', T(-kx, ry), T(-rx, ky), T(-rx, 0)),
        ('C', T(-rx, -ky), T(-kx, -ry), T(0, -ry)),
        ('C', T(kx, -ry), T(rx, -ky), T(rx, 0)),
    ]
    sub = {'start': T(rx, 0), 'segs': segs, 'closed': True}
    return _closed_shape(sub)


circle = ellipse


def spline_pts(pts, n_per=24, closed=False):
    """Sample a Catmull-Rom curve through pts and return a dense point list."""
    s = smooth(pts, closed=closed)
    out = []
    for sub in s.subs:
        out.extend(flatten_sub(sub))
    return out


def resample(pts, step):
    out = [pts[0]]
    acc = 0.0
    for i in range(1, len(pts)):
        a, b = pts[i - 1], pts[i]
        d = _dist(a, b)
        while acc + d >= step:
            r = (step - acc) / d
            a = (a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r)
            out.append(a)
            d = _dist(a, b)
            acc = 0.0
        acc += d
    if _dist(out[-1], pts[-1]) > step * 0.3:
        out.append(pts[-1])
    return out


def tube(center, widths, step=2.0, simplify=0.25):
    """A tapering tube along a smooth centre line. widths: list of (t, w) with t in 0..1."""
    pts = resample(spline_pts(center), step)
    n = len(pts)
    ws = sorted(widths)

    def W(t):
        for i in range(len(ws) - 1):
            if ws[i][0] <= t <= ws[i + 1][0]:
                r = (t - ws[i][0]) / max(1e-9, ws[i + 1][0] - ws[i][0])
                return ws[i][1] + (ws[i + 1][1] - ws[i][1]) * r
        return ws[-1][1] if t > ws[-1][0] else ws[0][1]
    parts = []
    prev = None
    for i, p in enumerate(pts):
        c = Point(p).buffer(max(0.3, W(i / (n - 1)) / 2), 24)
        if prev is not None:
            parts.append(unary_union([prev, c]).convex_hull)
        prev = c
    return from_geom(unary_union(parts), simplify)


def centerline_pts(center, step=2.0):
    return resample(spline_pts(center), step)


# ---------------------------------------------------------------- geometry ops
def _ring_sub(coords, closed=True):
    coords = list(coords)
    if closed and len(coords) > 1 and coords[0] == coords[-1]:
        coords = coords[:-1]
    return {'start': coords[0], 'segs': [('L', c) for c in coords[1:]], 'closed': closed}


def from_geom(g, simplify=0.25, min_area=2.0):
    if g is None or g.is_empty:
        return None
    if simplify:
        g = g.simplify(simplify, preserve_topology=True)
    polys = []
    if g.geom_type == 'Polygon':
        polys = [g]
    elif g.geom_type in ('MultiPolygon', 'GeometryCollection'):
        polys = [p for p in g.geoms if p.geom_type == 'Polygon']
    subs = []
    keep = []
    for p in polys:
        if p.area < min_area:
            continue
        p = orient(p, 1.0)
        keep.append(p)
        subs.append(_ring_sub(p.exterior.coords))
        for r in p.interiors:
            if Polygon(r).area >= min_area:
                subs.append(_ring_sub(r.coords))
    if not subs:
        return None
    return Shape(subs, unary_union(keep))


def lines_from_geom(g, simplify=0.25):
    if g is None or g.is_empty:
        return None
    if simplify:
        g = g.simplify(simplify)
    lines = []
    if g.geom_type == 'LineString':
        lines = [g]
    elif g.geom_type in ('MultiLineString', 'GeometryCollection'):
        lines = [x for x in g.geoms if x.geom_type == 'LineString']
    subs = [_ring_sub(l.coords, closed=False) for l in lines if l.length > 1.0]
    if not subs:
        return None
    return Shape(subs, MultiLineString([l for l in lines if l.length > 1.0]))


def union(*shapes, simplify=0.25):
    gs = [s.geom for s in shapes if s is not None]
    return from_geom(unary_union(gs), simplify)


def _is_lines(g):
    return g.geom_type in ('LineString', 'MultiLineString')


def inter(a, b, simplify=0.25):
    if a is None or b is None:
        return None
    g = a.geom.intersection(b.geom)
    if _is_lines(a.geom):
        return lines_from_geom(g, simplify)
    return from_geom(g, simplify)


def diff(a, b, simplify=0.25):
    if a is None:
        return None
    if b is None:
        return a
    if _is_lines(a.geom):
        return lines_from_geom(a.geom.difference(b.geom), simplify)
    return from_geom(a.geom.difference(b.geom), simplify)


def buffer(a, d, simplify=0.25):
    return from_geom(a.geom.buffer(d, 24), simplify)


def ring(a, w, simplify=0.25):
    """Inner band of width w along the inside of shape a."""
    return from_geom(a.geom.difference(a.geom.buffer(-w, 24)), simplify)


def keep_inside(shapes, region, margin=0.0):
    reg = region.geom.buffer(-margin) if margin else region.geom
    return combine([s for s in shapes if s is not None and s.geom.within(reg)])


# ---------------------------------------------------------------- point transforms
def tr(pts, dx, dy):
    return [(p[0] + dx, p[1] + dy) + tuple(p[2:]) for p in pts]


def sc(pts, sx, sy=None, cx=0.0, cy=0.0):
    if sy is None:
        sy = sx
    return [(cx + (p[0] - cx) * sx, cy + (p[1] - cy) * sy) + tuple(p[2:]) for p in pts]


def rot(pts, deg, cx=0.0, cy=0.0):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (p[0] - cx) * ca - (p[1] - cy) * sa, cy + (p[0] - cx) * sa + (p[1] - cy) * ca) + tuple(p[2:]) for p in pts]


def mx(pts, axis):
    return [(2 * axis - p[0], p[1]) + tuple(p[2:]) for p in pts]


def my(pts, axis):
    return [(p[0], 2 * axis - p[1]) + tuple(p[2:]) for p in pts]


# ---------------------------------------------------------------- output
def _fmt(v):
    s = '%.1f' % v
    if s.endswith('.0'):
        s = s[:-2]
    if s == '-0':
        s = '0'
    return s


def to_d(shape, W, H):
    out = []

    def P(p):
        x = min(max(p[0], 0.0), W)
        y = min(max(p[1], 0.0), H)
        return _fmt(x) + ' ' + _fmt(y)
    for sub in shape.subs:
        out.append('M' + P(sub['start']))
        for seg in sub['segs']:
            if seg[0] == 'L':
                out.append('L' + P(seg[1]))
            else:
                out.append('C' + P(seg[1]) + ' ' + P(seg[2]) + ' ' + P(seg[3]))
        if sub['closed']:
            out.append('Z')
    return ' '.join(out)


def layer(shape, fill, stroke=False, width=2.5):
    return {'shape': shape, 'fill': fill, 'stroke': stroke, 'width': width}


def scatter(rng, region, n, rmin, rmax, margin=2.0, tries=4000, avoid=None, gap=2.0):
    """Random non-overlapping circles fully inside region."""
    minx, miny, maxx, maxy = region.geom.bounds
    reg = region.geom.buffer(-margin)
    out = []
    placed = []
    t = 0
    while len(out) < n and t < tries:
        t += 1
        r = rng.uniform(rmin, rmax)
        x = rng.uniform(minx, maxx)
        y = rng.uniform(miny, maxy)
        c = Point(x, y).buffer(r)
        if not c.within(reg):
            continue
        if avoid is not None and c.buffer(gap).intersects(avoid.geom):
            continue
        if any(math.hypot(x - px, y - py) < r + pr + gap for px, py, pr in placed):
            continue
        placed.append((x, y, r))
        out.append(ellipse(x, y, r))
    return combine(out)


def affine_shape(shape, s, dx, dy):
    def m(p):
        return (p[0] * s + dx, p[1] * s + dy)
    subs = []
    for sub in shape.subs:
        segs = []
        for seg in sub['segs']:
            if seg[0] == 'L':
                segs.append(('L', m(seg[1])))
            else:
                segs.append(('C', m(seg[1]), m(seg[2]), m(seg[3])))
        subs.append({'start': m(sub['start']), 'segs': segs, 'closed': sub['closed']})
    return Shape(subs, shape.geom)


def shape_bounds(shape):
    xs, ys = [], []
    for sub in shape.subs:
        for p in flatten_sub(sub):
            xs.append(p[0])
            ys.append(p[1])
    return min(xs), min(ys), max(xs), max(ys)
