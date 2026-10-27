# ink

The animal player and the now-playing block, shared by two apps: the [Today add-on](../addons/morning-board/) (its screensaver) and the
launcher's [e-ink Home](../docs/ink-home.md) (an animal crossing Home every 30 seconds). Both Gradle builds compile
this folder into their own APK (`sourceSets.main.java.srcDirs` in each `app/build.gradle`), so there is one copy of
the code and nothing to keep in sync.

| Class | What it does |
|---|---|
| `SvgPath` | Reads the small slice of SVG path data the drawings use (absolute M, L, C, Q, Z). |
| `Animals` | Loads `assets/animals.json`: each animal's layers as Paths (outline, halftone, ink, paper, knock-outs). |
| `Shows` | Indexes and unpacks `assets/moves.bin`: each animal's pass and outing as keyframes. |
| `ShowView` | Draws an animal into bitmaps and plays a show, bending the drawing through a grid and blending keyframes on every display frame. |
| `Playing` | The song Today's `NowPlaying` follows: one row of its provider, where the song is now, and when a paused one goes. |
| `Watched` | The last show watched in a streaming app, as Today's `NowPlaying` keeps it: title, episode, app, a 16:9 frame. |
| `CoverView` | An album cover (or a video's frame) in sixteen shades of ink, on a tile a shade off the page. |
| `SongBlock` | The block at the top right of Home and the screensaver: the cover, NOW PLAYING, the song, the artist, kept to the right-hand column (a long line glides slowly to its end and back); on Home, with a streaming app's row selected and no song, LAST WATCHED. |
| `SongBird` | The menagerie's collared kingfisher perched on that cover: while the song plays it bows and three notes rise from its beak, in steps a few times a second, only while on screen; paused, it sits still. |

The assets live only in Today; the launcher reads them through `createPackageContext`. Their tests are Today's
(`addons/morning-board/app/src/test`), which check every drawing and every show in the real assets. The drawings
are made in [`art/`](../addons/morning-board/art/) and the shows in [`motion/`](../addons/morning-board/motion/).
