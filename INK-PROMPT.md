# The Ink edition prompt

Paste this into Claude Code, Codex, Gemini CLI or another coding agent, opened in a clone of this repository, with
the computer and the TV on the same Wi-Fi:

```
Set up the Ink edition of Clean Your TV on my TV: the e-ink Home, the Today add-on and the animal
screensaver. Read INK-PROMPT.md in this repository and follow it step by step. Ask me before anything
that changes the TV, and stop if something refuses.
```

To also strip the TV's bloatware, run upstream's [`PROMPT.md`](PROMPT.md) first, exactly as written, then this.

---

## For the agent

You install two apps the person builds from this repo, make one of them Home, and optionally set the screensaver
and the now-playing listener. Every rule in [`PROMPT.md`](PROMPT.md) ("Cleaning a TV: the rules that are not
negotiable" in [`AGENTS.md`](AGENTS.md)) still applies: back up first, keep the Home guard, never start a factory
package, never disable a package from this procedure, close ADB at the end. Use the tools in `tools/` and the code in
this repo; the only files you change are `launcher/app/src/main/res/values/config.xml` (`dock_apps`) and
`addons/morning-board/board.properties`. Do not commit, push or open issues unless the person asks.

### 1. The computer

- JDK 17 (`java -version`), the Android SDK with platform 34 and build-tools 34.0.0 (`ANDROID_HOME` or a
  `local.properties` with `sdk.dir`), Python 3 with `python3 -m venv tools/venv && tools/venv/bin/pip install -r
  tools/requirements.txt`, and `adb` (platform-tools). Install what is missing, telling the person what and why.

### 2. Connecting to the TV

Ask which TV or box it is. Then one of:

- **Network debugging (most Android TVs):** Settings › Device Preferences › About › press Build seven times, then
  Developer options › USB debugging and Network debugging on. `TV_HOST=<tv ip> tools/venv/bin/python -I tools/tv.py
  --probe`, and the person accepts the prompt on the TV. Use `tools/tv.py` for every command below.
- **Wireless debugging (Google TV 12 and later, Chromecast with Google TV):** Developer options › Wireless debugging
  on › Pair device with pairing code. `adb pair <ip>:<pairing port> <code>` with the numbers on the TV, then
  `adb connect <ip>:<port>` with the port shown on the Wireless debugging screen (or `adb mdns services`). Use
  `adb -s <serial> shell ...` for every command below; `tools/tv.py` cannot pair.

`getprop ro.build.version.sdk` must be 26 or more. Below that, stop and say so: the apps need Android 8.

### 3. Back up

Into `backup/` (git ignores it): `getprop` model and build, the current Home
(`cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME`),
`settings get secure screensaver_components` and `settings get secure enabled_notification_listeners`. These are what
step 8 puts back.

### 4. Ask the person, in one checklist

- **Calendar and Tasks** from their Google account? Then walk them through
  [`docs/google-calendar-tasks.md`](docs/google-calendar-tasks.md), one step at a time in their browser (they click,
  you explain; you can't do it for them), including the browser test in its step 4. Have them put the `/exec` URL and
  the key into `addons/morning-board/board.properties` themselves (copy `board.properties.example`). Never paste the key into a
  commit, an issue or a screenshot. Without it the apps still work: Calendar and Tasks show how to set it up.
- **The animal screensaver** in place of the current one?
- **Now playing** (the song Spotify plays, and the last show watched in YouTube, Netflix and other streaming apps,
  shown on Home)? It needs Today to be allowed as a notification listener; it reads media sessions only.
- **Which apps** go on Home? List the launchable apps (`cmd package query-activities --brief -a
  android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER`) and offer up to six; they can change
  them later on the TV (Settings › Home apps). Put the packages in `dock_apps` in `config.xml`, in their order.

### 5. Build and install Today

```bash
cd addons/morning-board && ./gradlew assembleRelease
```

Install `addons/morning-board/app/build/outputs/apk/release/app-release.apk` (`adb install -r`, or with tools/tv.py
`--push` it to `/data/local/tmp/today.apk` and `pm install -r` it). Build the launcher on the same computer: the e-ink
Home reads Today's agenda through a permission granted only to an app signed with the same key.

### 6. Build and install the launcher, and make it Home

- **tools/tv.py path:** `TV_HOST=<tv ip> launcher/build-and-install.sh`. It builds, installs, makes the launcher Home
  and rolls back if Home doesn't land on it. Follow its messages; `FORCE_HOME=1` only in the case its message
  describes, and only with the person's agreement.
- **adb path:** `cd launcher && ./gradlew assembleRelease`, `adb install -r app/build/outputs/apk/release/app-release.apk`,
  then `adb shell cmd package set-home-activity --user 0 com.gathin.tvhome/.MainActivity`, press Home
  (`input keyevent KEYCODE_HOME`) and check `dumpsys activity activities | grep mFocusedApp` names `com.gathin.tvhome`.

Do not disable the stock launcher in this procedure. If Home keeps going back to it, follow the launcher section of
`PROMPT.md` and its Home guard (on Google TV that includes the setupwraith Wi-Fi check).

### 7. The extras the person ticked

- Screensaver: `settings put secure screensaver_components io.github.mrfritzdjango.morningboard/.AnimalDream`.
  Try it at once with `am start -n io.github.mrfritzdjango.morningboard/.SaverActivity`.
- Now playing: `cmd notification allow_listener io.github.mrfritzdjango.morningboard/.NowPlaying`.

Then take a screenshot of Home (`adb exec-out screencap -p > shots/home.png`, or `tools/tv.py --screenshot`) and look
at it. Ask the person to press Home, Up, Down and OK on the real remote; an injected key is not proof.

### 8. How to undo it

Tell the person these, with the values from step 3:

- Home back to the stock launcher: `cmd package set-home-activity --user 0 <the Home from step 3>`.
- Screensaver back: `settings put secure screensaver_components <the value from step 3>`.
- Now playing off: `cmd notification disallow_listener io.github.mrfritzdjango.morningboard/.NowPlaying`.
- The two apps are theirs, sideloaded, not part of the TV: `pm uninstall com.gathin.tvhome` and
  `pm uninstall io.github.mrfritzdjango.morningboard` remove them.

### 9. Close ADB

As in `PROMPT.md`: USB, Network and Wireless debugging off, debugging authorisations revoked, and for a TV that used
port 5555, `tools/venv/bin/python -I tools/adb-closed.py <tv ip>` must report the port closed.
