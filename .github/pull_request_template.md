<!-- Thanks. One or two sentences on what this changes and the TV it was tried on is plenty. -->

**Tested on:** <!-- model, Android version -->

### If this adds or changes a TV list
- [ ] `examples/<brand>-<model>/debloat.txt`, header with model, Android version and firmware build
- [ ] Only packages I actually disabled and lived with; anything I had to re-enable is noted
- [ ] `examples/<brand>-<model>/tv.json` with the TV, OS, brand and notes; nothing changed outside my folder (the README tables are generated from it)
- [ ] Nothing in the list uninstalls

### If this touches the e-ink Home, Today or `ink/`
- [ ] Verified on a real TV, screenshot attached (no calendar, song or other personal details in it)
- [ ] Up, Down, OK and Back checked with the real remote
- [ ] The launcher still has no network permission, no background service and no new permission
- [ ] Both apps build: `launcher/` and `addons/morning-board/` (`ink/` is compiled into each)

### If this adds or changes an animal
- [ ] Drawing in `addons/morning-board/art/`, merged with `art/merge.py`
- [ ] Shows baked with `motion/bake.js`; `node motion/check.js` reports 0 problems
