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
  tools/requirements.txt`, and `adb` (Android SDK platform-tools). Install what is missing, telling the person what
  and why.
- Gradle here needs JDK 17 exactly; a newer default `java` fails the build. Before every `./gradlew` below, point
  `JAVA_HOME` at a 17: on macOS `export JAVA_HOME=$(/usr/libexec/java_home -v 17)` (check that `$JAVA_HOME/bin/java
  -version` says 17; Homebrew's `openjdk@17` is at `/opt/homebrew/opt/openjdk@17`), on Linux the JDK 17 folder, for
  example `export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64`. `launcher/build-and-install.sh` finds one by itself.

### 2. Connecting to the TV

Ask which TV or box it is. Then one of:

- **Network debugging (most Android TVs):** Settings › Device Preferences › About › press Build seven times, then
  Developer options › USB debugging and Network debugging on. `TV_HOST=<tv ip> tools/venv/bin/python -I tools/tv.py
  --probe`, and the person accepts the prompt on the TV. Use `tools/tv.py` for every command below.
- **Wireless debugging (Google TV 12 and later, Chromecast with Google TV):** Developer options › Wireless debugging
  on › Pair device with pairing code. This needs the stock `adb` from Android SDK platform-tools. `adb pair <ip>:<pairing port> <code>` with the numbers on the TV, then
  `adb connect <ip>:<port>` with the port shown on the Wireless debugging screen (or `adb mdns services`). Use
  `adb -s <serial> shell ...` for every command below; `tools/tv.py` cannot pair.

`getprop ro.build.version.sdk` must be 26 or more. Below that, stop and say so: the apps need Android 8.

### 3. Back up

Into `backup/` (git ignores it): `getprop` model and build, the current Home
(`cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME`),
`settings get secure screensaver_components` and `settings get secure enabled_notification_listeners`. These are what
step 8 puts back. If `backup/` already has them from an earlier run (the person came back to rebuild after setting
up Calendar, say), keep them and do not overwrite them: a second run would record the Ink apps instead of the TV's own.

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

Install `addons/morning-board/app/build/outputs/apk/release/app-release.apk`: `adb install -r` it, or on the
tools/tv.py path push it with `tools/venv/bin/python -I tools/b64push.py <the apk> /data/local/tmp/today.apk` (the APK
is about 5 MB, too big for `tv.py --push`), then `pm install -r /data/local/tmp/today.apk; rm -f
/data/local/tmp/today.apk`. Build the launcher on the same computer: the e-ink Home reads Today's agenda through a
permission granted only to an app signed with the same key.

Updating later: after pulling changes, always rebuild and install **both** apps. They share the code in `ink/` (the
album cover's size, for one), and a cover written by one version shows blank in the other.

### 6. Build and install the launcher, and make it Home

- **tools/tv.py path:** `STOCK_LAUNCHER=none TV_HOST=<tv ip> launcher/build-and-install.sh`. It builds, installs,
  makes the launcher Home and checks that Home landed on it. `STOCK_LAUNCHER=none` keeps the stock Home enabled
  (without it the script disables the stock launcher it recognises), so undoing is one command. Follow its messages;
  `FORCE_HOME=1` only in the case its message describes, and only with the person's agreement.
- **adb path:** `cd launcher && ./gradlew assembleRelease`, `adb install -r app/build/outputs/apk/release/app-release.apk`.
  Check the launcher starts before making it Home: `adb shell am start -W -n com.gathin.tvhome/.MainActivity` must
  print `Status: ok`; if it doesn't, stop and say so, Home stays as it is. Then
  `adb shell cmd package set-home-activity --user 0 com.gathin.tvhome/.MainActivity`, press Home
  (`input keyevent KEYCODE_HOME`) and check `dumpsys activity activities | grep mFocusedApp` names `com.gathin.tvhome`.

Do not disable the stock launcher in this procedure. If Home keeps going back to it, follow the launcher section of
`PROMPT.md` and its Home guard (on Google TV that includes the setupwraith Wi-Fi check).

With both apps installed, check that Home may read Today:
`dumpsys package com.gathin.tvhome | grep morningboard.permission.AGENDA` must show `granted=true`. If it doesn't, the
two apps were signed with different keys (built on different computers or accounts), or the launcher went in before
Today on an older Android: build both on the same computer, install Today, then install the launcher again.

### 7. The extras the person ticked

- Screensaver: `settings put secure screensaver_components io.github.mrfritzdjango.morningboard/.AnimalDream`.
  Try it at once with `am start -n io.github.mrfritzdjango.morningboard/.SaverActivity`.
- Now playing: `cmd notification allow_listener io.github.mrfritzdjango.morningboard/.NowPlaying`. Then
  `settings get secure enabled_notification_listeners` must contain `.NowPlaying`. If it doesn't, the TV refused it:
  tell the person now playing can't be turned on on this TV, and go on without it.

Then take a screenshot of Home (`adb exec-out screencap -p > shots/home.png`, or `tools/tv.py --screenshot`) and look
at it. Ask the person to press Home, Up, Down and OK on the real remote; an injected key is not proof.

### 8. How to undo it

Tell the person these, with the values from step 3:

- Home back to the stock launcher: `cmd package set-home-activity --user 0 <the Home from step 3>`. If the stock
  launcher is disabled (by an earlier cleanup, say), `pm enable --user 0 <its package>` first, then
  `set-home-activity`, and check Home lands on it (`dumpsys activity activities | grep mFocusedApp` after pressing
  Home) before removing anything; otherwise the TV is left without a Home.
- Screensaver back: `settings put secure screensaver_components <the value from step 3>`. If step 3 saved `null`
  (nothing was set), use `settings delete secure screensaver_components` instead.
- Now playing off: `cmd notification disallow_listener io.github.mrfritzdjango.morningboard/.NowPlaying`.
- The two apps stay installed; to remove them, once Home is back on the stock launcher, the person uninstalls
  **Home** and **Today** in the TV's Settings › Apps (they are theirs, sideloaded, not part of the TV).

### 9. Close ADB

As in `PROMPT.md`: USB, Network and Wireless debugging off, debugging authorisations revoked, and for a TV that used
port 5555, `tools/venv/bin/python -I tools/adb-closed.py <tv ip>` must report the port closed.
