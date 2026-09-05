# Bottle Sort — build plan

Follows [SKILL_BUILD_TEMPLATE.md](SKILL_BUILD_TEMPLATE.md). Design only; nothing is
implemented. Ten phases, 0 through 9, in [Delivery](#delivery).

## Release scope

- **ID / name / ages:** `bottle-sort` / Bottle Sort / 6–12
- **Learner outcome:** plan a sequence of moves toward a goal, hold a partial plan in
  mind while carrying it out, and recognise a dead end before reaching it.
- **Prerequisites:** none. `manifest.requires: []`; Level 1 is independent.
- **Included techniques:** pouring, capacity, planning under constraint, locked and
  one-way bottles, hidden state, move budgets, ordering by number and fraction, target
  patterns, linked bottles, predicting a pour.
- **Deferred:** timers of any kind, colour mixing, competitive scoring, bottle editors,
  anything that pressures a child to hurry.
- **Closest reference engine:** `src/skills/observation/activities/ObjectHunt.tsx` — one
  long interaction scored as a single question. Tests:
  `src/skills/observation/observation.activities.test.tsx`,
  `src/skills/observation/observation.placement.test.ts`. Contract:
  `src/skills/kit/example/ExampleActivity.tsx`.

### Product benchmark

Checked against what shipped games document, not from memory. The genre is consistent:
capacity four, tap source then target, the whole top run moves together, and — in every
product examined — **no timer and no penalty for a wrong move**. That is not a Koda
concession; it is how the genre already works.

| Product | Documented strength | Adopt | Do not copy |
|---|---|---|---|
| [Ball Sort Puzzle](https://play.google.com/store/apps/details?id=app.game.ball.sort&hl=en_US) | 500+ levels, offline, no login; undo, hint and extra-tube help; letters on balls for colour-blind players | Endless offline play, the three supports, a non-colour mark on every segment | Skins, ad-gated power-ups, level count as the headline |
| [Ball Sort (Coolmath)](https://www.coolmathgames.com/0-ball-sort) | Capacity four, tap-to-lift then tap-to-place, reset without penalty, an extra vial every five levels | Reset is free; help paced by progress, not payment | Difficulty that spikes early then plateaus |
| [Water Sort: Color Tube Puzzle](https://play.google.com/store/apps/details?id=water.sort.puzzle.color.sort.games&hl=en_US) | Easy/Normal/Hard/Expert; foresight and limited space as the stated difficulty source | Difficulty from space and lookahead, expressed as lessons | Mode pickers; a lesson already is the band |
| [Secret Tube](https://apps.apple.com/us/app/secret-tube-color-sort-puzzle/id1551197535) / [Unlock Tubes](https://apps.apple.com/app/id1545798801) | Hidden colours and locked tubes as whole products | Both, as single lessons | Building an app around one twist |

Two findings changed the design. **The extra bottle is the genre's signature help**, and
it is a better hint than prose: it eases the constraint without naming a move. And a
third-party [solver site](https://chromaoracle.com/water-sort-puzzle-solver) sells a
mystery mode for hidden colours — people reach for solvers because shipped racks can be
brutal or unsolvable, which is the one place this design should be plainly better than
the market rather than equal to it.

## Lesson map

30 teaching lessons and 3 practice. Local `params.level` is contiguous 1–33. The hint
strategy is one ladder throughout — **scan → name a source → extra bottle** — except
where a row says otherwise; practice passes none.

| Order / lesson ID | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint | Practice |
|---|---|---|---|---|---|---|
| 1 / `one-pour` | pour onto a match / `pourer` | — | sort · plain | 2 colours, cap 4, 3 bottles, 1 scramble | kidTip only | `practice-pouring` |
| 2 / `two-pours` | repeat the rule / `pourer` | — | sort · plain | 2 colours, cap 4, 4 bottles, 2 scramble | kidTip only | `practice-pouring` |
| 3 / `use-the-empty-bottle` | use a spare / `space-maker` | `pourer` | sort · plain | 3 colours, 5 bottles, 1 spare | full ladder | `practice-pouring` |
| 4 / `pour-the-whole-run` | a run moves together / `run-mover` | `space-maker` | sort · plain | a run of 3 must move at once | full ladder | `practice-pouring` |
| 5 / `sort-three-colours` | first real solve / `colour-sorter` | `run-mover` | sort · plain | 3 colours, 5 bottles, 7 scramble | full ladder | `practice-pouring` |
| 6 / `short-and-tall` | read capacity / `capacity-reader` | `colour-sorter` | sort · mixed capacity | caps 3/4/5 in one rack | full ladder | `practice-pouring` |
| 7 / `will-it-fit` | capacity blocks a pour / `capacity-reader` | `colour-sorter` | sort · mixed capacity | a legal-looking pour has no room | full ladder | `practice-pouring` |
| 8 / `fill-to-the-top` | finish exactly / `exact-filler` | `capacity-reader` | sort · mixed capacity | one bottle must end exactly full | full ladder | `practice-pouring` |
| 9 / `count-before-you-pour` | how many will move / `run-counter` | `exact-filler` | sort · plain | prompt names the run length | full ladder | `practice-pouring` |
| 10 / `practice-pouring` | practice / `run-counter` | — | sort · mixed | 5 racks drawn from L3–9 | none | — |
| 11 / `four-colours` | more to hold / `colour-grower` | `run-counter` | sort · plain | 4 colours, 6 bottles | full ladder | `practice-planning` |
| 12 / `taller-bottles` | taller to hold them / `capacity-grower` | `colour-grower` | sort · plain | 4 colours, cap 5 | full ladder | `practice-planning` |
| 13 / `one-space-left` | plan the last slot / `space-planner` | `capacity-grower` | sort · plain | exactly one free slot | full ladder | `practice-planning` |
| 14 / `no-free-bottle` | make space first / `space-planner` | `capacity-grower` | sort · plain | no free bottle at deal | full ladder | `practice-planning` |
| 15 / `the-locked-bottle` | order the plan / `order-planner` | `space-planner` | sort · locked | one bottle opens on a completed bottle | full ladder | `practice-planning` |
| 16 / `two-locks` | chained order / `order-planner` | `space-planner` | sort · locked | two dependent unlocks | full ladder | `practice-planning` |
| 17 / `the-one-way-bottle` | a move you cannot undo / `irreversible-mover` | `order-planner` | sort · one-way | one receive-only bottle | full ladder | `practice-planning` |
| 18 / `think-before-you-pour` | prefer a short plan / `move-budgeter` | `irreversible-mover` | sort · budget | budget = minimum + 2 | scan → source only | `practice-planning` |
| 19 / `the-shortest-way` | the shortest plan / `move-budgeter` | `irreversible-mover` | sort · budget | budget = minimum | scan → source only | `practice-planning` |
| 20 / `practice-planning` | practice / `move-budgeter` | — | sort · mixed | 5 racks drawn from L11–19 | none | — |
| 21 / `what-is-underneath` | act on partial information / `hidden-state-reasoner` | `move-budgeter` | sort · hidden | bottom 2 hidden at deal | full ladder | `practice-bottle-sort` |
| 22 / `reveal-as-you-go` | revise as it reveals / `hidden-state-reasoner` | `move-budgeter` | sort · hidden | reveals only on uncover | full ladder | `practice-bottle-sort` |
| 23 / `guess-the-result` | simulate one move / `pour-predictor` | `hidden-state-reasoner` | **predict** | 4 candidate racks, 1 correct | scan only | `practice-bottle-sort` |
| 24 / `guess-two-ahead` | simulate two / `pour-predictor` | `hidden-state-reasoner` | **predict** | 2 pours, then choose | scan only | `practice-bottle-sort` |
| 25 / `sort-by-number` | order, not match / `order-builder` | `pour-predictor` | sort · numbered | segments 1–4, ascending | full ladder | `practice-bottle-sort` |
| 26 / `sort-backwards` | reverse the order / `order-builder` | `pour-predictor` | sort · numbered | descending | full ladder | `practice-bottle-sort` |
| 27 / `odd-and-even-bottles` | sort by property / `parity-sorter` | `order-builder` | sort · numbered | odds and evens separate | full ladder | `practice-bottle-sort` |
| 28 / `sort-by-size` | compare fractions / `fraction-comparer` | `parity-sorter` | sort · fractions | ½ ¾ ⅓ ⅔, by value | full ladder | `practice-bottle-sort` |
| 29 / `count-by-twos` | a sequence as the goal / `skip-counter` | `parity-sorter` | sort · numbered | build 2, 4, 6, 8 | full ladder | `practice-bottle-sort` |
| 30 / `make-the-rainbow` | reproduce an order / `pattern-builder` | `skip-counter` | sort · pattern | a named order, not uniform | full ladder | `practice-bottle-sort` |
| 31 / `linked-bottles` | reason about a side effect / `side-effect-reasoner` | `pattern-builder` | sort · linked | two bottles fill together | full ladder | `practice-bottle-sort` |
| 32 / `mixed-racks` | everything at once / `independent-planner` | `side-effect-reasoner` | sort · mixed | 6 colours, cap 5, 8 bottles, cycles techniques | full ladder | `practice-bottle-sort` |
| 33 / `practice-bottle-sort` | practice / `independent-planner` | — | sort · mixed | 5 racks, all techniques | none | — |

`skip-counter` is reused from counting deliberately; the other 19 keys are new and
collide with nothing in the four shipped skills. Practice lessons sit in their own
course units.

## Engine decisions

Only decisions the guide does not already make.

### Interaction and answer judging

1. Tap a source bottle, then a destination. The top run of one colour pours if the
   destination is empty or its top matches, and there is room.
2. An **illegal pour is refused with a reason** — "That bottle is full." — and is not an
   answer and not a hint. This is the most important rule in the skill: trying a pour to
   see what happens is the method, and scoring it teaches a child to stop.
3. Solving the rack is one correct `round.submit`. A deadlock — no legal pour, not
   solved — is one incorrect `round.submit`, and the rack returns to its dealt state.
4. Undo, reset and every hint rung are `round.useSupport`.
5. Teaching rounds are 3 racks; practice is 5.

`expected` is the **property** "every bottle uniform", not a signature of the dealt rack:
the extra-bottle hint changes the rack mid-round, so a fixed string would stop matching.
`given` is the final arrangement.

### Generation, and the invariant that matters

**Solvability is structural, not checked.** Generate backwards: start from the solved
rack and apply random legal pours. Undoing those pours one at a time is itself a legal
solution, so no generated rack can be impossible — there is no generate-then-discard
loop and no unsolvable deal.

Difficulty is the number of scramble pours and the free space left. For racks this size
an exact minimum solution is computable by breadth-first search, so a lesson asserts
"solvable in ≤ n" rather than hoping.

Prove over 200 draws per lesson: every rack solvable by construction and by search;
colour counts exact multiples of a bottle; no rack dealt solved, or solvable in one pour
above Level 2; free space matching the lesson; minimum solution inside the lesson's band;
every colour distinguishable without colour; and a rack reproducing from params and index.

### Colours are drawn fresh every round

A rack replayed with the same colours looks like the same rack, and a child who
remembers "blue goes right" is remembering a picture rather than solving. So the palette
is **dealt per round from a vetted set of twelve**, not fixed to the level.

- The set is vetted once for contrast on both grounds and for separation from one
  another; the round draws *k* from it with a minimum perceptual distance between any
  two, so a deal never produces two blues a child must squint at.
- **The shape stays bound to the position in the deal, not to the hue.** Colour one is
  always the circle, whatever colour one turns out to be. A colour-blind child then
  plays the same puzzle every time, because the marks are what they read.
- It is part of the seed, so a rack still reproduces from params and index — the same
  question asked twice is identical, and only a *new* round redraws.

Numbered and fraction levels keep their glyphs as the meaning; colour there is
decoration and may still rotate.

### Modes

Three tiers. Tier 1 makes it recognisably the game; Tier 2 is what other products built
whole apps around; Tier 3 makes it a Koda skill rather than a clone. All are parameters
on one engine except `predict`.

**Tier 1 — genre standard:** capacity four as the default, whole-run pour, tap-tap
selection, refusal rather than penalty, undo, reset, the extra bottle, no timer, a
non-colour mark on every segment, and an endless generator — 33 lessons are the taught
path, not the content limit.

**Tier 2 — shipped elsewhere as whole games:** `hidden` (lower segments unseen until
uncovered) and `locked` (a bottle that opens when another is completed).

**Tier 3 — Koda's own:**

| Mode | The rack | What it forces |
|---|---|---|
| mixed capacity | bottles hold 3, 4 or 5 | read capacity before pouring |
| one-way | receives but never pours | recognise a move you cannot take back |
| budget | solve within *n* pours | prefer the shorter plan |
| numbered | ascending, descending, parity, skip-count | order, not just match |
| fractions | sorted by value | compare fractions by size |
| pattern | finish as a named order | reproduce a sequence |
| linked | two bottles fill together | reason about a side effect |
| **predict** | choose the resulting picture; nothing pours | simulate a move mentally |

`predict` has no equivalent in any product examined, trains the skill every other level
only rewards, and is the cheapest to build. It is a **second activity**, not a mode: it
does not pour, and its answer is a choice among pictures.

**Growth runs on two axes together** — more colours, and taller bottles to hold them.
More bottles alone makes a rack longer, not harder.

### Boundary cases

- A rack dealt solved, or solvable in one pour above Level 2, is rejected and redrawn at
  a different index; scrambling is bounded and falls back to a longer scramble.
- Deadlock detection checks every ordered pair including partial pours. Telling a child
  they are stuck when a legal pour exists is worse than not checking.
- Undo must survive the extra bottle and the unlocking of a locked bottle.
- The extra bottle takes the largest capacity in the rack, so it cannot create a
  position the solver would not have found.

### Hints

The genre's own supports are better rungs than prose:

1. "Look for a bottle you could empty completely." — strategy, no rack knowledge
2. "Bottle 3 has somewhere to go." — names a source, never a destination
3. **An extra bottle appears** — eases the constraint, still names no move

### Feedback, sound and haptics

The activity owns short effects through `koda.sound.play`; the round owns recorded
reactions. It never calls `playAnswerSound`, `playReaction` or `new Audio()`. `SoundType`
already provides everything needed, and one of them — **`clink`** — is made for glass.

| Event | On screen | Sound and haptic | Submission |
|---|---|---|---|
| Legal pour | liquid moves, levels change | `clink`, tap | local state only |
| Refused pour | the reason | `error`, light pulse | **none — not an answer** |
| Rack solved | "You sorted them all." | `success`, then one recorded reaction after 560 ms | one correct submit |
| Deadlock | "No pours left." | `error` | one incorrect submit |
| Hint 1–2 | the hint line | none | support |
| Extra bottle | the bottle appears | `pop` | support |
| Undo / reset | rack steps back | `pop`, soft | support |

One `clink` per pour, not one per segment: a run of three is a single move, and three
chimes would report the animation rather than the move. Chimes need the device sound
preference and `sound_chimes`; haptics need `haptic_feedback`; and every line the
activity speaks itself checks `audio_speech`, because the kit gates only the intro, the
hint line and the recorded reactions.

### The bottle, and the pour

Bottles are drawn from geometry, not artwork — neck, shoulder, body, rounded base, with
the body scaling to capacity so a taller bottle visibly holds more.

**They are drawn as glass with depth, not as an outline.** A flat silhouette reads as a
paper cut-out and undersells the liquid. Depth comes from four cheap things, all
gradients rather than images: a horizontal gradient across the body so the glass turns
away at both edges; an **elliptical rim at the mouth**, since a cylinder seen slightly
from above shows an ellipse and a flat line is the single thing that makes it look flat;
a soft highlight down the near-left of the body with a narrower one at the right edge;
and a darker meniscus band at the top of each liquid layer, which is what makes it read
as liquid rather than stacked blocks.

**The pouring stream connects mouth to mouth.** It leaves the tilted source bottle's lip
and lands in the receiving bottle's mouth — not a stream drawn near the target, and not a
segment that teleports. Both ends are computed from the two bottles' live positions
*after* the tilt transform, so it stays attached at any rack size and across two rows. It
carries the poured colour, narrows along its length as a falling stream does, and is
drawn behind the receiving bottle's glass so the liquid arrives inside it.

The tilt pivots on the source's base, the way a hand tips a bottle, and segments leave
and arrive one at a time so a run of three reads as three.

### Layout and accessibility

Measured against the 44px floor at a 316px content width: 4 bottles/row 73px, 5/row
57px, **6/row 46px**, 7/row 38px — under the floor. **Six is the ceiling on a phone**;
Level 32's eight wrap to two rows. A bottle is a single tap target, so a narrower bottle
is a missed pour, not a smaller picture.

Every colour carries a shape, and the shape is what the accessible name reports
("bottle 3, two circles on two stars"). Keyboard: arrows move between bottles, Enter
selects source then destination, Escape cancels. A refusal announces its reason through
the polite live region, not only as a shake. The six shapes are reviewed at 24px before
the set is frozen — they must differ in silhouette, not only in name.

### Configuration, artwork and speech

- **No `assets/`.** Bottles are geometry; a body that grows with capacity cannot be a
  fixed SVG, and nothing else in the skill is illustrated.
- **Speech:** about 30 clips — the refusal reasons, the hint ladder, the completion
  line, 33 lesson `audioPrompt`s, and the shared reaction groups. No per-colour
  recordings: the shape is on screen, and with colours redrawn every round a spoken
  colour name would be wrong as often as right.
- **Features:** `audio_speech`, `sound_chimes`, `haptic_feedback`, `pour_animation`,
  `move_hints`, `extra_bottle`, `step_context_tags`, `premium_lessons`.

  `pour_animation` is not a duplicate of reduced motion: the OS preference is the
  child's, this is the adult's, and a child distracted by the tilt should not need a
  system setting changed. **The physics is presentation, never the rule** — the
  resulting rack is identical with it on or off, and a test asserts that.

### Printed modes

**No worksheet adapter.** The answer is a sequence of moves against a changing state; on
paper a child cannot pour, so the task becomes "write the moves", which is a different
and harder skill. `predict` could print, but one mode's adapter is not worth a printed
path that misrepresents the rest of the skill.

### Telemetry

`learning.present` carries the mode, colour count, bottle count, capacities, scramble
length and minimum solution. Answers are exactly two events: solved, or deadlocked.
Refusals, undos, resets and hint rungs are support and debug logs.

Do not record the pour sequence. It is a keystroke trail of a child thinking, it answers
no question the aggregate does not, and how long they hesitated is not something this
app should hold.

### Repository shape

```text
src/skills/bottle-sort/
├── activities/
│   ├── BottleSort.tsx          the pour engine
│   └── PredictThePour.tsx      L23–24; chooses a picture, pours nothing
├── internal/
│   ├── racks.ts                reverse-generation and the per-round palette
│   ├── pour.ts                 pure rules: legality, refusal reason, the pour
│   ├── solve.ts                breadth-first minimum solution, for bounds and tests
│   ├── bottle.ts               geometry: outline, rim, layer bands, stream endpoints
│   └── types.ts
├── index.ts · lessons.json · manifest.json · voice.json
├── audio/manifest.json
└── bottle-sort.*.test.ts(x)
```

## Delivery

Build `pour.ts`, `racks.ts` and `solve.ts` with the invariants proved before any UI, then
one engine and its behaviour driver, then expand by the lesson map. **Ten phases:**

| Phase | Deliverable | Done when |
|---|---|---|
| 0 | Pure rules, reverse-generation, solver, palette draw | 200 draws per lesson pass; no rack unsolvable |
| 1 | Engine, L1–5, scoring contract, driver | A rack completes; a refusal scores nothing |
| 2 | Capacity and counting, L6–10 | Capacity refuses correctly; practice files pace |
| 3 | Planning, L11–20 | Locked and one-way bottles refuse and accept correctly |
| 4 | Hidden state and prediction, L21–24 | `PredictThePour` scores from a picture choice |
| 5 | Number, fraction, pattern, L25–30 | Ordering goals judged correctly |
| 6 | Linked and mixed, L31–33 | Every technique cycles in the mixed rack |
| 7 | Glass depth, mouth-to-mouth stream, sound, haptics, features, accessibility | Each switch behaviour-tested; keyboard completes a rack |
| 8 | Voice recorded; integration, device, offline | Voice plan 0 missing; a second round completes offline |
| 9 | Publish | `draft` → `published`, and nothing else changes |

Use the [validation matrix](SKILL_DEVELOPMENT.md#11-validation-matrix) and record actual
results; it is not restated here. Skill-specific checks to add to it:

- a refusal submits nothing, scores nothing and leaves the rack unchanged;
- solving submits once, a deadlock submits once, and neither can submit twice;
- `pour_animation` off produces the identical rack to on;
- deadlock detection agrees with the solver on 200 racks per lesson;
- undo survives the extra bottle and an unlock;
- hidden segments are absent from the accessible name until uncovered;
- a redrawn palette never puts two colours within the minimum perceptual distance, and
  shape stays bound to deal position across 200 rounds;
- the stream's endpoints stay on both bottles' mouths at every rack size and on two rows.

**Outstanding:** everything. Nothing in this plan is built.
