# Ink Menagerie: the animals' moves

Each animal's two shows (the pass across Home, the outing on the screensaver) are written here in JavaScript,
checked, and baked into `../app/src/main/assets/moves.bin`, which ShowView (`ink/` at the repo root, shared by
Today and the launcher) plays on the TV, blending between keyframes twelve a second. The drawings themselves come
from `../app/src/main/assets/animals.json` (built by `../art/`); every tool here reads that file directly.

Needs Node 18 or later. Headless Chrome for `shot.sh`, Pillow for `grids.py`.

- `engine.js` the show API (header comment); `motions/lib.js` the helpers; `motions/*.js` the 50 animals
  (`ref.js` holds TITANE and the tapir, the reference pair).
- `node check.js [file] [id]` checks every show: passes start and end off screen, outings start and end at home,
  nothing jumps.
- `node bake.js ../app/src/main/assets/moves.bin` bakes every show (`FILES=ref,reef` for just those files). The
  result is byte-for-byte the same each time, so `git diff` shows only real changes.
- `./shot.sh <out.png> "files=<file>&id=<id>&mode=pass&n=12&cols=4"` renders moments of a show (headless Chrome);
  `overview.html` shows all fifty at once (open it with file access allowed, as `shot.sh` does).
- `./live.sh` bakes every show that passes the checks, builds Today and installs it on the TV adb is connected to
  (`ADB_SERIAL` to pick one, `ADB` for the adb binary, and `JAVA_HOME` set to a JDK 17 for Gradle).
- `python3 grids.py` draws `grid0.png` … with every drawing on a 10% grid, to place a show's bends.
- `python3 study.py` builds the Ink Menagerie page (research, designs and a theatre that plays every show).
- `BRIEF.md` and `research.md`: how the shows were written, and the field research behind each one.

After baking, rebuild and reinstall Today; the launcher reads Today's `moves.bin` and needs no rebuild.
