# Today

Your Google Calendar and Google Tasks on the TV in an e-ink style, and a screensaver of 50 moving ink animals.
Text on paper, the selected row an inverted ink bar, nothing slides or fades. It is the companion of the launcher's
e-ink Home ([`docs/ink-home.md`](../../docs/ink-home.md)), which shows Today's previews and animals, but it works on
any home screen.

- **Calendar**: today's events with places, then tomorrow's; the next event is bold. On a day with nothing on, the
  next day that has something.
- **Tasks**: open tasks with their due day, and what you finished today. **OK marks the selected task done** in
  Google Tasks.
- **Morning board**: a greeting, the time, today's events and open tasks side by side. It can open by itself each
  morning (off by default, see Options).
- **Screensaver** (the Ink Menagerie): one of 50 Malaysian land and sea animals, drawn in ink and halftone, beside
  the big clock and your next event. Every 20 seconds it goes out on its own outing, moving the way the real animal
  does, and comes home; a new animal every minute. Left and right on the remote switch animals.

Left and right swap Calendar and Tasks, Back goes Home. Night ink (light on dark) is on all day by default.

## 1. The Apps Script (your Google account)

Google's sign-in for TVs can't read Calendar or Tasks, so a small script in your own account does, and answers the
TV with today's agenda as JSON. Nothing else sees your data.

**The step-by-step guide, with what Google asks at each step, how to test it and what to do when it goes wrong, is
[docs/google-calendar-tasks.md](../../docs/google-calendar-tasks.md).** In short:

