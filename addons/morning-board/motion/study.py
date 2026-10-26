"""Builds the Ink Menagerie motion study page from animals.json and the design notes below."""
import html, json, os

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'src', 'main', 'assets', 'animals.json')
OUT = 'ink-menagerie.html'
animals = {a['id']: a for a in json.load(open(SRC))['animals']}

# id: (moves like, passing Home, on the screensaver, signature, effects)
LAND = [
 ('malayan-tapir', 'Walks slowly on its toe tips, head low, the trunk-like snout sweeping the ground for scent. A strong swimmer that uses the snout as a snorkel.',
  '4.5 s. Nose-down walk, the snout sniffing side to side. Halfway across it wades into a river: a waterline climbs its body until only the back and the curled snout tip show, ringed by ripples.',
  'Follows a scent trail out, stops, curls the snout up to taste the air while little whistle squiggles rise, then trots home.',
  'The snorkel', ['waterline', 'ripples']),
 ('malayan-tiger', 'A lateral walk with the head level and low, the shoulder blades rolling above the back line. Marks its range by spraying and scraping, and swims well.',
  '5 s, the heaviest, slowest cat. Shoulders rise and fall with each planted foreleg; the tail hangs in a low J and flicks its tip every other stride. Tall grass blades bend away as it passes.',
  'Walks to a tree trunk, turns, lifts its tail straight up and sprays a fine mist, scrapes twice with puffs of dirt, holds a still sniff, walks home.',
  'Tail up, mist on the trunk', ['grass', 'mist', 'dirt']),
 ('sunda-pangolin', 'On all fours with head and tail low in one humped line, forefeet on their outer edges, claws tucked. The most tree-living pangolin. Rolls into a ball when threatened.',
  'A slow, stiff shuffle; the forefeet barely move. Ants scatter and leaf litter flicks at each step.',
  'Shuffles to a termite mound and nods in four times, soil crumbs flying. A falling leaf startles it: it rolls into an armoured ball, rolls one turn, holds, uncurls and shuffles home.',
  'The ball', ['ants', 'crumbs', 'leaf']),
 ('lesser-mouse-deer', 'One of the smallest hoofed mammals, about 2 kg, on delicate tiptoe. When alarmed it freezes, drums its hind feet (a related species reaches 7 stamps a second) and bolts in a zigzag. Sang Kancil of the folk tales.',
  '3 s. Three quick darts with the legs a blur, each followed by a freeze where not a pixel moves. The head snaps up after every freeze.',
  'Tiptoes out and freezes. The hind feet drum on alternate frames with tick marks, then a zigzag dash and a tiptoe home.',
  'Freeze, then the drum', ['leaf specks', 'ticks']),
 ('bornean-pygmy-elephant', 'Never gallops: one foot after another at every speed, about 2.3 s a stride at a walk. Flaps its ears to cool down.',
  '4.5 s, two slow heavy strides. The body sinks on each forefoot, the trunk swings like a pendulum a beat behind, one slow fan of the ear. Dust thumps up at each forefoot.',
  'Stops, lifts its trunk and curls the tip to sniff the air, scoops dust and throws it over its back, flaps its ears twice, walks home.',
  'The raised, sniffing trunk', ['dust']),
 ('gaur', 'The largest wild cattle, the shoulder ridge towering over the rump. Timid: a whistling snort, then it crashes off surprisingly fast. Bulls threaten side-on with the head held low.',
  'Calm, then bolt. A heavy walk, the head jerks up, two snort puffs, then a rocking-horse gallop across the rest of the screen in thick dust.',
  'Stands side-on and slowly lowers its head, horns low, the ridge towering. Holds, stamps twice with rings of dust, snorts, walks home.',
  'The lowered head', ['dust', 'snort']),
 ('sunda-clouded-leopard', 'Can climb down trunks head first and hang by its hind feet, its ankles turning back. Its very long tail is a balancing pole.',
  'Comes down a diagonal trunk line head first with careful steps, the tail raised and swinging against the head. Drops off at the bottom. Bark flakes fall.',
  'Walks a branch line like a tightrope, body tilting one way and tail the other. Flips to hang upside down by its hind feet and swats a falling leaf, then swings back up.',
  'The balancing tail', ['trunk line', 'bark', 'leaf']),
 ('asian-water-monitor', 'Seen from above: the spine bends in an S while diagonal legs step together. In water the legs fold flat and the tail drives, mostly from its base. The forked tongue flicks.',
  'Walks in an S, head steady on its path, tongue flicking. At a shoreline halfway across it folds its legs and swims on a travelling tail wave, leaving a V-shaped wake.',
  'Wanders, lifts its head and sweeps it side to side with three tongue flicks, then basks with its legs splayed flat before walking back.',
  'The tongue flick over the S', ['shoreline', 'wake']),
 ('smooth-coated-otter', 'A humped, bounding lope on land, two bounds a second. A strong swimmer driven by tail and hind legs. Stands up in the water to look around.',
  'Humped bounds: stretch, airborne, hump, land. In the last second it dives nose first into a band of water with a crown of splash.',
  'Swims with head and back above a waterline, stands up to scan, dives, climbs out and shakes off a fan of spray.',
  'The periscope', ['water', 'splash', 'spray']),
 ('saltwater-crocodile', 'Slides on its belly, or lifts into a high walk with the tail dragging; rarely gallops. Lies with its jaws open for long spells.',
  '5 s, low and slow. Belly-slides in lurches, rises into a high walk, and leaves a trackway: two rows of clawed prints and a wavy tail groove.',
  'High-walks out, opens its jaws slowly and holds them dead still for three seconds, then snaps shut in one frame. Belly-slides home.',
  'The long gape and the snap', ['trackway']),
 ('malayan-peacock-pheasant', 'A shy walker of the forest floor that slips away rather than flies. Displays by fanning its tail, body flattened low, eyespots turned to the watcher.',
  'Quick light steps, the head held still then thrust forward. Midway, a burst of display: it squashes low, the tail fans up with its eyespots, a hop, and it runs on.',
  'Scratches the litter, picks up a morsel, shakes it and drops it. Holds a low fan display while the eyespots glint, jumps, walks home.',
  'The low fan', ['leaf litter']),
 ('malayan-sun-bear', 'The smallest bear, pigeon-toed, often standing upright. Rips open logs for bees and termites with long claws, and has a 20 to 25 cm tongue.',
  'An upright waddle, rocking from foot to foot with the feet turned in, bees looping round its head.',
  'Waddles to a stump, sniffs nose-up, rakes it with alternate paws so chips fly, then slides the long tongue out and licks twice.',
  'The long tongue', ['bees', 'wood chips']),
 ('bornean-orangutan', 'Slow and deliberate, holding on with all four hands. Crosses gaps by swaying a trunk with growing swings. Holds a leaf to its lips for the kiss-squeak.',
  'Hand over hand along a liana at the top of the screen: swings from one hand, reaches, takes hold with the other (the drawing mirrors). Three handholds. Leaves shake loose and flutter down.',
  'Sways, the swings growing 3, 6, 10 and 14 degrees until it reaches across. Stops, holds a leaf to its lips, two kiss-squeak puffs, the leaf drops.',
  'The leaf kiss-squeak', ['liana', 'leaves']),
]
CANOPY = [
 ('white-handed-gibbon', 'Swings arm over arm: slow pendulum swings with a hand always holding, or fast swings with a flight between handholds. Pairs sing duets of quickening notes.',
  'Four swings along a vine: swing, let go, fly, catch with the other hand (the drawing mirrors). Each swing is faster. Leaves fall at every catch.',
  'Hangs and sings, the notes coming closer together. The song peaks in fast swinging, one big leap to another vine and back, then swings slowing to a stop.',
  'Letting go mid-swing', ['vine', 'leaves', 'song notes']),
 ('sunda-slow-loris', 'Never leaps. Slow and fluid, three limbs always holding. Freezes. In defence it raises its arms over its head to lick the venom gland on its elbow.',
  '5 s, the slowest pass. Creeps along its own branch stretched across the screen, one limb at a time, and freezes dead still halfway. A moth flutters ahead.',
  'The moth lands. The loris freezes for three seconds, then grabs in a single frame. Startled, it raises both arms over its head, holds, lowers them slowly and creeps home.',
  'Arms over the head', ['moth', 'branch']),
 ('binturong', 'Its prehensile tail is a fifth limb. Climbs slowly in a stiff, bear-like amble. A gland under the tail smells of popcorn.',
  'Inches along a branch: the tail tightens, two stiff steps, the tail slides forward and grips again. Little popcorn puffs rise along the drag line.',
  'Wraps its tail, swings down to hang head-down and grab a fig, swings back up, chews with slow nods, drags its tail home.',
  'Popcorn puffs from the tail', ['popcorn puffs', 'fig']),
 ('proboscis-monkey', 'Wades upright, swims well, and crosses rivers by leaping from branches and belly-flopping in. Males honk through the big nose.',
  'Crouches, leaps on a long arc across two-thirds of the screen, arms reaching, tail streaming, belly-flops onto a waterline in a big splash and dog-paddles away.',
  'Sits on its branch and honks three times, the nose bouncing out and up with sound arcs, the tail swaying slowly.',
  'The bouncing nose', ['splash', 'sound arcs']),
 ('rhinoceros-hornbill', 'Three heavy wingbeats and a glide, the beats famously loud. Glides with its wing tips curled up.',
  '4.5 s, the branch left behind. Three heavy downbeats, each with whoosh streaks, then a glide with up-curled tips: a slow, heavy wave of a path. Leaves shake loose.',
  'Lifts its bill to call twice, drops off the branch, flies a slow oval in the flap-flap-flap-glide rhythm, brakes with its wings up and lands with a bob.',
  'Whoosh, whoosh, whoosh, glide', ['whoosh streaks', 'leaves']),
 ('oriental-pied-hornbill', 'A few quick beats, then a rigid glide. Noisy flocks. Tosses its food in the air and catches it, because its tongue is too short.',
  '3.5 s, livelier: four quick beats and a glide with the tail fanned, two small flock-mates following, yap ticks at the bill.',
  'Peers down, flies a bouncy zigzag, comes back with a fruit, tosses it up and catches it. Gulp.',
  'The fruit toss', ['flock', 'fruit']),
 ('collared-kingfisher', 'Perches dead still, bobs its head to judge the distance, then drops onto crabs. Beats its catch against the branch.',
  '3 s. A steep dive in with wings folded, a splash, then it climbs out whirring with a crab in its bill.',
  'Frozen apart from three head bobs and a tail flick. Dives, grabs, returns, whacks the crab on the branch three times, calls kee-kee-kee.',
  'Whacking the crab', ['splash', 'ripples']),
 ('buffy-fish-owl', 'Hunts from a perch at the water\'s edge and swoops on fish without plunging. Its eyes are fixed, so it turns and bobs its whole head to judge depth.',
  'The owl stays put and you pass it: it slides across as if the camera pans, big leaves crossing in front faster. Its head tracks you in three jerky snaps, one slow blink, a sideways bob.',
  'Bobs its head, leans, launches, glides low over ripples, strikes feet first with a splash, climbs back with a fish and lands; the branch dips.',
  'The head that follows you', ['leaves', 'ripples', 'splash']),
 ('large-flying-fox', 'A 1.5 m wingspan on slow rowing beats. Streams out at dusk. Lands upright, then flips to hang head-down. Fans its wings to cool.',
  '5 s. Steady rowing with no glides, the wings narrowing on each upstroke. A far-off stream of tiny bats crosses behind it.',
  'Loops round, lands upright on a branch line, flips to hang head-down, fans its wings while two figs drop, then lets go and rows home.',
  'The landing flip', ['dusk stream', 'figs']),
 ('rajah-brookes-birdwing', 'Fast, bird-like flight with long glides. Spirals down in tight circles before settling, flutters nervously on landing, gathers at wet ground.',
  '3.5 s, head first: three wingbeats then a long flat glide on an S path. Dust motes curl into swirls behind each beat.',
  'Spirals down two and a half turns, shrinking as it goes, lands on a wet patch with rings, flutters nervously, settles flat, then bursts home.',
  'The spiral down', ['motes', 'rings']),
 ('sunda-colugo', 'Cannot flap. Glides 30 to 70 m (the record is 145 m), about 4 to 6 m forward for every metre down. Hitches up trunks in hops and lands head-up.',
  '4 s, the only animal that never flaps: one rigid glide down across the screen, the membrane edge fluttering, wind streaks along its path, leaves torn loose.',
  'Hops up a trunk line six times, spins, snaps the membrane open like a carpet, glides with one banked turn, flares and lands with a squash.',
  'The membrane snapping open', ['wind', 'leaves', 'trunk line']),
]
SEA = [
 ('green-sea-turtle', 'Flies under water: the front flippers beat together like wings while the back ones steer. A power stroke, then a long glide. Grazes seagrass and surfaces to breathe.',
  'Power stroke (the drawing surges), long glide, recovery. Current lines peel off the flipper tips on each stroke.',
  'Settles in a puff of sand and grazes, then strokes up to breathe, a ring spreading round its head, and glides home.',
  'The breath ring', ['current', 'sand', 'ring']),
 ('leatherback-turtle', 'The deepest-diving reptile, with huge front flippers. Starts each dive with strokes, then glides down steeply. Eats jellyfish.',
  'A steep diagonal dive: two big strokes, then a long glide, while light rays from the surface fade with depth.',
  'Glides down, levels off, strokes slowly back up. A jellyfish drifts in, and it is gone in one gulp.',
  'The jellyfish gulp', ['light rays', 'jellyfish']),
 ('whale-shark', 'The largest fish: a slow side-to-side tail. Glides down without beating and beats to climb. Feeds mouth open, and hangs upright to gulp.',
  '5 s, a gentle sawtooth: glides down with the tail still, climbs on slow beats. Plankton specks stream into its open mouth.',
  'Rises, tips head-up, and gulps as a plankton cloud funnels in, then glides home without a single beat.',
  'Upright gulping', ['plankton']),
 ('reef-manta-ray', 'Slow wing beats, about three seconds each. Unrolls its head fins to feed. Somersaults on the spot in plankton.',
  'Head first, stately flaps: from above, the wings fold toward the body and spread again. A long, gentle bank under rippling light lines.',
  'Glides into a plankton cloud, unrolls its head fins and somersaults three times, then glides home.',
  'The somersault', ['light lines', 'plankton']),
 ('blue-spotted-stingray', 'Waves ripple along both edges of its disc from head to tail. Digs pits in sand flats for food and hides under ledges, tail out.',
  'Skims low, both edges rippling, the tail trailing; sand lifts at each trough.',
  'Settles and flutters its front edge hard: sand erupts and leaves a pit. Twice. Then slides under a ledge with only its tail showing.',
  'Blowing a pit in the sand', ['sand', 'ledge']),
 ('dugong', 'An up-and-down fluke. Grazes seagrass just above the bottom, snout down, leaving feeding trails. Surfaces for only a few seconds.',
  'Low and level, head tilted down, slow fluke strokes, a plume of sand from the snout and a feeding trail behind.',
  'Grazes in little push-off hops on its flippers, angles up, and only the snout breaks the surface for a two-frame breath.',
  'The two-frame breath', ['sand', 'trail', 'surface']),
 ('irrawaddy-dolphin', 'A round head and slow fluke strokes, surfacing in quiet rolls. Famous for spitting jets of water to herd fish.',
  'Two gentle rolls through the surface along a wave, a small breath puff at each crest.',
  'Stands up in the water and spits an arc of droplets that scatters the fish specks. Again, then rolls home.',
  'The spit', ['surface', 'droplets']),
 ('humpback-whale', 'The longest flippers of any whale, about a third of its body, used to bank and turn. Bubble-net feeding.',
  'Slow and massive, banking on a climbing curve, the flippers sweeping like wings out of step with the fluke. Bubbles from the blowhole, light rays above.',
  'Circles at a smaller size, leaving a spiral of rising bubbles, lunges up through the ring with its throat swelling, and dives home flukes up.',
  'The bubble net', ['bubbles', 'light rays']),
 ('scalloped-hammerhead', 'A side-to-side tail. Rolls constantly, often swimming on its side. Sweeps its head to scan.',
  'A smooth shark glide, the head sweeping on its own rhythm out of step with the tail; sense arcs pulse from the hammer.',
  'Patrols an oval, rolls for a moment, drops low to scan the sand and noses down once in a puff.',
  'The scanning head', ['sense arcs', 'sand']),
 ('clownfish', 'Rows with its pectoral fins in a bobbing waddle and keeps the tail for bursts. Never strays far from its anemone.',
  '3 s, a nervous dash in spurts and hovers, the fins a flicker, tiny bubbles.',
  'Tentacles sway at home. It darts out twice, turns back, goes a bit further the third time, then dives into the anemone and wiggles in.',
  'The wiggle into the anemone', ['anemone', 'bubbles']),
 ('seahorse', 'Swims upright on a dorsal fin beating 30 to 42 times a second, one of the slowest fish. Anchors with its tail and catches prey with a head snap in about 5 ms.',
  'Too slow to cross a screen, so it rides a current: current lines sweep first and it drifts with them, leaning forward, rising and dropping in small steps, the fin flickering every frame.',
  'Uncurls from a seagrass stalk, rises, stops under a speck, freezes, snaps its head up in one frame. Gone. Curls back.',
  'The one-frame snap', ['current', 'seagrass']),
 ('day-octopus', 'Crawls over the reef on its arms and jets away mantle first, arms trailing. Hunts by spreading its arms and web over a coral head.',
  'Jets in pulses: the arms snap together as it shoots forward, then spread as it coasts. Water dashes from the siphon.',
  'Walks along the bottom on alternate arms, rises, spreads like an umbrella and drops over a rock, arm tips probing, then walks home.',
  'The umbrella pounce', ['water dashes', 'rock']),
 ('moon-jellyfish', 'Pulses its bell about once every two seconds and mostly drifts. Each pulse sheds a pair of spinning water rings.',
  'Rides a current sideways: the bell squeezes and it steps up, relaxes and sinks a little, tentacles a beat behind. Two curls spin off the rim each pulse.',
  'Drifts, turns by pulsing lopsided, rises to the top, stops and sinks with tentacles streaming up, then pulses home.',
  'The spinning rings', ['current', 'curls']),
 ('horseshoe-crab', 'Walks on legs hidden under its shell, so it seems to glide. If flipped, it levers itself back over with its tail spike.',
  'A level glide along the bottom with a faint leg jitter, leaving two rows of dots and a tail-drag line.',
  'A surge flips it on its back. Two failed pushes with the tail spike, then the third rolls it upright, and it glides home.',
  'Righting itself', ['trackway', 'sand']),
 ('cuttlefish', 'Hovers and creeps on the fin skirt round its mantle. Jets away and leaves an ink double of itself as a decoy. Shoots out two tentacles to catch prey.',
  'A dead-level glide with fine waves running round the skirt, then a jet: it leaps across in two frames, leaving a solid ink copy that slowly breaks into dots.',
  'Creeps up on a shrimp, raises its arms, holds, and two tentacles shoot out in one frame and back. Reverses home without turning round.',
  'The ink double', ['ink']),
 ('lionfish', 'Hovers slowly, often a little head-down. Corners prey with its fan fins and blows pulsed jets of water at it.',
  '5 s, a regal procession, tilted head-down, fans opening and closing, spine tips swaying behind.',
  'Drifts up to small fish, flares its fans, waves left then right, blows six puffs, lunges in one frame, glides home with fans folded.',
  'Puff, puff, puff, strike', ['water puffs', 'plankton']),
 ('pufferfish', 'Sculls slowly with small rear fins, tail folded; can hover and back up. Inflates by gulping water within seconds.',
  'Bumbles in smaller. Halfway a shadow passes and it blows up in visible gulps, four lurches to nearly double, spines out, and drifts on tumbling.',
  'Blows up and rises like a balloon, spits the water out (the jet pushes it backward), shrinks in three steps, sculls home.',
  'The gulping blow-up', ['shadow', 'water jet']),
 ('bumphead-parrotfish', 'Rows with its pectoral fins, bursts with its tail. Headbutts and grinds coral into sand; a school returns about 50 tonnes of sand to its reef a year.',
  'Steady, businesslike rowing, the hump leading. Every second and a half a cloud of sand puffs out behind and settles. It is making the beach.',
  'Rams a coral branch: rears back, rams, the screen jitters, a piece breaks off, it chews, and a big cloud of sand follows.',
  'The headbutt', ['sand', 'coral']),
 ('moray-eel', 'Waves run through its whole body from head to tail. Lives in crevices, opening and shutting its mouth all the time to breathe.',
  'A true travelling wave through the whole body, growing toward the tail, the jaw opening and closing; little swirls at each crest.',
  'Starts as a head in a dark crevice, breathing. Slides out, snakes an S, pokes into two holes, backs into its crevice tail first.',
  'Breathing in its den', ['crevice', 'swirls']),
 ('giant-grouper', 'A sluggish hoverer near caves that swallows prey by suction in an instant. Its relatives boom with their swim bladders.',
  '5 s, a heavy lumber, a frame forward then a frame held. Midway, a boom: low arcs radiate and the drawing shudders.',
  'Hovers at a cave mouth. A small fish passes; a one-frame gulp sucks it in with a lurch. One smug boom.',
  'The one-frame gulp', ['boom arcs', 'current']),
 ('chambered-nautilus', 'Jet-propelled, usually backwards, shell first, the shell rocking at each jet. Rises and sinks hundreds of metres every day.',
  'The only one that goes backwards: pulses shell first, tentacles drawing in and shell pitching at each jet, then trailing as it coasts.',
  'Rises up the screen in slow rocking pulses, drifts, and sinks back down.',
  'Rock and recoil', ['water spurts']),
 ('mudskipper', 'Crutches over mud on stiff pectoral fins and skips with a flick of the tail. Territorial males raise the dorsal fin and leap.',
  'Crutch-steps along the mud, then a tail-flick skip high into the air, a splat of mud on landing, more steps.',
  'Crutches out, flags its dorsal fin, gapes, leaps straight up three times with splats, flicks mud and crutches home.',
  'Flag and leap', ['mud splats', 'prints']),
 ('fiddler-crab', 'Walks sideways. Males wave the giant claw, faster when rivals are near. Feeds with the small claw, leaving sand pellets, and bolts into its burrow at any threat.',
  '3 s, a quick sideways scuttle with one claw wave on the way; sand pellets drop behind.',
  'Scoops food three times, waves four times faster and faster, a shadow passes, it drops into its burrow, eyestalks peek, comes back out.',
  'The quickening wave', ['pellets', 'burrow', 'shadow']),
 ('barracuda', 'Hovers motionless, then ambushes in explosive bursts.',
  '3 s. Drifts in slowly, fins flickering, freezes for a full second, then strikes across the rest of the screen in three frames.',
  'Hovers dead still, slowly turns to track a small fish, shadows it, strikes in one frame, drifts back to its post.',
  'Freeze, then strike', ['speed streaks']),
 ('sea-star', 'Glides on hundreds of tube feet, very slowly, and can switch to a faster bouncing gait. Has no front: any arm can lead.',
  'A time-lapse crossing in the bouncing gait, the leading arm tip lifted, a trail of tiny foot prints.',
  'Crawls with one arm tip raised to look, changes direction without turning by leading with another arm, humps over a clam, crawls home.',
  'A new direction with no turn', ['prints', 'clam']),
]

