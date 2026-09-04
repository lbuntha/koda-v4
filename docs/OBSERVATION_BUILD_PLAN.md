# Observation — development specification

**Skill id:** `observation` · **Ages:** 5–9 · **Category:** `spatial-reasoning` ·
**10 teaching levels + 1 mixed practice level · 1 game engine.**

This is the source-of-truth specification for v1. It follows
`docs/NEW_SKILL_PROMPT.md`, `docs/SKILL_DEVELOPMENT.md`, and the public shape of
`src/skills/counting/`. A review-friendly version lives at `docs/observation-spec.html`.

The supplied beach “Find Hidden Objects” image is the interaction reference: a busy scene,
object targets along the bottom, and a visible completed state when an object is found. The
image itself is not assumed to be licensed and will not be copied.

## 1. Product outcome

A child checks the objects in a target tray and taps each matching object in an illustrated
scene, in any order. Completing the scene advances the child to the next level.

```text
clear scenes → more objects → similar decoys → rotation/size → partial hiding → busy challenge
```

V1 deliberately contains one interaction and one engine. Visual memory,
spot-the-difference, spatial riddles, camera input, eye tracking, and live AI scenes are not
part of this build.

Observation is a game skill, not a diagnostic tool. It never labels a child's attention,
vision, memory, or medical condition.

### 1.1 Product benchmark

The benchmark is about interaction quality and content structure, not copying another
game's art, names, scenes, economy, or progression.