1. [script.google.com](https://script.google.com) › **New project**. Paste [`apps-script/Code.gs`](apps-script/Code.gs)
   over the default file.
2. **Project Settings** › tick **Show "appsscript.json" manifest file**, then paste
   [`apps-script/appsscript.json`](apps-script/appsscript.json) into it. It turns on the Tasks service and limits the
   script to reading your calendars and to your tasks (it needs to change those, so OK on the TV can tick one off).
   The time zone follows your Google Calendar's.
3. Choose **setup** in the function list and **Run**. Allow it (Google warns the app is unverified: it is yours;
   **Advanced › Go to project**). The log shows `key=…` and today's agenda.
4. **Deploy › New deployment › Web app**: Execute as **Me**, Who has access: **Anyone**. Copy the URL ending in
   `/exec`, and try it in a browser with `?key=<the key>` on the end.

Anyone with the URL **and** the key can read today's agenda and tick off your tasks, so keep both private.

## 2. Build and install

Copy `board.properties.example` to `board.properties` (git ignores it) and fill in the URL and the key. Then, with
JDK 17 and Android SDK platform 34 / build-tools 34.0.0, as for the launcher (Gradle needs JDK 17 exactly; on macOS
`export JAVA_HOME=$(/usr/libexec/java_home -v 17)` first, on Linux point `JAVA_HOME` at the JDK 17 folder):

```bash
cd addons/morning-board && ./gradlew assembleRelease
TV_HOST=<tv ip> ../../tools/venv/bin/python -I ../../tools/b64push.py app/build/outputs/apk/release/app-release.apk /data/local/tmp/today.apk
TV_HOST=<tv ip> ../../tools/venv/bin/python -I ../../tools/tv.py 'pm install -r /data/local/tmp/today.apk; rm -f /data/local/tmp/today.apk'
```

The APK is about 5 MB, so it goes over with `b64push.py`; `tv.py --push` is for small files. With the stock `adb`
(Wireless debugging), `adb install -r app/build/outputs/apk/release/app-release.apk` does both lines.

Build the launcher on the **same computer**: the e-ink Home reads Today's agenda through a signature permission,
granted only when both APKs carry the same (debug) key.

After pulling changes, always rebuild and install **both** apps, Today and the launcher. They share the code in
[`ink/`](../../ink/) (the album cover's size, for one), and a cover written by one version shows blank in the other.

Without a `board.properties` the app still builds: Calendar and Tasks show how to set it up, and the screensaver
works on its own.

## 3. The screensaver

Google TV has no menu for third-party screensavers, so set it over ADB (undo: put back the value `get` printed):

```bash
TV_HOST=<tv ip> tools/venv/bin/python -I tools/tv.py 'settings get secure screensaver_components'
TV_HOST=<tv ip> tools/venv/bin/python -I tools/tv.py 'settings put secure screensaver_components io.github.mrfritzdjango.morningboard/.AnimalDream'
```

To look at it straight away: `am start -n io.github.mrfritzdjango.morningboard/.SaverActivity` (add
`--es animal titan-triggerfish` to start on one animal and send it out at once). The e-ink Home also lists it as
**Screensaver**.

The animals' drawings and moves are made with the tools in [`art/`](art/) and [`motion/`](motion/).

## 4. Now playing

While Spotify plays on the TV (opened on the TV, or picked from your phone with Spotify Connect), the e-ink Home
and the screensaver show the song at the top right: the cover in shades of ink, NOW PLAYING, the song and the artist.
Paused, it reads PAUSED, and goes after ten minutes. With the Spotify row selected on Home, a larger view with the
album and a progress line takes its place; OK opens Spotify, OK held pauses or plays, Left goes to the song before
(or back to the start, three seconds or more in) and Right to the next. Under the line three marks, laid out like the
remote's ring, show those keys; Left and Right fade while Spotify won't skip, during an ad.

Android lets only a notification listener follow other apps' media sessions, so `NowPlaying` is one; it reads no
notifications. It is off until you allow it once (undo: `disallow_listener` with the same name):

```bash
TV_HOST=<tv ip> tools/venv/bin/python -I tools/tv.py 'cmd notification allow_listener io.github.mrfritzdjango.morningboard/.NowPlaying'
TV_HOST=<tv ip> tools/venv/bin/python -I tools/tv.py 'dumpsys media_session | grep -A6 com.spotify'
```

The second line, with a song playing, shows what Spotify tells Android. No cover shows when the app hands over only a
web address for its picture (Home and Today make no requests for it). Music your phone plays to its own speaker or
headphones is not on the TV, so it does not show.

While Spotify's own app is in front it keeps the screen on, so the screensaver does not start over it; the block
shows once you go back to Home, or when the screensaver starts after you leave Spotify playing from Home.

`NowPlaying` also keeps the last show or video watched in each streaming app (`watch_apps`) once you are a minute
into it, for Home's LAST WATCHED, shown while that app's row is selected. Each app decides what its media session says: some give the
episode and a picture, some only the title. Android's own Continue watching row is closed to other apps, so this is
built from what the apps report while they play.

## Options

Set in `app/src/main/res/values/options.xml` before building.

| Option | Default | What it does |
|---|---|---|
| `night_always` | `true` | Night ink on every screen all day. `false` uses `night_start`…`night_end` instead. Change the launcher's `ink_night_always` (`launcher/app/src/main/res/values/config.xml`) with it, so Home and Today match. |
| `night_start`, `night_end` | `19:30`, `07:00` | Night ink between these times when `night_always` is `false` (the morning board stays on paper). |
| `wake_hour`, `wake_minute` | `-1`, `0` | When the morning board opens by itself, on the TV's clock. `-1` is off. |
| `board_until_hour` | `9` | The morning board keeps the screen on until then, then goes back to Home. |
| `saver_change_minutes` | `1` | A new animal every this many minutes. |
| `saver_still_seconds` | `20` | How long the animal holds still at home between outings. |
| `now_playing_apps` | Spotify (TV and phone app) | The apps whose songs show on Home and the screensaver. |
| `watch_apps` | YouTube, Netflix, Prime Video, Apple TV, Disney+ Hotstar | The apps whose last show is Home's LAST WATCHED. |

The morning alarm asks Android to turn the screen on. On a Chromecast with Google TV that could only turn the TV on
over HDMI-CEC, and on the TV it was tried on it did not, which is why it is off by default. If you turn it on and the
TV stays dark, set the TV's own on-timer to the same time on the Chromecast's HDMI input.

## Permissions

| Permission | Why |
|---|---|
| `INTERNET` | Your own Apps Script: today's agenda, and marking a task done. Nothing else. |
| `USE_EXACT_ALARM` (`SCHEDULE_EXACT_ALARM` before Android 13) | The morning board, when `wake_hour` is set. |
| `RECEIVE_BOOT_COMPLETED` | Setting that alarm again after a restart. |
| `WAKE_LOCK` | Turning the screen on for the morning board. |

It also declares a signature permission, `…permission.AGENDA`, that guards its agenda provider and its refresh and
play/pause receivers, so that only your own launcher build can read the agenda or the song, ask for a refresh, or
pause the music.

No account on the TV and no telemetry. It fetches while one of its screens is showing (every 15 minutes), or when the
e-ink Home comes up and the last answer is more than 5 minutes old, and keeps the last answer for when the network is
down. The one service is `NowPlaying`, once you allow it: Android keeps it bound and calls it when a song changes,
and it makes no network requests. The address and key are built into your APK, so don't share the APK.

The font is [Atkinson Hyperlegible](https://brailleinstitute.org/freefont) by the Braille Institute, under the SIL
Open Font License ([FONT-LICENSE.txt](FONT-LICENSE.txt)). The launcher's e-ink Home borrows it from this app.

## Tested on

Chromecast with Google TV HD (boreal), Google TV 14. Unit tests: `./gradlew testReleaseUnitTest`.
