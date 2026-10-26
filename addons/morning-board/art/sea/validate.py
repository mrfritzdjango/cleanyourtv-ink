"""Validate sea.json against the format contract.

Usage: venv/bin/python validate.py ../sea.json
Errors make the exit status 1. Warnings (self-intersecting filled subpaths,
margins far from 4%) are printed but do not fail.
"""
import json
import re
import sys

NUM = re.compile(r'^\d+(\.\d)?$')
TOKEN = re.compile(r'[A-Za-z]|[^\sA-Za-z,]+')
ARGS = {'M': 2, 'L': 2, 'C': 6, 'Q': 4, 'Z': 0}
FILLS = {'dots', 'ink', 'paper', 'none'}
ID = re.compile(r'^[a-z0-9]+(-[a-z0-9]+)*$')


def check_d(d, W, H, filled, where, errs, warns):
    toks = TOKEN.findall(d.replace(',', ' '))
    if not toks or toks[0] != 'M':
        errs.append('%s: path must start with M' % where)
        return []
    i = 0
    subs = []
    cur = None
    while i < len(toks):
        c = toks[i]
        if c not in ARGS:
            errs.append('%s: bad command or stray token %r' % (where, c))
            return subs
        i += 1
        n = ARGS[c]
        nums = toks[i:i + n]
        if len(nums) < n:
            errs.append('%s: %s needs %d numbers' % (where, c, n))
            return subs
        for t in nums:
            if not NUM.match(t):
                errs.append('%s: bad number %r (plain, non-negative, at most one decimal)' % (where, t))
                return subs
        vals = [float(t) for t in nums]
        for k in range(0, n, 2):
            x, y = vals[k], vals[k + 1]
            if not (0 <= x <= W and 0 <= y <= H):
                errs.append('%s: point %s,%s outside viewBox' % (where, nums[k], nums[k + 1]))
        i += n
        if i < len(toks) and toks[i] not in ARGS:
            errs.append('%s: implicit repeated command after %s (write the letter each time)' % (where, c))
            return subs
        if c == 'M':
            if cur is not None and not cur['closed'] and filled:
                errs.append('%s: filled subpath not closed with Z' % where)
            cur = {'pts': [(vals[0], vals[1])], 'closed': False}
            subs.append(cur)
        elif c == 'Z':
            if cur is None:
                errs.append('%s: Z without subpath' % where)
            else:
                cur['closed'] = True
                cur = None
        else:
            if cur is None:
                errs.append('%s: %s after Z without a new M' % (where, c))
                cur = {'pts': [], 'closed': False}
                subs.append(cur)
            cur['pts'].append((vals[-2], vals[-1]))
            if c == 'C':
                cur.setdefault('ctrl', []).extend([(vals[0], vals[1]), (vals[2], vals[3])])
    if cur is not None and not cur['closed'] and filled:
        errs.append('%s: filled subpath not closed with Z' % where)
    return subs


def main():
    path = sys.argv[1]
    data = json.load(open(path))
    errs, warns = [], []
    if set(data.keys()) != {'animals'}:
        errs.append('top level must be {"animals": [...]}')
    seen = set()
    try:
        from shapely.geometry import Polygon
        sys.path.insert(0, __file__.rsplit('/', 1)[0])
        from render import parse
    except Exception:
        Polygon = None
    for a in data.get('animals', []):
        aid = a.get('id', '?')
        need = {'id', 'name', 'latin', 'group', 'viewBox', 'layers'}
        if set(a.keys()) != need:
            errs.append('%s: keys must be %s, got %s' % (aid, sorted(need), sorted(a.keys())))
        if not ID.match(str(aid)):
            errs.append('%s: id must be kebab-case' % aid)
        if aid in seen:
            errs.append('%s: duplicate id' % aid)
        seen.add(aid)
        if a.get('group') != 'sea':
            errs.append('%s: group must be "sea"' % aid)
        name = a.get('name', '')
        # explicit owner-requested exception: the nickname keeps its quotes and capitals
        if aid == 'titan-triggerfish' and name == 'Titan triggerfish, also known as "TITANE"':
            pass
        elif not name or name[0] != name[0].upper() or (len(name.split()) > 1 and any(w[0].isupper() for w in name.split()[1:])):
            errs.append('%s: name must be sentence case: %r' % (aid, name))
        lat = a.get('latin', '')
        if not re.match(r'^[A-Z][a-z]+ [a-z]+$', lat):
            errs.append('%s: latin looks wrong: %r' % (aid, lat))
        m = re.match(r'^0 0 (\d+) (\d+)$', a.get('viewBox', ''))
        if not m:
            errs.append('%s: viewBox must be "0 0 W H"' % aid)
            continue
        W, H = int(m.group(1)), int(m.group(2))
        if not (300 <= W <= 600 and 300 <= H <= 600):
            errs.append('%s: viewBox size out of range' % aid)
        layers = a.get('layers', [])
        if not 1 <= len(layers) <= 10:
            errs.append('%s: %d layers (1..10)' % (aid, len(layers)))
        minx, miny, maxx, maxy = W, H, 0, 0
        for li, L in enumerate(layers):
            where = '%s layer %d' % (aid, li)
            if not isinstance(L, dict):
                errs.append('%s: not an object' % where)
                continue
            allowed = {'d', 'fill', 'stroke', 'width'}
            if not set(L.keys()) <= allowed or not {'d', 'fill', 'stroke'} <= set(L.keys()):
                errs.append('%s: keys %s' % (where, sorted(L.keys())))
            if L.get('fill') not in FILLS:
                errs.append('%s: fill %r' % (where, L.get('fill')))
            if not isinstance(L.get('stroke'), bool):
                errs.append('%s: stroke must be true/false' % where)
            if L.get('stroke'):
                wv = L.get('width')
                if not isinstance(wv, (int, float)) or not 1.5 <= wv <= 4:
                    errs.append('%s: width %r (1.5..4)' % (where, wv))
            if L.get('fill') == 'none' and not L.get('stroke'):
                errs.append('%s: invisible layer (fill none, no stroke)' % where)
            filled = L.get('fill') != 'none'
            subs = check_d(L.get('d', ''), W, H, filled, where, errs, warns)
            for s in subs:
                for x, y in s['pts']:
                    minx, miny, maxx, maxy = min(minx, x), min(miny, y), max(maxx, x), max(maxy, y)
            if Polygon is not None and filled and not errs:
                for k, s in enumerate(parse(L['d'])):
                    if len(s['pts']) >= 3:
                        p = Polygon(s['pts'])
                        if not p.is_valid and p.buffer(0).area > 4:
                            warns.append('%s subpath %d: self-intersecting' % (where, k))
        mx, my = minx / W, miny / H
        rx, ry = 1 - maxx / W, 1 - maxy / H
        if min(mx, my, rx, ry) < 0.005 or max(mx, rx) > 0.12 and max(my, ry) > 0.12:
            warns.append('%s: margins L%.0f%% T%.0f%% R%.0f%% B%.0f%%' % (aid, mx * 100, my * 100, rx * 100, ry * 100))
    for w in warns:
        print('WARN', w)
    for e in errs:
        print('ERROR', e)
    print('%d animals, %d errors, %d warnings' % (len(data.get('animals', [])), len(errs), len(warns)))
    sys.exit(1 if errs else 0)


if __name__ == '__main__':
    main()
