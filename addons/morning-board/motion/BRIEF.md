# Ink Menagerie: writing animal shows

You are animating ink drawings of animals for a TV. Each animal gets a pass (it crosses the TV's Home screen once a
minute) and an outing (on the screensaver it leaves its spot, does something, and comes back). The owner asked for:
movement that is smooth and as lively as possible, every animal unique and true to how it really moves, with wind,
water or dust effects where they fit. The design for every animal is already agreed. Your job is to bring the
animals you are given to life, faithfully to that design and better than it where you can.

Everything lives in this folder (call it `$M`):
`addons/morning-board/motion`

## Read first

1. `engine.js`: read its header comment (the show API) and skim `Pose`, `sceneFor` and the effects list.
2. `motions/lib.js`: the helpers you will use: beats, paths, bends, effects.
3. `motions/ref.js`: the two reference shows, TITANE and the Malayan tapir. Match their structure, comments and
   standard. Look at how they use `beat()`, `P.v` (state passed from path to bend and fx), region weights in `bend`,
   and `emit()` with `poseAt` for effects that persist after the moment they were made (dust at footfalls).
3. `study.py`: the agreed design. The LAND, CANOPY and SEA lists hold, per animal: how it really moves, what it does
   passing Home, what it does on the screensaver, its signature moment and its effects.
4. `research.md`: the detailed field research behind the design (frame counts, body regions, rhythms). Where the
   research says "fr" (frames), it meant 8 per second; the animation is now continuous, so read those as timings.
5. The geometry: `grid0.png` … `grid4.png` (made by `python3 grids.py`, which needs Pillow) show every drawing with a 10% grid (0 to 10 along the top and the left), so
   you can find where legs, tails, fins, wings, jaws and claws are in the drawing's 0..1 coordinates (u across, v
   down). Which animals are on which sheet:
   - grid0: malayan-tapir, malayan-tiger, bornean-orangutan, malayan-sun-bear, rhinoceros-hornbill, proboscis-monkey, sunda-pangolin, lesser-mouse-deer, bornean-pygmy-elephant, sunda-slow-loris, large-flying-fox, gaur
   - grid1: sunda-clouded-leopard, asian-water-monitor, white-handed-gibbon, smooth-coated-otter, binturong, sunda-colugo, saltwater-crocodile, buffy-fish-owl, collared-kingfisher, rajah-brookes-birdwing, oriental-pied-hornbill, malayan-peacock-pheasant
   - grid2: green-sea-turtle, whale-shark, reef-manta-ray, dugong, irrawaddy-dolphin, humpback-whale, scalloped-hammerhead, clownfish, seahorse, day-octopus, moon-jellyfish, horseshoe-crab
   - grid3: cuttlefish, lionfish, pufferfish, bumphead-parrotfish, leatherback-turtle, moray-eel, giant-grouper, blue-spotted-stingray, chambered-nautilus, mudskipper, fiddler-crab, barracuda
   - grid4: sea-star, titan-triggerfish
   To see one drawing bigger, or its layers: `python3` over
   `../app/src/main/assets/animals.json` (read only, never edit it).

## Rules

- Write only your own file, `motions/<your file>.js` (named in your task). Never edit `engine.js`, `lib.js`,
  `ref.js`, `check.js`, `strip.html`, `shot.sh` or anyone else's file. If you need a helper, define it inside your
  file's `(function () { ... })()` wrapper. If the engine truly cannot do something you need, say so in your report.
