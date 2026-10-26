"""Validate land.json against the screensaver path-data contract."""
import json
import re
import sys

ARGS = {"M": 2, "L": 2, "C": 6, "Q": 4, "Z": 0}
NUM = re.compile(r"^-?\d+(\.\d)?$")
TOKEN = re.compile(r"[A-Za-z]|[^A-Za-z\s,]+")
FILLS = {"dots", "ink", "paper", "none"}


def check_d(d, W, H, fill, where, errs):
    toks = TOKEN.findall(d)
    if not toks or toks[0] != "M":
        errs.append(f"{where}: path must start with M")
        return
    i = 0
    sub_open = False
    sub_closed_flags = []
    while i < len(toks):
        c = toks[i]
        if c not in ARGS:
            errs.append(f"{where}: bad command/token {c!r}")
            return
        i += 1
        n = ARGS[c]
        nums = toks[i:i + n]
        if len(nums) < n:
            errs.append(f"{where}: {c} needs {n} numbers")
            return
        for k, s in enumerate(nums):
            if not NUM.match(s):
                errs.append(f"{where}: bad number {s!r}")
                return
            v = float(s)
            lim = W if k % 2 == 0 else H
            if v < 0 or v > lim:
                errs.append(f"{where}: coordinate {s} outside 0..{lim}")
        i += n
        if c == "M":
            if sub_open:
                sub_closed_flags.append(False)
            sub_open = True
        elif c == "Z":
            if not sub_open:
                errs.append(f"{where}: Z without subpath")
            sub_closed_flags.append(True)
            sub_open = False
        elif i < len(toks) and toks[i] not in ARGS:
            errs.append(f"{where}: implicit repeated command after {c} not allowed")
            return
    if sub_open:
        sub_closed_flags.append(False)
    if fill != "none" and not all(sub_closed_flags):
        errs.append(f"{where}: filled layer has a subpath without Z")


def main(path):
    errs = []
    data = json.load(open(path))
    animals = data.get("animals")
    if not isinstance(animals, list) or not animals:
        print("no animals")
        return 1
    ids = set()
    for a in animals:
        aid = a.get("id", "?")
        for key in ("id", "name", "latin", "group", "viewBox", "layers"):
            if key not in a:
                errs.append(f"{aid}: missing {key}")
        if set(a) - {"id", "name", "latin", "group", "viewBox", "layers"}:
            errs.append(f"{aid}: extra keys {set(a) - {'id','name','latin','group','viewBox','layers'}}")
        if aid in ids:
            errs.append(f"{aid}: duplicate id")
        ids.add(aid)
        if not re.match(r"^[a-z0-9]+(-[a-z0-9]+)*$", aid):
            errs.append(f"{aid}: id not kebab-case")
        if a.get("group") != "land":
            errs.append(f"{aid}: group must be land")
        nm = a.get("name", "")
        if not nm or nm[0] != nm[0].upper():
            errs.append(f"{aid}: name must be sentence case")
        m = re.match(r"^0 0 (\d+) (\d+)$", a.get("viewBox", ""))
        if not m:
            errs.append(f"{aid}: bad viewBox")
            continue
        W, H = int(m.group(1)), int(m.group(2))
        if not (300 <= W <= 600 and 300 <= H <= 600):
            errs.append(f"{aid}: viewBox size out of range")
        layers = a.get("layers", [])
        if not 1 <= len(layers) <= 10:
            errs.append(f"{aid}: {len(layers)} layers (1..10)")
        for li, L in enumerate(layers):
            where = f"{aid}[{li}]"
            if set(L) - {"d", "fill", "stroke", "width"}:
                errs.append(f"{where}: extra keys")
            if L.get("fill") not in FILLS:
                errs.append(f"{where}: bad fill")
            if not isinstance(L.get("stroke"), bool):
                errs.append(f"{where}: stroke must be bool")
            if L.get("stroke"):
                w = L.get("width", 2.5)
                if not (1.5 <= w <= 4):
                    errs.append(f"{where}: width {w} out of 1.5..4")
            if L.get("fill") == "none" and not L.get("stroke"):
                errs.append(f"{where}: invisible layer")
            check_d(L.get("d", ""), W, H, L.get("fill"), where, errs)
    for e in errs:
        print(e)
    print(f"{len(animals)} animals, {len(errs)} problems")
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "../land.json"))
