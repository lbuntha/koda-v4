# Bottle Sort — build plan

Design only. Nothing here is implemented.

## Release scope

- **ID / name / ages:** `bottle-sort` / Bottle Sort / 6–12
- **Learner outcome:** plan a sequence of moves toward a goal, hold a partial plan
  in mind while carrying it out, and recognise when a chosen path has run out.
- **Prerequisites:** none. `manifest.requires: []`; Level 1 is independent.
- **Included:** pouring, capacity, planning under constraint, hidden state,
  ordering by number and by fraction, target patterns, move efficiency.
- **Deferred:** timers of any kind, colour mixing, competitive scoring, tube
  editors, anything that pressures a child to hurry.
- **Closest reference engine:** `src/skills/observation/activities/ObjectHunt.tsx`
  for a round of one long interaction scored as a single question, and
  `src/skills/kit/example/ExampleActivity.tsx` for the contract.

## 1.1 Product benchmark

Checked against what shipped games actually document, not from memory. The genre is
remarkably consistent: capacity four, tap source then target, the whole top run moves
together, and — in every product examined — **no timer and no penalty for a wrong move**.
That last point is not a Koda concession; it is how the genre already works.

| Product | Documented strength | Adopt | Do not copy |
|---|---|---|---|
| [Ball Sort Puzzle](https://play.google.com/store/apps/details?id=app.game.ball.sort&hl=en_US) | 500+ levels, offline, no login; undo, hint and extra-tube help; **letters on balls for colour-blind players** | Endless offline play, the three supports, and a non-colour mark on every segment | Skins, ad-gated power-ups, level-count as the headline |
| [Ball Sort (Coolmath)](https://www.coolmathgames.com/0-ball-sort) | Capacity four, tap-to-lift then tap-to-place, reset without penalty, **an extra vial every five levels**, adjustable animation speed | The reset-is-free rule, and pacing help by progress rather than by payment | Difficulty that spikes early then plateaus |
| [Water Sort: Color Tube Puzzle](https://play.google.com/store/apps/details?id=water.sort.puzzle.color.sort.games&hl=en_US) | Easy/Normal/Hard/Expert bands; foresight and limited space as the stated difficulty source | Difficulty from space and lookahead, expressed as lessons rather than modes | Mode pickers; a Koda lesson already is the difficulty band |
| [Secret Tube](https://apps.apple.com/us/app/secret-tube-color-sort-puzzle/id1551197535) / [Unlock Tubes](https://apps.apple.com/app/id1545798801) | Hidden colours and locked tubes as whole products | Both, as single lessons rather than whole games | Building a separate app around one twist |

Two things stand out. **The extra tube is the genre's signature help** and it is a better hint
than anything generic: it eases the constraint without naming a move, so the child still solves
it. And a third-party [solver site](https://chromaoracle.com/water-sort-puzzle-solver) exists,
advertising a mystery mode for hidden colours — people reach for solvers because shipped racks
can be brutal or unsolvable. Reverse-generation is the answer to that, and it is the one place
this design should be plainly better than the market rather than equal to it.


## What it teaches, and why it is worth building

A pour is trivially understood and the plan behind it is not, which is the whole
value. The child must look several moves ahead, keep a goal in mind while doing
something else, and notice a dead end before reaching it. Nothing else in the
catalog asks for that: counting, addition and subtraction all reward a correct
step, and observation rewards a correct look. This is the first skill where a
*sequence* is the answer.

`standards: []` throughout. It is not a mathematics standard, and the number and
fraction levels borrow existing arithmetic keys rather than claiming new ones.

## The core loop

1. A rack of tubes holds coloured segments; each colour also carries its own
   **shape**, so the puzzle is never colour-alone.
2. Tap a source tube, then a destination. The top run of one colour pours if the
   destination is empty or its top matches, and there is room.
3. An illegal pour is **refused with a short reason** — "that tube is full",
   "those colours do not match" — and is not an answer and not a hint.
4. Solving the rack is one correct submission.
5. A deadlock — no legal pour and not solved — is one incorrect submission, and
   the rack returns to its starting state.

### Scoring contract

One rack is one scored question, exactly as one scene is in Observation.

- Legal pours change local state only.
- Undo and reset are `round.useSupport`, not attempts. A child exploring is not
  a child answering wrongly, and recording it as an error would teach them to
  stop exploring.
- `expected` is the rack's canonical solved signature; `given` is the final
  arrangement.
- Teaching rounds are 3 racks. Practice is 5.

Refusing an illegal move rather than scoring it follows
[SKILL_DEVELOPMENT §4](SKILL_DEVELOPMENT.md#4-interaction-and-accessibility): a
refused intermediate move explains itself without submitting an answer.

## Generation, and the one invariant that matters

**Every rack must be solvable, and solvability must be structural rather than
checked.** Generate backwards: start from the solved state and apply random
*reverse* pours. Any state reachable that way has a solution — the moves that
made it, run backwards — so no generated puzzle can be impossible.

Difficulty is then the number of reverse pours and the free space left, not
randomness. For racks this small an exact minimum-solution length is computable
by breadth-first search, so a lesson can assert "solvable in ≤ n" rather than
hope.

Invariants to prove over 200 draws per lesson:

1. every rack is solvable, by construction and by search;
2. colour counts are exact multiples of a full tube;
3. no rack begins solved;
4. free space matches the lesson's constraint;
5. minimum solution length falls inside the lesson's band;
6. every colour is distinguishable without colour — shape included;
7. a rack reproduces from params and index.

## Complete technique set

Three tiers. The first is what makes it recognisably the game; skipping any of it makes a
worse version of something a child has already played. The second is what other products
built whole apps around. The third is what makes it a Koda skill rather than a clone.

### Tier 1 — genre standard, non-negotiable

| Technique | Rule |
|---|---|
| Capacity four | The genre default. Mixed capacity is a variation on it, not a replacement |
| Whole-run pour | Every consecutive segment of the top colour moves together, space permitting |
| Tap source, tap target | One-tap selection; tapping the picked tube puts it down |
| Refusal, not penalty | An illegal pour explains itself and scores nothing |
| Undo | Step back one pour, recorded as support |
| Reset | Return to the dealt rack, free, recorded as support |
| **Extra tube** | An empty tube, granted as the last hint rung |
| No timer | Nothing anywhere is timed |
| Non-colour mark | Every colour carries a shape; the shape is the accessible name |
| Endless racks | The generator is infinite; 33 lessons are the taught path, not the content limit |

### Tier 2 — variants other products shipped as whole games

| Technique | The rack | What it forces |
|---|---|---|
| Hidden depths | lower segments unseen until uncovered | act on partial information, then revise |
| Locked tube | opens only when another tube is completed | order the plan, not just the moves |

### Tier 3 — Koda's own, where the teaching lives

| Technique | The rack | What it forces |
|---|---|---|
| Mixed capacity | tubes hold 3, 4 or 5 | read capacity before pouring, not after |
| One-way tube | receives but never pours | recognise a move you cannot take back |
| Move budget | solve within *n* pours | prefer the shorter plan |
| Numbered segments | sort ascending or descending | order, not just match |
| Fraction segments | ½, ¾, ⅓ … sorted by value | compare fractions by size |
| Skip-count target | build 2, 4, 6, 8 | a sequence as the goal |
| Target pattern | finish as a named order, not uniform tubes | reproduce a sequence, not just group |
| Linked tubes | two tubes fill together | reason about a side effect |
| **Predict the pour** | no touching; choose the picture that results | simulate a move mentally |

`predict-the-pour` has no equivalent in any product examined, and it trains the skill every
other level only rewards. It is also the cheapest to build: no pouring, one tap.

### The hint ladder

The genre's own supports are better rungs than generic prose, so the ladder uses them:

1. "Look for a tube you could empty completely." — strategy, no rack knowledge
2. "Tube 3 has somewhere to go." — names a source, not a destination
3. **An extra tube appears** — eases the constraint, still does not name a move

Each rung is `round.useSupport`. Practice passes no hints. The extra tube is deliberately last:
it changes the puzzle, and a child who reaches for it has still solved what remains.

## Lesson map

33 lessons: 30 teaching, 3 practice. Local `params.level` is contiguous from 1.

| L | Lesson id | conceptKey | Rack | Technique |
|---:|---|---|---|---|
| 1 | `one-pour` | `pourer` | 2 colours, 3 tubes, 1 move | plain |
| 2 | `two-pours` | `pourer` | 2 colours, 2 moves | plain |
| 3 | `use-the-empty-tube` | `space-maker` | 1 free tube needed | plain |
| 4 | `pour-the-whole-run` | `run-mover` | a run of 3 moves at once | plain |
| 5 | `sort-three-colours` | `colour-sorter` | 3 colours, 5 tubes | plain |
| 6 | `short-and-tall` | `capacity-reader` | heights 3 and 5 | mixed capacity |
| 7 | `will-it-fit` | `capacity-reader` | pour blocked by capacity | mixed capacity |
| 8 | `fill-to-the-top` | `exact-filler` | a tube must end exactly full | mixed capacity |
| 9 | `count-before-you-pour` | `run-counter` | states how many will move | plain |
| 10 | `practice-pouring` | `colour-sorter` | 5 racks, L3–9 | practice |
| 11 | `four-colours` | `colour-sorter` | 4 colours, 6 tubes | plain |
| 12 | `one-space-left` | `space-planner` | exactly one free slot | plain |
| 13 | `no-free-tube` | `space-planner` | space must be made | plain |
| 14 | `the-locked-tube` | `order-planner` | opens on a completed tube | locked tube |
| 15 | `two-locks` | `order-planner` | chained unlocks | locked tube |
| 16 | `the-one-way-tube` | `irreversible-mover` | receive-only tube | one-way |
| 17 | `think-before-you-pour` | `move-budgeter` | budget = minimum + 2 | move budget |
| 18 | `the-shortest-way` | `move-budgeter` | budget = minimum | move budget |
| 19 | `practice-planning` | `space-planner` | 5 racks, L11–18 | practice |
| 20 | `what-is-underneath` | `hidden-state-reasoner` | bottom layer hidden | hidden depths |
| 21 | `reveal-as-you-go` | `hidden-state-reasoner` | reveals on uncover | hidden depths |
| 22 | `guess-the-result` | `pour-predictor` | choose the resulting rack | predict |
| 23 | `guess-two-ahead` | `pour-predictor` | two pours, then choose | predict |
| 24 | `sort-by-number` | `order-builder` | numbered segments, ascending | numbered |
| 25 | `sort-backwards` | `order-builder` | descending | numbered |
| 26 | `odd-and-even-tubes` | `parity-sorter` | odds one tube, evens another | numbered |
| 27 | `sort-by-size` | `fraction-comparer` | ½ ¾ ⅓ by value | fractions |
| 28 | `count-by-twos` | `skip-counter` | build a skip-count sequence | numbered |
| 29 | `make-the-rainbow` | `pattern-builder` | a named order, not uniform | target pattern |
| 30 | `linked-tubes` | `side-effect-reasoner` | two tubes fill together | linked |
| 31 | `mixed-racks` | `independent-planner` | cycles every technique | mixed |
| 32 | `the-long-rack` | `independent-planner` | 6 colours, 8 tubes, 2 rows | mixed |
| 33 | `practice-bottle-sort` | `independent-planner` | 5 racks, all techniques | practice |

`skip-counter` already exists in counting and is reused deliberately; the rest
are new and collide with nothing in the four shipped skills.

## Layout

Measured against the 44px floor at 360px, with a 316px content width:

```
4 tubes/row  73px   5 tubes/row  57px   6 tubes/row  46px
7 tubes/row  38px  — under the floor
```

**Six tubes per row is the hard ceiling on a phone.** Level 32's eight tubes wrap
to two rows of four; a tube is a single tap target, so a narrower tube is a
missed pour, not a smaller picture. Segments are drawn tall rather than wide so a
tube stays legible as it narrows.

## Accessibility

Colour never carries meaning alone: every colour has a paired shape, and the
shape is what the accessible name reports ("tube 3, two circles on two stars").
Keyboard: arrow keys move between tubes, Enter selects source then destination,
Escape cancels a selection. A refused pour announces its reason through the
polite live region rather than only as a visual shake.

## Voice

About 30 clips. Fixed phrases for the refusals ("That tube is full.", "Those do
not match."), the hint ladder, and the completion line; per-lesson `audioPrompt`;
the shared correct and incorrect reaction groups. No per-colour recordings —
the shape name is on screen and speaking it on every pour would be noise.

## Delivery

Build the pour engine, its generator and a behaviour driver first, with Levels
1–5 and the reverse-generation invariant proved before any technique is added.
Then take techniques in the order of the lesson map — each is a parameter, and
each should ship with the test that proves it changes the rack.

`predict-the-pour` (L22–23) is a second activity, not a mode: it does not pour,
and its answer is a choice among pictures. Everything else is one engine.

Status stays `draft` until the voice plan reports 0 missing and a device pass is
done, as with every other skill.