- **facing**: the way the drawing faces: `'L'`, `'R'`, `'F'` (at us) or `'U'` (seen from above, head at the top).
  Set `P.m` to the way the animal is going (1 right, -1 left) and the engine mirrors a drawing that faces the other
  way. `P.mirror = true` flips it on top of that (a turn, or the gibbon's change of hands).
- **props**: layers that are not the animal (a branch, a bar) are listed in `props` and drawn unbent. Known prop
  layers: rhinoceros-hornbill 3, oriental-pied-hornbill 3, collared-kingfisher 4, buffy-fish-owl 0, sunda-slow-loris 0,
  binturong 0, proboscis-monkey 1, bornean-orangutan 0, white-handed-gibbon 0. `P.prop = null` keeps the prop with
  the animal; `stay(P, sc)` leaves it at home (a bird that flies off its branch); `hideProp(P)`; `propWith(P, {...})`.
  The owner agreed birds leave their branch and fly; their folded wing is swung over the shoulder as a stylised flap.
- **pass**: 3 to 5 s, written left to right (the player mirrors it for right to left). It starts and ends with the
  whole drawing off screen, or hidden (`P.hidden = true`) when the animal leaves another way (under water, into a
  burrow). The drawing is huge by default (it fits 1.1 x 0.9 of the screen); set `size: [w, h]` to change that, and
  `maxScale` if `P.scale` goes above 1.05. The owner wants it to cross the whole screen and cover it.
- **outing**: 6 to 10 s, about 9. It must start and end exactly at home: `P.x = sc.hx, P.y = sc.hy`, scale 1
  (`sc.homeScale`), angle 0, sx = sy = 1, not mirrored (so `P.m` is the drawing's own facing at the start and the
  end: -1 for 'L', 1 for 'R'), props at home. The engine starts each outing pose at home; you move it from there. Stay
  on screen: `sc.left`, `sc.right`, `sc.up`, `sc.down` are how far the centre can go from home each way
  (`reachX(sc, f)`, `reachY(sc, f)` help). The clock sits bottom right; passing over it is fine.
- **smooth and lively**: every pose, bend and effect is a continuous function of t. No snapping to frames
  (`step()`/`square()` only for a behaviour that really is a snap, like a strike). Use easing (`ease`, `S`, `hump`),
  anticipation before a big move, follow-through and overlapping action (a tail or ears lag the body), squash and
  stretch, and keep something alive at all times (breathing, a tail, fins, ears, an eye). Freezes are good where the
  animal really freezes (mouse-deer, slow loris, barracuda), but even then something tiny can move. A deliberate cut
  (a one-frame strike) is allowed; set `P.v.cut = true` on those moments so the checker does not flag the jump.
- **bends**: work in drawing units (0..1); keep them under about 0.3. Weight every bend to its body part with
  `box()`/`S()` so it does not leak into other parts (the tapir's head turn first leaked into its front legs and tore
  the hooves). Turn limbs, jaws, tails and wings about their joints with `rot()`. The TV bends the drawing through a
  24 x 12 grid, so very sharp local bends are softened; keep features at least a grid cell wide (about 4% x 8%).
- **effects**: ink only, through the lib helpers (dust and sand as halftone clouds, bubbles, wind and current
  streaks, ripples, splashes, leaves, prints, little fish and specks, and `poly` for water lines, vines, trunks,
  crevices, burrows). Set `E.back = true` for what goes behind the animal, then back to false. Design px, left to
  right, 1920 x 1080. Use them to make the behaviour read; don't clutter.
- **unique**: the signature moment in `study.py` must clearly happen. No two animals may feel the same.

## Check your work

- `cd $M && node check.js <your file>`: must end `0 problems`. Run it on just one animal with
  `node check.js <your file> <id>`.
- Look at it. `./shot.sh $M/out/<id>-pass.png "files=<your file>&id=<id>&mode=pass&n=12&cols=4" 1600 740`
  renders 12 moments of the show in a grid (`t=0.5,1,1.5` picks exact moments; `dir=-1` plays a pass right to left;
  `night=1` night ink; `mode=outing`). Then Read the PNG. Make the `out/` folder first (`mkdir -p $M/out`).
  Check that the animal is recognisable in every frame, the signature moment reads, no part tears or leaks, effects
  sit where they belong, the pass really crosses the screen and the outing returns home. Iterate until you are proud
  of it. Look at both the pass and the outing for every animal.

## Report back

For each animal: two lines on what its pass and outing now do, anything you changed from the design and why, and
anything you are unsure of. Confirm `node check.js <your file>` reports 0 problems.
