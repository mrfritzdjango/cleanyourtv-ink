# The drawings

The 50 ink animals are not hand-drawn SVGs: each is built in Python from shapes (ellipses, ribbons along a spine,
polygons) that shapely unions, cuts and outlines into the halftone, ink, paper and stroke layers the TV draws.
`app/src/main/assets/animals.json` is what the app ships and what `motion/` animates; these scripts rebuild it.

| Folder | What is in it |
|---|---|
| `land/` | The 24 land and canopy animals, one file each in `defs/`. `build.py` writes `land.json`. |
| `sea/` | The 26 sea animals in `animals_a.py` … `animals_c.py`, with fixes in `patches/`. `gen.py` writes `sea.json`. |
| `merge.py` | Joins `land.json` and `sea.json` into the app's `animals.json`, keeping each animal's Malay name. |

```bash
cd addons/morning-board/art
python3 -m venv venv && venv/bin/pip install -r requirements.txt
ln -s ../venv land/venv && ln -s ../venv sea/venv          # the scripts call venv/bin/python
(cd land && venv/bin/python build.py && venv/bin/python validate.py ../land.json)
(cd sea && venv/bin/python gen.py && venv/bin/python validate.py ../sea.json)
python3 merge.py
```

`render.py` in either folder draws a contact sheet (`land/run.sh` does build, validate and render in one go).
After changing a drawing, re-bake the shows (`../motion/README.md`): a show bends the drawing on a grid and names its
prop layers by number, so a drawing whose layers change needs its show checked again.

The local names are in `animals.json` only (`"malay"`); add one there by hand for a new animal.