TITANE_BEATS = [
 ('Guarding', 'Cruises in low and level, the body rigid, only the dorsal and anal fins rippling. It noses down and blows the sand.'),
 ('It sees you', 'Stops dead. The first dorsal spine snaps up in one frame, and a dotted cone draws itself from its nest to the top of the screen. You are inside it.'),
 ('Wind-up', 'It backs off a little and cocks its tail.'),
 ('Charge', 'Five jumps in size, from life size to bigger than the screen, the tail beating every frame, the mouth opening, speed lines streaking out from the middle.'),
 ('Impact', 'The screen goes to ink for one frame, then the negative of TITANE for one more.'),
 ('TITANE!', 'The word stamps across the screen, the screen shakes, ink splashes in from the edges.'),
 ('Gone', 'TITANE darts off sideways and the word breaks up into halftone dots.'),
]

CSS = """
:root{
  /* Layout: a long sheet of paper, one study per animal, each a drawing beside three short notes. */
  --paper:#E6E5DF; --sheet:#EDECE6; --ink:#1C1C1A; --muted:#4A4A46; --faded:#77766F; --rule:#C9C8C0;
  --display:'Literata',Georgia,'Times New Roman',serif;
  --body:'Atkinson Hyperlegible',system-ui,-apple-system,'Segoe UI',sans-serif;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#121211;--sheet:#1A1A18;--ink:#CFCEC8;--muted:#A3A29C;--faded:#7A7973;--rule:#34332F;color-scheme:dark}}
:root[data-theme="dark"]{--paper:#121211;--sheet:#1A1A18;--ink:#CFCEC8;--muted:#A3A29C;--faded:#7A7973;--rule:#34332F;color-scheme:dark}
body{background:var(--paper);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.55}
.wrap{max-width:1180px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:40px 80px}
h1,h2,h3{font-family:var(--display);font-weight:600;text-wrap:balance;margin:0}
h1{font-size:clamp(40px,7vw,76px);line-height:1;letter-spacing:-0.02em}
h2{font-size:clamp(26px,3.4vw,36px);line-height:1.1}
h3{font-size:21px;line-height:1.2}
p{margin:0}
.lede{max-width:66ch;font-size:18px;color:var(--muted);margin-top:18px}
.label{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.rules{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px 32px;margin-top:36px;padding-block:22px;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule)}
.rules p{font-size:15px;color:var(--muted)}
.rules b{display:block;color:var(--ink);font-size:16px;margin-bottom:2px}
nav{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:28px}
nav a{color:var(--ink);font-weight:700;text-decoration:none;border-bottom:2px solid var(--ink);padding-bottom:2px}
nav a:focus-visible,nav a:hover{background:var(--ink);color:var(--paper);outline:none}
section{margin-top:72px}
.sechead{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:8px 24px;border-bottom:2px solid var(--ink);padding-bottom:10px}
.sechead p{color:var(--muted);max-width:60ch}
.titane{margin-top:44px;display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px 44px;background:var(--ink);color:var(--paper);padding:32px max(20px,3vw)}
.titane .label{color:var(--paper);opacity:.75}
.titane h2{font-size:clamp(56px,10vw,120px);letter-spacing:-0.03em;line-height:.9;transform:rotate(-4deg);transform-origin:left bottom;margin-block:14px 18px}
.titane .art{background:var(--paper);padding:18px;align-self:start}
.titane p{max-width:62ch}
.beats{list-style:none;padding:0;margin:20px 0 0;display:grid;gap:12px;counter-reset:b}
.beats li{display:grid;grid-template-columns:2.2em minmax(0,1fr);gap:4px 10px;counter-increment:b}
.beats li::before{content:counter(b);font-family:var(--display);font-size:22px;line-height:1.2}
.beats b{display:block}
.titane .more{margin-top:20px;padding-top:16px;border-top:1px solid color-mix(in srgb,var(--paper) 35%,transparent)}
.decide{margin-top:44px;border:2px solid var(--ink);padding:24px max(20px,2.4vw)}
.decide ol{margin:14px 0 0;padding-left:1.3em;display:grid;gap:14px;max-width:80ch}
.decide li b{display:block}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,520px),1fr));gap:0 44px}
.animal{display:grid;grid-template-columns:150px minmax(0,1fr);gap:4px 22px;padding-block:28px;border-bottom:1px solid var(--rule)}
.animal .art{grid-row:span 2;align-self:start;background:var(--sheet);padding:10px}
.animal svg{display:block;width:100%;height:auto}
.animal .name{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 10px}
.animal .latin{font-style:italic;color:var(--faded);font-size:14px}
.sig{font-family:var(--display);font-style:italic;font-size:17px;margin-top:2px}
dl{margin:10px 0 0;display:grid;gap:10px}
dt{font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
dd{margin:2px 0 0;font-size:15px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.chips span{font-size:13px;border:1px solid var(--muted);padding:1px 8px;color:var(--muted)}
.theatre{margin-top:44px;display:grid;gap:14px}
.screen{position:relative;width:100%;aspect-ratio:16/9;max-width:100%;background:var(--paper);border:2px solid var(--ink);overflow:hidden}
.screen.night{--paper:#121211;--ink:#CFCEC8;--muted:#A3A29C}
.screen canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
.mock{position:absolute;inset:0;color:var(--ink);font-family:var(--body);pointer-events:none}
.mock .list{position:absolute;left:11.25%;top:50%;transform:translateY(-50%);display:grid;gap:.25cqw;font-size:2.19cqw;line-height:1.25}
.mock .list span{padding:.6cqw 1.25cqw;justify-self:start}
.mock .list .on{background:var(--ink);color:var(--paper)}
.mock .list .gap{height:2.9cqw}
.mock .clock{position:absolute;right:12.5%;bottom:11.1%;text-align:right;font-size:9.4cqw;line-height:1;letter-spacing:-.02em}
.mock .clock small{display:block;font-size:1.77cqw;letter-spacing:0;margin-top:.5cqw}
.mock .caption{position:absolute;left:12.5%;bottom:11.1%;font-size:1.35cqw;color:var(--muted)}
.screen{container-type:inline-size}
.controls{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center}
.controls select,.controls button{font:inherit;font-size:15px;color:var(--ink);background:var(--paper);border:2px solid var(--ink);padding:6px 12px;border-radius:0}
.controls button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}
.controls button:focus-visible,.controls select:focus-visible,.playbtn:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
.controls .now{color:var(--muted);font-size:15px;min-width:0}
.playrow{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.playbtn{font:inherit;font-size:13px;font-weight:700;color:var(--ink);background:none;border:1.5px solid var(--ink);padding:3px 10px;cursor:pointer}
.playbtn:hover{background:var(--ink);color:var(--paper)}
.foot{margin-top:72px;color:var(--muted);max-width:70ch;font-size:15px}
@media (max-width:620px){.animal{grid-template-columns:96px minmax(0,1fr)}.titane{grid-template-columns:minmax(0,1fr)}}
@media (prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
"""


