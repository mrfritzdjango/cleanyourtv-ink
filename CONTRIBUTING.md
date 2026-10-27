# Contributing

Thanks for helping. Three kinds of contributions are especially welcome: a TV this was tried on, a fix to the e-ink
Home or Today, and a clearer step in a guide.

Working with a coding agent? Point it at [`AGENTS.md`](AGENTS.md): the same rules, written for agents.

## Where does my idea go?

| Your idea | Where it goes |
|---|---|
| A TV's debloat list, a fix to a tool or the prompt | A pull request here (sections 1 and 3 below). Lists are welcome [upstream](https://github.com/Gathin23/cleanyourtv) too. |
| A fix or a small feature for the e-ink Home, Today or the animals | A pull request here (section 2) |
| A new look or a different launcher altogether | Your own fork: the launcher here is one design on purpose |

## 1. Add your TV model

Every brand ships different bloat. If you ran the prompt (or did it by hand) on a TV that isn't in
`examples/`, add it. The same steps for a coding agent are in
[`docs/workflows/tv-list.md`](docs/workflows/tv-list.md).

1. Create `examples/<brand>-<model>/debloat.txt`. Copy the format from
   `examples/xiaomi-mi-tv-4a/debloat.txt`: one package per line, grouped with a comment that says
   what the group is, and a trailing comment on anything non-obvious ("re-enable for firmware
   updates", "needed for HDMI-CEC", etc.).
2. Put the exact model name, Android version and firmware build in the header so people can tell
   whether it matches theirs. `tools/tv.py --probe` prints all three.
3. Only list packages you have actually disabled and lived with for a few days. Note anything that
   broke and what you re-enabled.
4. Add `examples/<brand>-<model>/tv.json`, the row the TV tables show for your list. Copy
   `examples/xiaomi-mi-tv-4a/tv.json`: `tv` (the model as the tables name it), `os`, `brand` (spelled as
   on the README's brand line; a new brand is fine) and `notes` (one line: what the list disables and
   keeps). Change nothing outside your folder: the TV tables in `README.md` and `examples/README.md`, the
   brand line and the counts are generated from every folder's `tv.json` after merging, so a PR that
   edits them only collides with the other open lists.
5. If your TV's Live TV app or stock launcher has a different package name, say so in the header. Where
   a script needs the stock launcher, `tools/restore.sh` takes it as its second argument
   (`tools/restore.sh <list> <package>`) and `launcher/build-and-install.sh` takes it in the
   environment, as `STOCK_LAUNCHER=<package>` (`-StockLauncher` on the PowerShell twin, and `none`
   keeps it enabled) - not as an argument.

Never list packages to *uninstall*. Everything in this repo disables with `pm disable-user`, which
is reversible from the TV's own settings if the tools are gone.

Android's own packages are not bloat either. Never list the permission controller, the package
installer, ext services or ext shared, module metadata, a `com.google.android.overlay.modules*`
overlay, systemui, shell, phone, settings, tv.settings, `android`, or a `com.android.providers.*`
package other than calendar, contacts, user dictionary and blocked numbers. A TV that loses one of
them may never boot again ([#884](https://github.com/Gathin23/cleanyourtv/issues/884), and
[what to do if it already happened](docs/TROUBLESHOOTING.md#working-on-the-tv)), so
`tools/disable.sh`, `disable.ps1` and `check.py --fix` refuse such a list outright, with no switch to
override it, and a pull request that names them comes back for a rework.

## 2. Improve the e-ink Home, Today and the animals

The launcher (`launcher/`) is one screen, InkHome, in plain Java with no libraries; Today (`addons/morning-board/`)
does everything that needs the network or other apps' data, and hands it to Home through a provider that only an app
signed with the same key can read. Keep it that way: the launcher has no internet permission, no background service
and no polling. Code both apps use (the animal player, the now-playing block) lives in `ink/` and is compiled into
each, so change it once.

- Build and test both: `cd launcher && ./gradlew testReleaseUnitTest lintRelease assembleRelease`, and the same in
  `addons/morning-board`. Lint stays at zero errors, and the launcher's APK stays under the CI gate (128 KB).
- Try it on a real TV with the real remote, and attach a screenshot with nothing personal in it: no calendar
  events, no song, no Wi-Fi name.
- The design is deliberate: text on paper, an inverted ink bar, nothing that slides, fades or glows.
  [`docs/ink-home.md`](docs/ink-home.md) describes it.
- A new animal: draw it in [`addons/morning-board/art/`](addons/morning-board/art/README.md), write its two shows in
  [`motion/`](addons/morning-board/motion/README.md), and check them with `node check.js`.

## 3. Improve the prompt and tools

`PROMPT.md` is what most people will actually use. If your assistant got stuck somewhere, the fix
usually belongs in the prompt as one extra sentence, not in a script. Keep it brand-neutral; put
brand-specific knowledge in `examples/`.

`tools/tv.py` and `tools/b64push.py` talk to a TV with Network debugging on port 5555 without the
stock `adb` binary, so the scripts work wherever Python does. They can't pair: Wireless debugging (Google TV 12 and
later, Chromecast with Google TV) needs the stock `adb` from Android SDK platform-tools, `adb pair` and then
`adb connect`, as [`INK-PROMPT.md`](INK-PROMPT.md) describes. If you find a cleaner way, open an issue first.

## Pull requests

- One topic per PR. Small is fine.
- Say which TV you tested on.
- No new dependencies in the launcher without discussing it in an issue.
- Be kind in reviews.

By contributing you agree your work is released under the repo's MIT licence.
