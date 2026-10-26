# The e-ink Home

`ink_home` turns the launcher's Home into a page of paper: one text list, a big clock, and nothing that slides,
fades or glows. It is built for a TV that mostly shows a calendar, a few apps and, now and then, an animal.

```
  Calendar ███                              ░░░  NOW PLAYING
  Tasks                                     ░░░  Holocene
                                                 Bon Iver
  YouTube
  Netflix                                        TODAY
  Prime Video                                    9:30   Dentist
  Spotify                                        13:00  Lunch with Sam
  Screensaver
                                                                21:47
  Settings                                                  Mon 26 Oct
```

- **The list**: Calendar and Tasks (from the [Today add-on](../addons/morning-board/)), then your apps (the ones
  chosen in [Home apps](#choosing-the-apps), or `dock_apps` until you change them), then Screensaver (at most eight
  rows above it), and Settings last, a little apart.
- **The previews**: while Calendar or Tasks is selected, today's events or your open tasks appear in the middle of
  three equal columns, level with the first row, whether a song plays or not, read from Today (Home itself has no network). The next event is bold and moves on with the clock.
- **Now playing**: while Spotify plays, the song sits at the top right, level with Calendar: the cover in shades of ink,
  three small bars that step up and down while it plays (flat once paused), NOW PLAYING (PAUSED, for ten minutes, once paused), the song and the artist, beside the Calendar or Tasks
  preview, which never stacks under it. With the Spotify row selected, a larger view with the same bars, the album and a progress line takes its place. It comes from Today's
  `NowPlaying`, which you allow once over ADB ([Today's README](../addons/morning-board/README.md#4-now-playing)).
- **Last watched**: with YouTube, Netflix, Prime Video, Apple TV or Hotstar selected, the top right shows the last
  show or video you watched in that app, for a week: a 16:9 frame in shades of ink, LAST WATCHED, the title, and the
  episode with the app. Only while the row is selected; the block that stays up is Spotify's alone. It counts once you
  are a minute into it, so trailers an app plays by itself do not. OK opens the app, where its own Continue watching
  row carries on.
- **The animals**: every 30 seconds, at :15 and :45, one of Today's 50 ink animals crosses the whole screen in its
  own way; the remote keeps working underneath. One pass in five is TITANE (`TITANE_EVERY` in `InkHome.java`).
- **Night ink**: light on dark. All day by default (`ink_night_always`), or 19:30 to 07:00.

Keys: Up and Down move the ink bar, OK opens, and on the Spotify row OK held pauses or plays (a short press opens
Spotify when you let go). Menu opens the launcher's own settings. Home on Home goes back to the top of the list.

## Choosing the apps

Which apps are on Home is up to you, on the TV, with the remote: **Settings → Home apps**.

```
  HOME APPS                 ALL APPS  1/2               NETFLIX

  YouTube                   Apple TV                    Open  ███
  Netflix                   Disney+                     Move
  Spotify                   Netflix   on Home           Remove from Home
                            ...
  All apps  ███             Get more apps
```

- **Home apps** lists the apps on Home. OK on one opens its page: **Open**, **Move** (Up and Down move it, OK or
  Back puts it down) or **Remove from Home**. Removing only takes it off Home; the app stays on the TV.
- **All apps** lists every app on the TV by name, a page at a time (Down from the last row turns the page); the
  ones on Home say so. OK on one opens its page: **Open**, and **Add to Home** for one that is not there yet (it goes
  to the bottom of Home's apps), or Open, Move and Remove for one that is.
- **Get more apps**, at the end of All apps, opens the Play Store. Install an app there (HBO Max, say), press Back,
  and it is in All apps, ready to add. Apps installed from a phone (play.google.com, Install, pick the TV) show up
  the same way.
- Home shows at most six apps with Calendar and Tasks (eight without Today), so the list stays one page. When it is
  full, an app's page says so instead of offering Add to Home: remove one first.
- Back goes up one level (an app's page → the list it came from → Home apps → Settings → Home), and Home closes the
  pages. **TV settings**, under Settings, opens the TV's own settings, which the Settings row opened before.

The choice is kept on the TV, in the launcher's own data, so it survives reboots and launcher updates. It is
ignored when you rebuild with a different `dock_apps` (the new list takes over, as the stock Home's saved order
does), and clearing the launcher's data brings `dock_apps` back.

To change the starting list itself, for every TV you build for, edit `dock_apps` in `config.xml` with the apps'
package names. `tools/tv.py 'pm list packages'` lists them; HBO Max is usually `com.wbd.stream`.

## Turning it on

In `launcher/app/src/main/res/values/config.xml`, then build and install as usual
([`launcher/build-and-install.sh`](../launcher/build-and-install.sh)):

| Key | Default here | What it does |
|---|---|---|
| `ink_home` | `true` | The e-ink Home. `false` brings back the normal launcher, with every other config key as before. |
| `ink_night_always` | `true` | Night ink all day. `false` switches between paper (07:00–19:30) and night ink. |
| `dock_apps` | YouTube, Netflix, Prime Video, Hotstar, Apple TV, Spotify | The first app rows, in this order, until they are changed on the TV in Settings → Home apps; apps that are not installed are left out. |

These are build settings: a pushed theme's `config.json` doesn't change them (the Keys table in [`themes/README.md`](../themes/README.md) marks them "`config.xml` only").

## What it needs from Today

Install [Today](../addons/morning-board/README.md), built on the same computer as the launcher. The launcher reads
these from it, and carries no copy of them:

| From Today | Without it |
|---|---|
| The agenda (a content provider behind a signature permission) | No Calendar or Tasks rows |
| The song playing (the same provider, `.../now`) | No now-playing block |
| The animals and their shows (`animals.json`, `moves.bin`) | No animals pass |
| The Atkinson Hyperlegible font | The system sans-serif |

Home asks Today for a fresh agenda each time it comes up (at most every 5 minutes), and shows "Waiting for today's
agenda" rather than yesterday's when the last answer is from an earlier day.

The animal player (`Animals`, `Shows`, `ShowView`, `SvgPath`) and the now-playing block (`Playing`, `CoverView`,
`SongBlock`) live in [`ink/`](../ink/) at the repo root and are compiled into both apps, so there is one copy of them.

## Size

The fonts and the 5 MB of animal shows live in Today, so the launcher's release APK is about 514 KB with `ink_home`
and the now-playing block. Upstream's CI gate is 512 KB; this fork's (`.github/workflows/ci.yml`) is 560 KB. Check it
after a change:
`stat -f %z launcher/app/build/outputs/apk/release/app-release.apk` (macOS) or `stat -c %s` (Linux).