def svg(a, uid):
    w, h = [float(v) for v in a['viewBox'].split()[2:]]
    sp = w * 0.012
    out = [f'<svg viewBox="0 0 {w:g} {h:g}" role="img" aria-label="{html.escape(a["name"])}">',
           f'<defs><pattern id="d{uid}" width="{sp:.2f}" height="{sp:.2f}" patternUnits="userSpaceOnUse">'
           f'<circle cx="{sp/2:.2f}" cy="{sp/2:.2f}" r="{sp*0.34:.2f}" fill="var(--ink)"/></pattern></defs>']
    for L in a['layers']:
        f = L.get('fill', 'none')
        fill = {'dots': f'url(#d{uid})', 'ink': 'var(--ink)', 'paper': 'var(--sheet)'}.get(f, 'none')
        stroke = f' stroke="var(--ink)" stroke-width="{L.get("width", 2.5)}" stroke-linecap="round" stroke-linejoin="round"' if L.get('stroke') else ''
        under = f'<path d="{L["d"]}" fill="var(--sheet)"/>' if f == 'dots' else ''
        out.append(f'{under}<path d="{L["d"]}" fill="{fill}"{stroke}/>')
    out.append('</svg>')
    return ''.join(out)


def card(row, uid):
    id_, moves, pas, saver, sig, fx = row
    a = animals[id_]
    return f'''<article class="animal" id="{id_}">
<div class="art">{svg(a, uid)}</div>
<div><div class="name"><h3>{html.escape(a["name"])}</h3><span class="latin">{html.escape(a["latin"])}</span></div>
<p class="sig">{html.escape(sig)}</p></div>
<div><dl><div><dt>How it really moves</dt><dd>{html.escape(moves)}</dd></div>
<div><dt>Passing Home</dt><dd>{html.escape(pas)}</dd></div>
<div><dt>On the screensaver</dt><dd>{html.escape(saver)}</dd></div></dl>
<div class="chips">{''.join(f"<span>{html.escape(x)}</span>" for x in fx)}</div>
<div class="playrow"><button class="playbtn" data-id="{id_}" data-mode="pass">Play Home pass</button><button class="playbtn" data-id="{id_}" data-mode="outing">Play screensaver outing</button></div></div>
</article>'''