| Product | Officially documented strength | Adopt for Observation | Do not copy |
|---|---|---|---|
| [Hidden Folks](https://hiddenfolks.com/press/hidden-folks-1) | Hand-drawn miniature areas, a target strip, target-tap hints, playful scene interactions, 32 areas and 300+ targets; deliberately no timers or points | Distinctive authored worlds, persistent target tray, tap-a-target hints, low-pressure teaching | Monochrome visual identity, mouth-made audio identity, characters, scenes, or its environmental interaction puzzles |
| [Hidden Through Time 2: Discovery](https://store.steampowered.com/app/1094680/Hidden_Through_Time_2_Discovery/) | Colourful hand-drawn eras, cryptic hints, relaxing no-timer play, and a reusable map/editor asset system | Strongly themed scene packs, modular object catalog, clue quality, visual storytelling | Historical eras, community editor, online sharing, or cryptic text that is too difficult for ages 5–9 |
| [Highlights Hidden Pictures Digital Play](https://international.highlights.com/products/hidden-pictures-digital-play) | Ages 6+, intuitive independent play, 125+ puzzles, three puzzle types, safe/ad-free presentation | Self-explanatory child UX, broad object vocabulary, safe and ad-free design, content variety | Its trademark presentation, drawings, object placements, puzzle types, or subscription structure |
| [June's Journey](https://wooga.helpshift.com/hc/en/27-june-s-journey/faq/2103-what-is-a-hidden-object-scene/) | Bottom item list, tap-to-clear loop, hints, accuracy/speed scoring, stars and scene progression | Clear target list, immediate confirmation, familiar scene mastery, shared Koda stars | Adult story, punitive time pressure, disappearing evidence, energy/economy systems, or wrong-tap point loss |

The resulting Koda position is: **richer and more colourful than a worksheet, calmer than a
speed-scored mobile hidden-object game, and simpler than an interactive adventure.**

### 1.2 Content scale for v1

V1 contains **130 original targetable object assets**, organized around **13
recognizable places**, plus **28 authored scenes**. Each scene follows the
attached reference's composition: one lively location with people, furniture, plants,
architecture, and small story moments, with target objects naturally embedded throughout.
This is large enough for varied rounds without claiming the hundreds of scenes or targets of
mature catalogs.

Each object appears as a valid target in at least two authored scenes. A scene can also use
non-targetable backdrop details, but those details must never look like an exact copy of a
target.

### 1.3 Game-first presentation, skill-first design

The child should experience a real hidden-object game. “Observation skill” describes the
learning model, progression, and evidence—not a worksheet-like visual treatment.

- Each level unlocks a new named place with an illustrated arrival panel, two authored
  scenes, a distinct palette, and its own ambient visual details.
- Use edge-to-edge scene art inside the play area, cinematic scene-to-scene transitions,
  passive character/environment motion, tactile object finds, and a satisfying completed
  scene state.
- The existing Koda lesson path acts as the world/progression map. Do not build a second
  competing map or progression store inside the skill.
- The shared stars, XP, lesson completion, and next-step flow remain the reward economy.
  Do not add coins, energy, lives, loot boxes, ads, timers, or an item shop.
- A level may show a small place stamp or postcard on completion as presentation only; it
  must not create a second persistence system.
- Passive animations may make the place feel alive, but non-target objects are not tappable
  toys in v1: a scene tap must remain unambiguous for answer scoring.
- Teaching language stays short and diegetic: “Welcome to the City Park—find what Koda
  spotted,” followed by the target tray. Strategy detail lives behind Hint.

The learning layer remains rigorous: difficulty dimensions are controlled, hints report
support, wrong taps are attempts, practice measures comparable pace, and no result is used
as a diagnosis.

## 2. Core game loop

1. Show a short instruction and 1–5 object cards in the target tray.
2. The child searches and taps matching objects in any order.
3. A correct tap flies the scene object into its target, restores it to full opacity, and plays either
   one short partial-match pop or one recorded final reaction.
4. A wrong tap gives a gentle error sound and shows “Not a match. Try again.” without
   exposing the answer.
5. An already-found object says “Already found” without replaying congratulations or
   creating another answer event.
6. Finding every target completes the scene; shared Koda chrome advances the round.

### Scoring contract

One complete scene is one scored question.

- A wrong scene tap calls `round.submit({ correct: false, ... })`, preserves found state,
  and keeps the same question.
- Correct subtarget taps update local found state only.
- The final target calls the one correct submission and advances.
- `expected` is the stable sorted target-id list; `given` is the tapped object id or
  normalized empty-scene region.
- Teaching rounds contain 4–5 scenes.
- Practice contains 10 one-target scenes, making the existing pace metric comparable.

The tray never makes one target artificially active.

### Swarm rounds

`swarm` mode hides **one character many times** in a single scene — the "find all
the frogs" shape of the genre. It runs on the same engine and the same scoring
contract; only the target model and the tray change.

- A swarm scene names its repeated character in `scene.swarmObjectId`, and every
  copy carries its own `instanceId`. Scene uniqueness is checked per placement,
  not per catalog entry, so one catalog object can legitimately appear fourteen
  times.
- `keyOf(object)` returns `instanceId ?? id`. Scenes authored before swarm mode
  carry no `instanceId`, so their catalog ids stay the key and every existing
  scene, saved round, and answer string keeps working untouched.
- Each copy is a separate target. `expected` is still a sorted key list, wrong
  taps are still attempts, and the final copy is still the one scored
  submission — the round contract does not special-case swarm.
- The tray shows **one card with a live count** ("Frogs 7 / 12") rather than
  twelve identical previews, and every correct find flies to that one card.
- `swarmCount` chooses how many copies are live; the rest of the scene's copies
  sit out that question, so the count is honest and the layout is not
  memorisable across a round.
- The List view numbers the copies ("frog 3", "frog 7") so a screen-reader user
  can tell them apart and still complete the round.

A swarm scene has to be authored *for* its character, or the round is trivial. Fourteen
identical bright stamps on flat stone read as stickers, not as something hidden, so the Frog
Moat carries:

- **cover of the target's own colour** — ivy up the towers, lily pads in the moat, and grass
  tufts, every element drawn at roughly the size a placed frog renders at, so a green shape
  is never automatically the answer;
- **frog-shaped scenery that is not tappable** — a squat body with two eye-bumps, close
  enough to demand a second look but never a copy of the target art; and
- **per-copy variation** — each frog is turned, resized, and sometimes half-tucked, so the
  child checks a shape instead of sweeping for one repeated blob. Distractors vary the same
  way, for the reason in the risk list.

Not every copy should be well hidden. A few in open sky stay easy on purpose: a round where
all twelve are maximally camouflaged is one a five-year-old abandons.

### The five advanced modes

Levels 12–16 each ask for something the earlier ladder never does. All five run on the same
engine and the same scoring contract; what changes is what the child has to look at.

| Mode | The new demand | How it is built |
|---|---|---|
| `overlap` | pull one contour out of another | art is drawn ~3.4× its hit box so shapes cross, while the boxes stay apart — the picture is tangled, the scoring never is |
| `mirror` | tell an object from its reflection | about half the scene is flipped, targets included; **only objects flagged `mirrorSafe` are eligible**, because flipping a frog or a crown changes nothing a child could see |
| `camouflage` | search by shape when colour is no help | saturation is drained and the objects blend with `luminosity`, so the backdrop's own hue shows through |
| `shadow` | match a filled outline | `brightness(0)` flattens every object to its silhouette against a lit dusk scene |
| `category` | recognise, then judge membership | no preview art at all — the tray names a group and counts. **Every scene member of that group is a target, and any capped leftovers are removed from the scene**, or a child tapping a genuine "thing you can eat" would be told it was wrong |

`category` is the reason the catalog finally carries semantic data: every other level matches
artwork, so nothing until now needed to know that a banana and a cupcake are both food.

Swarm is deliberately excluded from the `mixed` challenge cycle: mixing a
counting task into a five-target recognition round would change what the final
challenge measures.

## 3. Level progression

All lessons configure the same `ObjectHunt` engine through JSON. The engine never branches
on `params.level`.

| L | Lesson id | Child-facing title | Place unlocked | Configuration |
|---:|---|---|---|---|
| 1 | `find-one-object` | Find One Object | Beach Promenade | 1 target, 6 objects, clear spacing, exact preview |
| 2 | `find-two-objects` | Find Two Objects | City Park | 2 targets, 8 objects, clear spacing |
| 3 | `find-three-objects` | Find Three Objects | Family Home | 3 targets, 10 objects, light clutter |
| 4 | `search-by-shape` | Look at the Shape | Market Street | 3 targets, silhouette previews, 10 objects |
| 5 | `ignore-lookalikes` | Ignore the Look-Alikes | All four current places | 3 targets, 10 objects, one-feature decoys |
| 6 | `find-turned-objects` | Find the Turned Objects | Farm Village and Forest Camp | 3 targets, 10 objects, rotations ±45°–180° |
| 7 | `find-different-sizes` | Same Object, New Size | School Campus | 4 targets, 10 objects, scale 0.72–1.2× scene variation |
| 8 | `find-peeking-objects` | Find What Is Peeking Out | Harbor & Aquarium | 4 targets, 10 interactive objects, targets 72% visible |
| 9 | `search-a-busy-scene` | Search the Busy Scene | Science Museum | 5 targets, 10 interactive objects plus dense visual decoys |
| 10 | `search-the-castle` | Search the Castle | Castle Kingdom | 4 targets, 10 objects, dense visual decoys |
| 11 | `find-all-the-frogs` | Find All the Frogs | Castle Kingdom | one repeated character hidden 12 times, 18 objects |
| 12 | `untangle-the-pile` | Untangle the Pile | Inventor's Workshop | 3 targets, art drawn past its hit box so shapes cross |
| 13 | `same-or-mirrored` | Same or Mirrored? | Castle Hall of Mirrors | 3 targets, half the scene flipped, asymmetric objects only |
| 14 | `hiding-in-the-pattern` | Hiding in the Pattern | Coral Reef | 3 targets, colour drained so only contour is left |
| 15 | `follow-the-shadow` | Follow the Shadow | Town Lantern Night | 3 targets rendered as silhouettes |
| 16 | `find-what-belongs` | Find What Belongs | Market, Home, School | every member of a named category, no preview art |
| 17 | `hidden-object-challenge` | Hidden Object Challenge | Town, Harbor, and Museum | 5 targets, nine-mode cycle, dense visual decoys |
| 18 | `practice-object-hunt` | Practice: Object Hunt | All Places | 10 one-target scenes cycling ten modes, no hints/opening speech |

### Learning records

| Levels | conceptKey | Meaning |
|---|---|---|
| 1 | `visual-matcher` | Match one object preview to the same scene object |
| 2 | `visual-scanner` | Sweep a whole scene for more than one target |
| 3 | `selective-attender` | Hold three targets in mind while ignoring clutter |
| 4 | `shape-feature-searcher` | Search by contour without depending on colour |
| 5 | `feature-conjunction-searcher` | Combine features and ignore partial matches |
| 6 | `rotation-invariant-matcher` | Recognize the same object after rotation |
| 7 | `scale-invariant-matcher` | Recognize the same object at a different size |
| 8 | `partial-object-completer` | Recognize an object from a sufficiently visible part |
| 9 | `figure-ground-searcher` | Separate targets from a busy background |
| 10 | `themed-scene-searcher` | Carry a learned search into an unfamiliar place |
| 11 | `exhaustive-searcher` | Cover a whole scene systematically and keep count |
| 12 | `figure-separator` | Pull one contour out of another where shapes cross |
| 13 | `mirror-discriminator` | Tell an object from its reflection — the b/d rule |
| 14 | `camouflage-breaker` | Search by shape when colour is no help |
| 15 | `shadow-matcher` | Match a filled outline with no inner detail |
| 16 | `category-searcher` | Recognise objects and judge membership, with no template |
| 17–18 | `independent-visual-searcher` | Apply taught search skills without scaffolding |

`manifest.requires` is `[]`; Level 1 is independent. Lesson `requires` follows the sequence.
Do not reuse mathematical keys such as `counter` or `comparer`.

All `standards` arrays are `[]`: the game does not directly assess a Common Core mathematics
standard. Each lesson uses its concept key as a non-empty `trajectoryLevel`.

## 4. Game screen

```text
┌──────────────────────────────────────┐
│ shared Koda round header             │
├──────────────────────────────────────┤
│ “Find all 3 objects”      Hint       │
│                                      │
│          illustrated scene           │
│       tap objects in any order        │
│                                      │
├──────────────────────────────────────┤
│ target 1   target 2   target 3       │
│  100%       85%        85%           │
└──────────────────────────────────────┘
```

- Use `SkillRound`; the skill creates no top bar, scoring, praise, or completion modal.
- The scene is the one meaningful frame; avoid decorative nested cards.
- The target tray stays below the scene and fits five cards at 360×640.
- Dense art may offer two-tap quadrant zoom and Back. Pinch and drag are never required.
- Target cards have no selection border, ring, eye icon, or checkmark. Unfound previews use
  85% opacity; found previews return to 100% opacity.
- On desktop the activity is capped at 760px wide so the scene and hidden objects remain
  compact. The percentage-based scene layout still fills narrow mobile screens.
- Every effective target area is at least **44 CSS pixels wide** at a 360px viewport
  (14% of the scene box). Height reaches 38px, not 44: the scene is authored 4:3, so at
  360px it is only ~237px tall and a 16%-tall hit box cannot reach 44 without overlapping
  its neighbours. Closing the remaining 6px needs a taller scene on narrow screens, which
  means re-authoring the 1000×750 backdrops — deliberately out of scope for v1.
- Wrong taps use a neutral ripple; hints use a broad search region, never the exact hit box.

### Feedback and sound ownership

| Event | Visual message | Sound and haptic | Submission |
|---|---|---|---|
| Correct subtarget | matching object flies into its target; the scene and tray copies rise from 85% to 100% opacity | one short `koda.sound.play("pop")` and tap haptic | local progress only |
| Final target | “Congratulations! You found them all.” | stop unfinished speech, success chime and haptic, then one delayed recorded correct reaction through `round.submit` | one correct `round.submit` |
| Wrong target or empty scene | “Not a match. Try again.” + neutral ripple | stop unfinished speech, error chime and light haptic, then one delayed recorded incorrect reaction through `round.submit` | incorrect `round.submit`; scene remains |
| Already found | “You already found the {object}.” | no new celebration; optional soft neutral tap | none |

Audible feedback is sequenced rather than layered. A partial match owns one short pop through
`koda.sound.play`. A terminal correct answer plays the success chime and waits 560 ms before
the shared `playAnswerSound` path starts its recorded reaction. A wrong answer plays the error
chime and waits 240 ms before its recorded reaction. The activity stops unfinished browser
speech before either sequence.
It never imports or calls `playAnswerSound`,
`playReaction`, `new Audio()`, or browser speech itself. Spoken prompts use
`koda.speech.say()` only when `audio_speech` is enabled. Chimes require both the global sound
preference and `sound_chimes`; haptics require `haptic_feedback`.

Messages are displayed in the shared feedback area and announced through one polite live
region. A fast series of correct taps stops/replaces the previous object-name speech rather
than stacking several spoken congratulations.

Each five-question level uses one shuffled target deck. Consecutive targets are dealt from
that deck, so an object cannot repeat until every object in the current scene pool has been
considered. If a round needs more target slots than the scene owns, the deck cycles only
after exhaustion. Distractor order is independently shuffled for every question. Each
question also moves its objects between authored, collision-safe slots within the same scene
region. This changes target locations without pushing an object outside the scene or placing
it in an implausible region such as moving a sand object into the sky.

`internal/placement.ts` owns all of that in one function, `placeObjects`, because the rules
interlock and splitting them is what let an earlier version silently freeze:

- **Real randomness.** The seed hash avalanches (murmur3 finalizer) before use. Plain FNV-1a
  has a parity low bit, so `% 2` on two near-identical seed strings moved in lockstep — a
  direction and a distance drawn that way cancelled out to a constant shift, and no object
  ever changed position.
- **Derangement, not rotation.** Each region's slot ring is fully permuted and any fixed
  point is swapped out, so an object never sits out a question on its old spot, and the
  relative arrangement changes rather than merely rotating.
- **Band-constrained swaps.** Regions are quadrants and a quadrant can span sky and sand, so
  slots are further grouped by vertical band. A kite stays airborne and a bucket stays on the
  ground without per-object surface metadata the generated scenes do not carry.
- **Proven-safe jitter.** Each landing is nudged by at most half the roomier-axis gap to its
  nearest neighbour, capped by the scene edges. Two boxes only collide when they overlap on
  both axes, so budgeting the roomier axis holds for diagonal neighbours too. A slot revisited
  in a later question therefore never looks pixel-identical.
- **Reproducible.** Same seed, same layout — for StrictMode, tests, and saved rounds.

### Hints

Teaching lessons offer three live-state rungs:

1. “Scan one small part at a time.”
2. “Look near the bottom-left part of the scene.”
3. Highlight a broad search region for 1.5 seconds.

Hints are built from the current unfound target and exported as a tested pure function.
Practice passes no hints.

## 5. Place-based scenes, objects, and original art

### 5.1 Place-first composition

The location is designed first; target objects are then integrated into it. Do not generate
an empty background and scatter 30 unrelated stickers over it.

The 20 authored scene briefs are:

| Place | Scene A | Scene B |
|---|---|---|
| Beach Promenade | Sandcastle Shore | Seaside Café |
| City Park | Playground Picnic | Botanical Pond |
| Family Home | Busy Playroom | Cozy Bedroom |
| Market Street | Fruit Market | Bakery Café |
| Farm Village | Barnyard Morning | Farm Stand |
| Forest Camp | Tent Clearing | Ranger Cabin |
| School Campus | Art Classroom | Library Lab |
| Harbor & Aquarium | Aquarium Gallery | Harbor Docks |
| Science Museum | Planetarium | Robotics Hall |
| Town Square | Festival Square | Toy Parade · Lantern Night |
| Castle Kingdom | Royal Courtyard | Frog Moat · Hall of Mirrors |
| Inventor's Workshop | Cluttered Workbench | Gear Room |
| Coral Reef | Coral Thicket | Sunken Hold |

Every scene contains foreground, middle-ground, and background activity. People or friendly
characters may provide story and scale, but are decorative in v1. Target objects belong in
plausible places: a shell beside a sandcastle, a camera on a café chair, a ruler near a school
desk, or a wrench beside a museum robot. Deliberately funny hiding is allowed; visually
random placement is not.

At least 70% of target placements must touch or sit within a meaningful environmental
anchor—table, shelf, bag, plant, sign, rock, chair, vehicle, building, or character prop.
Freestanding placements are reserved for objects that naturally belong on the ground, in the
sky, or in water.

### 5.2 The 100-object catalog

The catalog has 13 packs of 10 unique, targetable objects. Names are child-facing canonical
English labels; `voice.json` may provide approved synonyms without changing ids.

| Pack | Place | Objects 1–10 |
|---:|---|---|
| 1 | Beach Promenade | shell, sunglasses, crab, bucket, sunscreen, sun hat, beach ball, sandal, camera, kite |
| 2 | City Park | leaf, daisy, butterfly, robin, acorn, watering can, picnic basket, bench, ladybug, umbrella |
| 3 | Family Home | sock, teddy bear, pencil, building block, toy car, key, toy star, hairbrush, alarm clock, slipper |
| 4 | Market Street | apple, banana, carrot, bread loaf, teacup, spoon, shopping bag, cheese wedge, jam jar, rolling pin |
| 5 | Farm Village | rooster, sheep, piglet, horseshoe, tractor, milk pail, corn cob, straw bale, windmill, rubber boot |
| 6 | Forest Camp | pinecone, mushroom, owl, lantern, tent, compass, backpack, camp mug, binoculars, marshmallow |
| 7 | School Campus | notebook, ruler, scissors, paintbrush, glue bottle, globe, calculator, crayon, lunchbox, paper plane |
| 8 | Harbor & Aquarium | clownfish, seahorse, octopus, starfish, pearl, anchor, treasure chest, snorkel, coral branch, submarine |
| 9 | Science Museum | rocket, planet, astronaut helmet, satellite, telescope, robot, moon boot, comet, control panel, wrench |
| 10 | Town Square | bicycle, balloon, ticket, cupcake, drum, crown, gift box, traffic cone, toy train, pinwheel |
| 11 | Castle Kingdom | frog, royal crown, castle key, shield, goblet, scroll, torch, banner, dragon, chess knight |
| 12 | Inventor's Workshop | gear, spring, magnet, screwdriver, bolt, oil can, blueprint, magnifier, drive belt, wind-up key |
| 13 | Coral Reef | sea urchin, kelp frond, hermit crab, angelfish, sand dollar, sea turtle, jellyfish, cowrie shell, sea fan, moray eel |

These 130 canonical ids are frozen once implementation begins. Rename child-facing copy
through metadata; do not rename ids and split progress or scene references.

### 5.3 Object and placement metadata

Every object carries metadata used by generation and validation:

```ts
type ObservationObject = {
  id: string;
  name: string;
  aliases: string[];
  theme: ObservationTheme;
  tags: string[];
  silhouetteFamily: string;
  decoyGroup?: string;
  dominantColorRole: string;
  orientationSafe: boolean;
  occlusionAnchors: ("top" | "right" | "bottom" | "left")[];
  minimumVisibleFraction: number;
  allowedPlaces: ObservationTheme[];
  allowedSurfaces: ("ground" | "table" | "shelf" | "wall" | "plant" |
                    "character-prop" | "vehicle" | "sky" | "water")[];
};
```

The generator uses `silhouetteFamily` to prevent ambiguous outline questions and
`decoyGroup` to create meaningful close matches. `orientationSafe: false` prevents a rotated
object from becoming semantically wrong or visually unreadable. `allowedPlaces` and
`allowedSurfaces` prevent a generator from putting an object somewhere that feels pasted on
or nonsensical.

### 5.4 Art direction and quality bar

- Use one warm, playful vector language: rounded forms, confident dark outlines, restrained
  texture, soft shadows, and a shared colour-role palette.
- Keep line weight and optical detail consistent at the tray's smallest preview size.
- Give every object a recognizable outer contour before internal detail is added.
- Create small story moments—picnic setup, sandcastle building, classroom art, robot
  repair—without adding a second interaction engine.
- Each place gets two compositionally distinct scenes, not one background with objects
  shuffled.
- Each scene has foreground, middle-ground, and background layers, but targets stay inside
  the validated touch and visibility limits.
- Add restrained passive motion—flags, leaves, water, steam, character blinks—through the
  shared motion vocabulary. Motion pauses under reduced-motion and never changes a target's
  scored hit box or gives away its position.
- Scene transitions use a short place-title arrival, then reveal the target tray. They must
  remain skippable and never delay replay/practice.
- Review the 100-object contact sheet at 32px, 48px, and 96px. Reject ambiguous pairs before
  scene authoring.
- Target an initial compressed skill-art budget of 6 MB and verify load time on a low-end
  mobile device. Optimize paths and reuse gradients before weakening the visual quality.

Objects may appear in multiple compatible themes, but their ids remain stable and namespaced
under `observation-`. No target pool may depend on a tiny difference that disappears on a
phone.

- Put 20 backdrops and 100 objects under `src/skills/observation/assets/`.
- Do not embed or trace the supplied reference image.
- Register art from `index.ts` through `registerSkillArt`.
- Bundle all assets; the activity fetches and generates nothing at runtime.
- Use a `0 0 1000 1000` scene coordinate system so art and hit testing scale together.

## 6. Scene data and generation

Author validated JSON scene graphs rather than flattened rasters.

```ts
type SceneObject = {
  id: string;
  asset: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  z: number;
  hitPadding: number;
  visibleFraction: number;
  tags: string[];
  region: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

type ObservationScene = {
  id: string;
  theme: "beach" | "park" | "home" | "market" | "farm" |
         "forest" | "school" | "harbor" | "museum" | "town-square";
  backdrop: string;
  objects: SceneObject[];
  targetPools: Record<string, string[]>;
};

type ObjectHuntParams = {
  mode: "exact" | "silhouette" | "near_decoys" | "rotation" |
        "scale" | "occluded" | "clutter" | "swarm" |
        "overlap" | "mirror" | "camouflage" | "shadow" | "category" | "mixed";
  questionsPerRound: number;
  objectCount: [number, number];
  targetCount: number;
  rotationRange?: [number, number];
  scaleRange?: [number, number];
  visibleFraction?: [number, number];
  practice?: boolean;
  modes?: ObjectHuntParams["mode"][];
  /** Swarm mode: how many copies of the repeated character to hide. */
  swarmCount?: number | [number, number];
};
```

`observationQuestions.ts` alone selects scenes, targets, transforms, and decoys. Rendering
code never calls `Math.random()`.

### Generator invariants

Draw at least 200 questions per lesson configuration and prove:

1. every target exists exactly once;
2. targets remain in bounds and meet the visible-fraction range;
3. selectable hit areas do not overlap;
4. every placement retains a 44 CSS-pixel-wide effective hit area at 360px;
5. look-alikes differ by a meaningful visible feature;
6. silhouette targets have one unambiguous contour match;
7. scale/rotation preserve authored centers and bounds;
8. occlusion leaves an identifying contour or feature;
9. counts match lesson params and targets never repeat within a scene;
10. each target's place and surface satisfy its placement metadata;
11. at least 70% of targets use a meaningful environmental anchor;
12. retries are bounded with a constructive fallback; and
13. questions reproduce from params and index for StrictMode, tests, and bug reports;
14. consecutive questions never produce the same arrangement; and
15. an object reused across a round lands somewhere new rather than staying put;
16. size, fade, and camouflage are scene-wide, never applied to targets alone; and
17. the transform a level teaches reaches its distractors too.

## 7. Repository shape and contract compliance

This follows the current application-skill contract and `src/skills/counting/`. This is an
application skill, not a Codex instruction package, so it does **not** add a `SKILL.md`
inside `src/skills/observation/`; its executable contract is `manifest.json`,
`lessons.json`, `index.ts`, the activity, and inherited skill tests.

Artwork is flat under `assets/` because the reference registration uses
`import.meta.glob("./assets/*.svg", ...)`. Filenames carry grouping.

```text
src/skills/observation/
├── activities/
│   └── ObjectHunt.tsx
├── assets/                       flat: 100 objects + 20 backdrops
│   ├── beach-shell.svg
│   ├── park-ladybug.svg
│   ├── scene-beach-sandcastle-shore.svg
│   └── ...
├── audio/
│   ├── manifest.json             generated phrase → clip map
│   ├── correct/                  recorded praise reactions
│   ├── incorrect/                recorded retry reactions
│   ├── lessons/                  lesson audioPrompt recordings
│   ├── prompts/                  “Find the {object}” recordings
│   └── phrases/                  fixed hint/status recordings
├── internal/
│   ├── data.ts                   frozen 110-object catalog
│   ├── placement.ts              the one function that positions everything
│   ├── scenes.ts                 authored scene registry
│   ├── types.ts                  incl. `keyOf` placement identity
│   ├── validation.ts             catalog + per-question scene legality
│   ├── scenes/                   authored JSON scene graphs
│   └── ui/                       scene, target tray, found marker
├── index.ts
├── lessons.json
├── manifest.json
├── voice.json
├── observation.test.ts           art/registration audit
├── observation.activities.test.tsx
├── observation.audio.test.ts
├── observation.features.test.tsx
├── observation.hints.test.ts
├── observation.integration.test.ts   course order + offline bundling
├── observation.placement.test.ts     layout variety, legality, determinism
├── observation.practice.test.tsx
├── observation.questions.test.ts
└── observation.scenes.test.ts
```

`ObjectHunt` uses `useSkillRound`, renders inside `SkillRound`, and reaches the host only
through injected `koda`. It awards no XP and imports nothing from another skill folder.
Phase 1 implements every mode. `defaultParams` creates a playable exact-match question.

`index.ts` uses the same registration shape as Counting:

```ts
const assets = registerSkillArt(manifestFields.id, import.meta.glob("./assets/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>);

registerSkillVoice(
  audioManifest as Record<string, string>,
  import.meta.glob("./audio/**/*.{wav,mp3,ogg,m4a}", {
    query: "?url",
    import: "default",
    eager: true,
  }) as Record<string, string>,
  voiceJson.groups,
  manifestFields.id,
);
```

## 8. Accessibility and input

Keyboard focus is visible, target-tray controls have accessible names, and status changes
use a polite live region.

A visual hidden-object scene cannot be made equivalent by exposing every SVG label; that
reveals the answer. V1 includes an **Accessible List view**:

- replace the scene with shuffled, labelled object cards;
- keep the same target tray and distractor rules;
- produce the same expected answer, attempts, stars, and telemetry;
- hide decorative SVG layers from assistive technology; and
- apply config changes on the next round, matching the SDK contract.

## 9. Manifest proposal

```jsonc
{
  "id": "observation",
  "name": "Observation Quest",
  "version": "0.1.0",
  "description": "Place-based hidden-object games that build visual scanning, comparison, and attention.",
  "category": "core",
  "author": "Koda Learning Lab",
  "iconName": "Search",
  "tagline": "Look closely, scan the scene, and spot every match.",
  "thumbnail": "observation-scene-beach-sandcastle-shore",
  "status": "draft",
  "audience": { "ages": [5, 9], "category": "spatial-reasoning" },
  "requires": []
}
```

### Features

| Feature id | Observable effect |
|---|---|
| `audio_speech` | reads instructions, object names, and hints |
| `sound_chimes` | found, wrong-tap, and completion sounds |
| `haptic_feedback` | tactile found and wrong-tap feedback |
| `target_preview` | opens a larger labelled target card |
| `search_region_hints` | enables region-based hints |
| `accessible_list_view` | offers the labelled candidate-card list beside the scene |
| `step_context_tags` | shared warm-up/guided/milestone labels |
| `premium_lessons` | gates lessons after the configured free count |

Each feature is read with `koda.config.isEnabled()` and behaviour-tested. Reuse established
label, `speechRate`, and `freeLessons` settings; v1 adds no global scene-density setting.

## 10. Required audio, telemetry, and worksheets

### 10.1 Audio is a publication requirement

Live TTS is acceptable while the skill is a draft. It is not publishable until required
recordings exist and `npm run voice:plan -- --skill observation` reports **0 missing**.

| Layer | Source | Required content | Playback path |
|---|---|---|---|
| UI chimes | host `SoundType` | `pop` on a partial match, `success` on completion, and `error` on a wrong tap | `koda.sound.play`, gated by `sound_chimes`; recorded reactions start after each chime |
| Correct reactions | `voice.json` → `audio/correct/` | at least 5 variants, including “Congratulations! You found them all!” | automatically from `round.submit` |
| Incorrect reactions | `voice.json` → `audio/incorrect/` | at least 4 gentle variants, including “Not a match. Try again.” | automatically from `round.submit` |
| Lesson introductions | `lessons.json` → `audio/lessons/` | 11 place/lesson `audioPrompt` lines | teaching open through `koda.speech.say`; suppressed in practice |
| Object prompts | `voice.json` → `audio/prompts/` | “Find the {object}.” for all 100 canonical names | Read-aloud/target-preview through `koda.speech.say` |
| Fixed phrases | `voice.json` → `audio/phrases/` | scan hint, four region hints, and already-found feedback | `koda.speech.say` |

This is approximately 120–135 skill-owned voice clips. Partial matches use animation and a
short pop rather than a competing spoken line. Object-specific recordings are required for
“Find the {object},” where they support vocabulary and independent play.

Proposed `voice.json` shape:

```jsonc
{
  "subjects": ["shell", "sunglasses", "crab", "...all 100 canonical names..."],
  "templates": ["Find the {value}."],
  "phrases": [
    "Scan one small part at a time.",
    "Look near the top-left part of the scene.",
    "Look near the top-right part of the scene.",
    "Look near the bottom-left part of the scene.",
    "Look near the bottom-right part of the scene.",
    "You already found that one."
  ],
  "groups": {
    "correct": {
      "voices": ["Kore", "Puck", "Zephyr"],
      "phrases": [
        "Congratulations! You found them all!",
        "Fantastic searching!",
        "You spotted every object!",
        "Great observation!",
        "That whole scene is complete!"
      ]
    },
    "incorrect": {
      "voices": ["Kore", "Zephyr", "Puck"],
      "phrases": [
        "Not a match. Try again.",
        "Good try. Look a little closer.",
        "Almost. Check another part of the scene.",
        "Keep searching. You can find it."
      ]
    }
  }
}
```

The real file lists all 100 subjects. Lesson introductions are collected automatically from
`lessons.json` and are not duplicated in `voice.json`.

```bash
npm run voice:observation -- --dry-run
npm run voice:observation -- --limit 5
npm run voice:observation
# or import a human voice:
npm run voice:record -- --skill observation --import ./my-voice
npm run voice:plan -- --skill observation   # must report 0 missing to publish
```

`voice:observation` selects OpenAI's `gpt-4o-mini-tts` model and the `marin`
voice. It reads `OPENAI_API_KEY` from the ignored `.env` file or the current
process environment. The key is never written into the skill or its manifest.
The full ten-place build plans 132 local clips, all of which are now recorded
and bundled. Later scene packs add their object prompts and hints through the
same `voice.json` inventory.

Recording is deliberate because generation can cost money. Generated or imported clips land
below `audio/` and update `audio/manifest.json`; implementation never edits that manifest by
hand.

There is no looping music or ambient audio in v1. The injected SDK exposes short
`SoundType` effects and speech, not a skill-owned music player. Music would require a host
SDK addition rather than `new Audio()` inside this skill.

### 10.2 Audio tests

- `observation.audio.test.ts` proves `sound_chimes: false` silences activity chimes.
- Correct subtargets call `sound.play("pop")` once and do not speak or trigger an
  answer-group reaction.
- Final targets stop unfinished speech, play one success chime, and let `round.submit`
  supply one correct voice reaction after a 560 ms delay.
- Wrong taps stop unfinished speech, play one error chime, and let `round.submit`
  supply one incorrect voice reaction after a 240 ms delay.
- `audio_speech: false` prevents lesson, prompt, hint, and reaction speech.
- Practice speaks no opening prompt or search hint.
- Before publication, every required phrase resolves through `audio/manifest.json` to an
  existing bundled file.

### 10.3 Telemetry

`learning.present` includes mode, scene id, expected target ids, object/target counts, and
difficulty dimensions. Wrong taps and final correct completion are answers. Found subtargets,
repeated-found taps, preview, and zoom may be debug logs. Hints call `supportUsed`.

Do not store raw pointer trails or infer eye movement, attention span, or diagnosis.

### 10.4 Worksheets

V1 declares no worksheet adapter: scene touch state and retained found marks are essential.

## 11. Implementation phases

**Implementation status — 2026-09-04:** Phases 0–7 and the automated Phase 8 audit are complete. The skill remains
registered as `draft`; Levels 1–10 rotate through twenty authored scenes across all ten
planned places. All 100 object assets are bundled; silhouette, near-decoy, rotation, scale,
partial-object, clutter, and mixed challenge modes are live. Scene texture supplies
low-contrast visual decoys while targets blend with their surroundings, and locations remain
deterministically randomized between collision-safe authored slots. Level 11 now provides ten
silent, hint-free one-target practice searches. Scene/List switching, keyboard focus, live
progress, and reduced-motion behavior are implemented. The 132-phrase Phase 7 audio plan now
reports **0 missing**: every object prompt, lesson introduction, hint phrase, and reaction
variant is recorded and bundled. All seven declared features are read by the activity and
behaviour-tested in `observation.features.test.tsx`. Eighteen lessons now run across 13 places,
130 objects, and 28 scenes; the voice plan covers 208 phrases with 0 missing. A Castle Kingdom
pack (10 objects, 3 scenes) and the `swarm` mode ship on top of that: Level 10 searches the Royal Courtyard and
Level 11 hides one frog fourteen times around the Frog Moat, with 12 live per question. The
voice plan covers all 153 phrases with **0 missing**. Only the final manual device/offline
pass and the Phase 9 status flip remain.

Twenty-two clips under `audio/` are left over from an earlier Beach-only `voice.json` and are
no longer referenced; `npm run voice:observation -- --prune` removes them.

| Phase | Levels | Deliverables | Completion signal |
|---|---|---|---|
| **0 — Groundwork (complete)** | — | Baseline; schemas; validators; deterministic generator; layout/palette; 10 prototype objects; one beach scene; 100-object catalog frozen | 200 L1–3 questions pass invariants; contact-sheet review passes; nothing registered |
| **1 — Playable core (complete)** | 1–3 | Full engine/scaffold; every future mode; manifest; registry; course; structural/behaviour/hint tests | Skill appears; L1–3 complete; wrong taps preserve state; kit owns stars/XP |
| **2 — Visual features (complete)** | 4–5 | Silhouette and near-decoy JSON; complete Beach, Park, Home, and Market packs/scenes (40 objects, 8 scenes) | One exact answer per clue; differences visible at 360px |
| **3 — Transformations (complete)** | 6–7 | Rotation/scale JSON; complete Farm, Forest, and School packs/scenes (70 objects, 14 scenes) | Centers/bounds remain correct; hit regions remain 44px; art contact sheet remains coherent |
| **4 — Hidden and busy (complete)** | 8–10 | Partial-object/clutter/mixed JSON; complete Harbor, Museum, and Town (100 objects, 20 scenes) | Five targets work in any order; all remain marked; 100-object and 20-scene audits pass at 360px |
| **5 — Practice (complete)** | 11 | Mixed practice; `modeAt`; silence/no-hint tests; Practice log check | 10 one-target questions file comparable pace |
| **6 — Accessibility (complete)** | — | List view; keyboard, focus, live-region, reduced-motion audit | Every round completes without pointer input or exposed hidden labels |
| **7 — Voice/settings (complete)** | — | Final `voice.json`; object-name/alias audit; record or import required clips; generated `audio/manifest.json`; audio/feature/settings tests | All 100 object prompts are pronounceable, required reactions exist, and voice plan reports 0 missing |
| **8 — Integration (automated audit complete)** | — | Course; thumbnail; generated seeds; Skill Manager, disable, mobile/theme/offline/audio pass | 11 lessons open once/in order; disabling removes all; required audio works on a second offline round |
| **9 — Publish (gated)** | — | Change `draft` to `published` | Publication is the only functional change |
| **11 — Advanced modes (complete)** | 12–16 | Inventor's Workshop and Coral Reef packs; Hall of Mirrors and Lantern Night scenes; overlap/mirror/camouflage/shadow/category modes; category and mirror-safety metadata | Five new demands, each behaviour-tested; challenge and practice cycle them |
| **10 — Swarm + Castle (complete)** | 10–11 | Castle Kingdom pack; `castle-frog-moat` swarm scene; `instanceId`/`keyOf` placement keys; counter tray; swarm tests | One character is findable many times over; every copy scores once; List view names each copy |

Gate every phase:

```bash
npm run lint
npm test
npm run build
```

For Phases 1–8, test the running app at 360px and desktop width, light and dark, then finish
a second round offline.

## 12. Test plan

Structural tests call `describeSkillContract(skill)` and `describeActivitySmoke(skill)`.
The `ObjectHunt` driver reads `expected` from `learning.present` and proves:

- targets work in any order;
- a subtarget does not advance early;
- a wrong tap stays on the scene and counts as an attempt;
- the final target advances once;
- found-object retaps do not submit;
- scene and tray opacity states agree;
- correct subtargets play one `pop` chime and animate into the matching target;
- wrong taps show “Not a match. Try again.” and trigger one recorded incorrect reaction
  without a simultaneous synthesized tone;
- the final target plays one `success` chime and triggers one recorded correct reaction;
- hints use the current unfound target;
- practice has no hints or spoken opening; and
- List view produces the same expected answers and score.

Course tests prove 11 lessons occur exactly once in one contiguous, ordered block and keep
practice in its own unit. Data tests cover every invariant in §6.

## 13. Development risks

1. Do not make difficulty by shrinking targets. This is the easiest rule in the list to
   break by accident: applying scale, opacity, or camouflage to `isTarget` alone makes every
   answer the one small washed-out thing on screen, and rotating or clipping only the targets
   turns "find the turned object" into "find the odd one out". Difficulty belongs in
   camouflage strength, distractor count, decoy similarity, and occlusion — all of which
   apply to the whole scene.
2. Reject ambiguous targets and overlapping hit areas.
3. Keep found targets visible.
4. Do not rely on colour alone.
5. Make decoys meaningfully different on a phone.
6. Ensure occlusion leaves an identifying feature.
7. Use bounded generation and deterministic fallback.
8. Do not copy or trace the reference art.
9. Do not fetch or generate art at runtime.
10. Do not record pointer trails or diagnose mistakes.
11. Use one target per practice question for comparable pace.
12. Do not expose hidden SVG labels; route to List view.

General skill rules still apply: no cross-skill imports, direct host access, or XP in skill
code; include `expected`; use theme tokens and real feature readers; flag practice; remain
offline-capable.

## 14. Definition of done

- All 18 lessons open exactly once and in order.
- Levels advance from one clear object to a five-object crowded challenge.
- The screen has an original scene, persistent tray, any-order finding, and retained marks.
- Exactly 130 original targetable objects across 13 themes and 28 authored scenes are
  bundled, namespaced, and listed in one validated catalog.
- Flat `assets/*.svg` and recursive `audio/**/*` registration match the Counting reference;
  there are no unregistered nested art folders.
- Required object prompts, lesson introductions, hints, and reaction variants are bundled;
  the Observation voice plan reports 0 missing before publication.
- Every scene/question passes its property invariants.
- Practice produces pace data through 10 one-target questions without hints/opening speech.
- Keyboard and Accessible List view complete every round.
- All hit areas meet the 44×44 floor at 360px.
- Every feature changes observable behaviour and has a test.
- Shared kit owns stars/XP; the activity awards none.
- Light/dark, 360px, desktop, reduced-motion, and offline checks pass.
- Disabling Observation removes all 18 lessons.
- Lint, tests, and build are green; publishing happens only in Phase 9.
