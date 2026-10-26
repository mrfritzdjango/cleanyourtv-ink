"""Replace top-level functions in a module with same-named ones from another file.
Usage: python patch.py target.py new_defs.py"""
import re
import sys

tgt, src = sys.argv[1], sys.argv[2]
t = open(tgt).read()
s = open(src).read()
blocks = re.split(r'(?m)^(?=def )', s)
for b in blocks:
    m = re.match(r'def (\w+)\(', b)
    if not m:
        continue
    name = m.group(1)
    b = b.rstrip() + '\n\n\n'
    i = t.find('\ndef %s(' % name)
    if i < 0:
        raise SystemExit('no function %s in %s' % (name, tgt))
    i += 1
    j = len(t)
    for pat in ('\n# ------', '\nANIMALS', '\ndef '):
        k = t.find(pat, i + 5)
        if 0 <= k < j:
            j = k + 1
    t = t[:i] + b + t[j:]
    print('replaced', name)
open(tgt, 'w').write(t)