uid = 0
def section(sid, title, note, rows):
    global uid
    cards = []
    for r in rows:
        uid += 1
        cards.append(card(r, uid))
    return f'<section id="{sid}"><div class="sechead"><h2>{title}</h2><p>{note}</p></div><div class="grid">{"".join(cards)}</div></section>'

assert len(LAND) + len(CANOPY) + len(SEA) + 1 == 50, len(LAND) + len(CANOPY) + len(SEA) + 1
seen = {r[0] for r in LAND + CANOPY + SEA} | {'titan-triggerfish'}
assert seen == set(animals), set(animals) - seen

beats = ''.join(f'<li><span><b>{html.escape(t)}</b>{html.escape(d)}</span></li>' for t, d in TITANE_BEATS)
page = f'''<title>Ink Menagerie</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,600;1,7..72,400&display=swap">
<style>{CSS}</style>
<div class="wrap">
<p class="label">Motion study · 50 animals · for the TV Home and the screensaver</p>
<h1>Ink Menagerie</h1>
<p class="lede">How each animal really moves, and what it does on the TV. Every design starts from a real behaviour, checked against field studies and natural history sources, and no two animals move the same way. Play any of them in the theatre below.</p>
<div class="rules">
<p><b>Smooth ink</b>The look stays e-ink (paper, ink, halftone dots) while the motion is smooth and full of life: tails, fins, ears and breath never stop.</p>
<p><b>Passing Home</b>Every 30 seconds an animal crosses the whole screen, edge to edge, in 3 to 5 seconds, and every fifth one is TITANE. Pressing buttons never stops it.</p>
<p><b>On the screensaver</b>A new animal every minute. It holds still for 20 seconds, goes out for about 9 seconds and comes back to its place.</p>
<p><b>Weather and water</b>Dust, sand, bubbles, wind, ripples and splashes are drawn in the same ink, as dots and short lines, only while the animal moves.</p>
</div>
<nav aria-label="Sections"><a href="#theatre">Theatre</a><a href="#titane">TITANE</a><a href="#decide">What you chose</a><a href="#land">Forest floor</a><a href="#canopy">Canopy and air</a><a href="#sea">Reef and open sea</a></nav>

<section class="theatre" id="theatre" aria-label="Theatre">
<div class="sechead"><h2>Theatre</h2><p>The animals as the TV plays them: smooth, from the same code the TV's moves are baked from. Pick one, or let them come by in turn.</p></div>
<div class="screen" id="screen"><div class="mock" id="mock"></div><canvas id="stage"></canvas></div>
<div class="controls">
<select id="pick" aria-label="Animal"></select>
<button id="m-pass" aria-pressed="true">Home pass</button><button id="m-outing" aria-pressed="false">Screensaver outing</button>
<button id="dir" aria-pressed="false">Right to left</button><button id="night" aria-pressed="false">Night ink</button>
<button id="auto" aria-pressed="true">Play all in turn</button>
<span class="now" id="now"></span>
</div>
</section>

<div class="titane" id="titane">
<div><p class="label">Titan triggerfish · Balistoides viridescens</p>
<h2>TITANE!</h2>
<p>The real titan swims on its rear dorsal and anal fins, which ripple as matching waves while the body stays rigid; the tail only kicks in for bursts. It guards a cone of water that rises from its sand nest to the surface, and charges and bites anything inside it, which is why divers are told to swim away sideways, never up. It blows jets of water at the sand to uncover prey, and sleeps wedged in a crevice with its first dorsal spine locked upright by the second, the trigger.</p>
<ol class="beats">{beats}</ol>
<p class="more"><b>On the screensaver</b> (about 10 s): it paces its cone over the sand nest, blows the sand and snaps up a crab, chases a small fish out of the cone with a warning charge, then turns on you for the full TITANE! charge. It ends wedged back at home with the spine clicking down.</p></div>
<div class="art">{svg(animals["titan-triggerfish"], 0)}</div>
</div>

<div class="decide" id="decide"><h2>What you chose</h2>
<ol>
<li><b>TITANE on Home: 5 seconds, one charge.</b>It keeps the 3 to 5 second rule for passes; the screensaver has the long version, with the cone patrol and the chase.</li>
<li><b>Small props in ink: yes.</b>A waterline for the tapir, otter and proboscis monkey, a vine for the gibbon and orangutan, a trunk for the clouded leopard and colugo, a crevice for the moray, an anemone for the clownfish. They draw themselves in and are gone when the animal has passed.</li>
<li><b>Birds leave their branch: yes.</b>The hornbills, kingfisher and owl take off and the branch stays behind. The hornbills and kingfisher flap their folded wing over the shoulder; the owl opens drawn ink wings.</li>
</ol></div>

{section("land", "Forest floor", "Walkers, from the tapir's nose-down plod to the mouse-deer's darts.", LAND)}
{section("canopy", "Canopy and air", "Climbers that never let go, and fliers that flap, glide or never flap at all.", CANOPY)}
{section("sea", "Reef and open sea", "Twenty-five ways to move through water, from the moray's full-body wave to the nautilus going backwards.", SEA)}
{{SCRIPTS}}
<p class="foot">Sources include Korsmeyer et al. 2002 on triggerfish gaits, Fossette et al. 2010 on leatherback dives, Neil and Askew 2018 on nautilus jets, Royer et al. 2020 on hammerhead rolling, Thorpe et al. 2007 on orangutan tree-sway, Hutchinson et al. 2006 on elephant gaits, and field guides from BirdLife, Animal Diversity Web, the Smithsonian and regional zoos. Where a figure comes from a related species, the design uses it only as a rhythm, not as a claim about this animal.</p>
</div>'''
import glob, os
D = os.path.dirname(os.path.abspath(__file__))
js = lambda f: open(os.path.join(D, f)).read().replace('</script', '<\\/script')
files = ['engine.js', 'motions/lib.js'] + sorted(os.path.relpath(f, D) for f in glob.glob(os.path.join(D, 'motions', '*.js')) if not f.endswith('lib.js'))
data = json.dumps([{'id': a['id'], 'name': a['name'], 'latin': a['latin'], 'group': a['group'],
                    'vb': [float(v) for v in a['viewBox'].split()[2:]],
                    'L': [[l['fill'], 1 if l['stroke'] else 0, l.get('width', 2.5), l['d']] for l in a['layers']]}
                   for a in animals.values()], separators=(',', ':'))
scripts = ''.join(f'<script>{js(f)}</script>' for f in files) + f'<script>Ink.loadAnimals({data});</script><script>{js("theatre.js")}</script>'
page = page.replace('{SCRIPTS}', scripts)
open(OUT, 'w').write(page)
print(len(page))
