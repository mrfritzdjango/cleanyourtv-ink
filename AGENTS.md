# AGENTS.md

Instructions for coding agents (Claude Code, Codex, Gemini CLI, Cursor, Copilot and others) working in
this repository, the Ink edition of Clean Your TV. People should start with [README.md](README.md) and
[CONTRIBUTING.md](CONTRIBUTING.md); this file repeats their rules in the form an agent needs.

## First: which job are you doing?

| You were asked to | Do this |
|---|---|
| Clean up a TV: debloat it and install the e-ink Home | Read [PROMPT.md](PROMPT.md) and follow it exactly, on the real TV. Use the tools in `tools/` and the launcher in `launcher/` rather than writing new ones; the only file you need to change is `launcher/app/src/main/res/values/config.xml` (`dock_apps`) for this TV. Do not edit the repo's docs, tests or other code, and do not open issues or pull requests unless the person asks you to. |
| Install the Ink edition on a TV: the e-ink Home, the Today add-on, the animal screensaver | Read [INK-PROMPT.md](INK-PROMPT.md) and follow it on the real TV. The rules below still apply. |
| Connect someone's Google Calendar and Tasks | Walk them through [docs/google-calendar-tasks.md](docs/google-calendar-tasks.md); they click, you explain. Never put their key in a commit, issue or screenshot. |
| Change this repo: a TV list, a fix, docs, an animal | Skip the next section and read on from [Repo map](#repo-map). |

### Cleaning a TV: the rules that are not negotiable

[PROMPT.md](PROMPT.md) is the procedure. Its safety rules, in brief:

- **Disable, never uninstall.** `pm disable-user --user 0`, one package per shell call. No
  `pm uninstall`, no root, nothing flashed. Every step must be undone by `tools/restore.sh`.
- **Back up first.** Package list, disabled list, `getprop` and settings into `backup/` before the first
  change. `tools/disable.sh` also writes its own record in `~/.cleanyourtv/`; keep the list you applied.
- **Leave alone what the TV needs to work:** the TV app and input services behind HDMI and the tuner,
  the input/source menu, remote and Bluetooth pairing, the on-screen keyboard, Play Store and Play
  Services. When a package name says nothing, read `dumpsys package <name>`, then ask.
- **Never disable Android's core packages:** the permission controller, package installer, ext
  services/shared and module metadata (`com.android.*` and `com.google.android.*`),
  `com.google.android.overlay.modules*`, `com.android.providers.*` (calendar, contacts, user dictionary
  and blocked numbers aside), `com.android.systemui`, `com.android.shell`, `com.android.phone`,
  `com.android.settings`, `com.android.tv.settings`, `android`. Without them Android may not boot (#884);
  `tools/disable.sh`, `disable.ps1` and `check.py --fix` refuse such a list, with no override.
- **Never start a factory or test package** (`com.cvte.tv.hkcfac`, `mediatek.factorymenu.ui` and the like),
  not even to look. On some boards that flips a factory-mode flag the shell cannot undo.
- **Keep the Home guard.** The stock launcher is disabled only after the new launcher is installed and
  confirmed as Home (`dumpsys activity activities | grep mFocusedApp`). On Google TV, check
  `dumpsys wifi | grep -o 'cname=[^ ]*'` before disabling setupwraith: if it owns the saved Wi-Fi
  network, disabling it takes the TV off Wi-Fi and ADB. `tools/disable.sh` and
  `launcher/build-and-install.sh` already enforce this. Use `FORCE_HOME=1` or `FORCE_SETUPWRAITH=1` only in
  the situation the script's own message describes, and only with the person's agreement.
  - On a CVTE board (any `com.cvte.*` package), leave its stock launcher (`com.cvte.tv.launcher.*`) enabled
    unless the `examples/` folder for that exact board disables it. Make the new launcher Home with
    `cmd package set-home-activity`, reboot once, and confirm Home and ADB come back before anything else.
    Don't enable a remote-key helper in the same pass: a JVC set hung on its boot animation with ADB gone
    after both were done before one reboot (#741).
- **Ask before anything the family uses.** Streaming apps, the voice assistant, Chromecast, Miracast and
  the firmware updater go into one checklist question; disable only what the person does not tick.
- **Disable in small batches** and screenshot between them (`tools/tv.py --screenshot shots/01.png`).
  Live TV, HDMI and some streaming apps give empty screenshots; that is the TV, not damage.
- **An injected key is not proof** for a remote button that goes through an accessibility helper: ask the
  person to press the real button. `am force-stop com.gathin.tvhome` switches that helper off.
- **Close ADB afterwards.** USB debugging and Network/ADB debugging off, authorisations revoked, reboot,
  then `tools/adb-closed.py <tv ip>` must report the port closed. Port 5555 is plaintext.
- **Stop and say so** when the TV refuses: `pm disable-user` refused for every package, a sideload that
  fails verification, or an SDK below the launcher's `minSdk` 26. Do not retry in a loop, and do not lower
  `minSdk` or hand over an APK built elsewhere.

The person's backups (`backup/`), screenshots (`shots/`), notes (`work/`) and the ADB key
(`tools/adbkey/`) are listed in `.gitignore` and must never be committed. If the person wants to
share their TV's list afterwards, follow [`docs/workflows/tv-list.md`](docs/workflows/tv-list.md).

## Repo map

| Path | What it is |
|---|---|
| `README.md` | Front page: the Ink edition, then the TV cleanup (with the TV tables generated from `examples/*/tv.json` by `tools/gen_tables.py`) and the Tools table. |
| `PROMPT.md` | The debloat-and-launcher prompt people paste into their agent. Brand-neutral; safety rules live here. |
| `INK-PROMPT.md` | The Ink edition's setup prompt: Today, the screensaver, now playing, and how to undo each. |
| `launcher/` | The e-ink Home, package `com.gathin.tvhome`: four classes (MainActivity, InkHome, InkApps, HomeKeyService), plain Java, no libraries, `minSdk` 26, no `INTERNET` permission. |
| `ink/` | Code compiled into both apps: the animal player (`Animals`, `Shows`, `ShowView`, `SvgPath`) and the now-playing views (`Playing`, `Watched`, `CoverView`, `SongBlock`, `SongBird`). |
| `addons/morning-board/` | Today: Calendar, Tasks, the morning board, now playing, last watched and the animal screensaver. Its `apps-script/` runs in the owner's Google account; `art/` builds the drawings and `motion/` the shows. |
| `examples/` | One folder per tested TV model: `debloat.txt`, `tv.json` (its row in the TV tables), sometimes a `README.md`. Indexed in `examples/README.md`, whose table is generated too. |
| `docs/` | `ink-home.md`, `google-calendar-tasks.md`, `TROUBLESHOOTING.md`, `REMOTE.md`, `docs/devices/` for models with notes but no tested list, and the [workflows](#workflows). |
| `tools/` | The ADB client (`tv.py`) and the debloat, restore, privacy and drift-check scripts, listed in the README's Tools table. Shell scripts have PowerShell twins. Each script's usage is in its first lines. |
| `tests/` | Python `unittest` suite: list format, README tables, the Home guard and the tools against fake TVs. |
| `.github/workflows/` | `ci.yml` (tests, launcher build, APK size gate), `addons.yml` (builds and tests Today when it or `ink/` changes). |

## Where a change goes

| The change | Where it goes |
|---|---|
| A TV list, a fix, docs, a tool fix | A pull request here |
| A change to the e-ink Home, Today, the animals or `ink/` | A pull request here; both apps must build |
| A new look or a different launcher | A fork: the launcher here is one design on purpose |
| Safety rules in `PROMPT.md`, the Home-safety logic in the scripts, protected packages | Open an issue first; do not change them in a PR |

## Workflows

Step-by-step methods in `docs/workflows/`:

- [`tv-list.md`](docs/workflows/tv-list.md): add a tested TV's debloat list with its `tv.json`, or update one.
- [`docs-notes.md`](docs/workflows/docs-notes.md): add a troubleshooting entry or a `PROMPT.md` fix, keeping pinned facts.

## Before opening a PR

| Check | Command or rule |
|---|---|
| Tests, as CI runs them | `python3 -m unittest discover -s tests -v` after `python3 -m venv tools/venv` and `tools/venv/bin/pip install -r tools/requirements.txt`. On `main`, CI sets `CLEANYOURTV_STRICT=1` and checks the TV tables are what `tools/gen_tables.py` writes. |
| Launcher and Today | JDK 17, Android SDK platform 34, build-tools 34.0.0. In `launcher/` and in `addons/morning-board/`: `./gradlew --no-daemon testReleaseUnitTest lintRelease assembleRelease`. Lint stays at zero errors. |
| APK size gate | `launcher/app/build/outputs/apk/release/app-release.apk` must be under 131,072 B (128 KB). Linux: `stat -c %s`, macOS: `stat -f %z`. |
| The animals | After changing a drawing or a show: `node addons/morning-board/motion/check.js` reports 0 problems, and `bake.js` rebuilt `moves.bin`. |
| README rows | A new list adds only its folder, with a `tv.json`: the TV tables and counts are generated after merging. |
| One topic per PR | A TV list never rides inside a launcher PR. |
| Real TV | Changes to the e-ink Home or Today are tried on a real TV with the real remote: Up, Down, OK, Back. |
| Screenshots | Every visual change has a screenshot from the TV in the PR description, with nothing personal in it. |

## Hard rules

Never do these in a PR:

- **No prebuilt APKs or binaries** in the repo. People build from source; Today carries their own Apps Script
  address and key, so a shared APK couldn't work anyway.
- **No uninstalling.** No `pm uninstall` in a list or a script. `pm hide` or `pm block` only with the matching
  undo written in the list header.
- **No network in the launcher:** no `INTERNET` permission, no analytics or telemetry, no background services or
  polling, no blur or video. What needs the network goes in Today. It targets TVs with 1 GB of RAM.
- **No new launcher dependencies** without discussing them in an issue first.
- **No changes to the safety rules** in `PROMPT.md`, the Home guard and other safety checks in
  `tools/disable.sh`, `tools/check.py` and `launcher/build-and-install.sh`, or the list of packages the TV
  needs, without the maintainer.
- **Firmware updaters are better left enabled** (commented out in the list); a list that disables one says why in
  its header.
- **No secrets or identifiers** in commits, lists or screenshots: no IP addresses, Wi-Fi names, account emails,
  serial numbers, Android IDs, MAC addresses, ADB keys, Apps Script URLs or keys, calendar events or songs. Use
  `<tv ip>` or `192.168.1.50` in docs. `addons/morning-board/board.properties` is git-ignored: keep it that way.
- **The Apps Script asks for no more than it needs:** read-only Calendar (`calendar.readonly`) and Tasks
  (`tasks`, which can change tasks, because OK on a task in Today ticks it off), and nothing else
  (`appsscript.json` `oauthScopes`).
- **No root, no getting around app-store protection, no private builds** others cannot reproduce from this repo.
- **Don't relax `minSdk`** (26) or the launcher's permissions.
- **Security problems are reported privately**, as [SECURITY.md](SECURITY.md) describes, never in a public issue.

## Commit and PR style

- Titles are `area: what changed`, in plain words, with the issue in parentheses when there is one:
  `examples: add Epson LS800 laser projector (Askey HA90, Amlogic), Android TV 14`,
  `Launcher: Menu opens Settings`, `Today: last watched for Disney+`. The area is the folder or file the change is
  in: `examples`, `Launcher`, `Today`, `ink`, `docs`, `tools`, `tests`, `README`.
- The body is one or two sentences on what changed and the TV it was tried on, then the template's checklist.
- One topic per PR. Small is fine. Be kind in reviews.
- Contributions are released under the repo's MIT licence.

## Where to ask

Questions, bugs and ideas go to [issues](https://github.com/mrfritzdjango/cleanyourtv-ink/issues).
