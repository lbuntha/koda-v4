# Subtraction — proposed build plan

**Skill id:** `subtraction` · **Ages:** 5–9 · **Category:** `operations` ·
**52 teaching techniques + 11 practice lessons on 11 activity engines.**

This proposal follows the executable shape of `ADDITION_BUILD_PLAN.md`, updated for
the contracts the finished Addition skill now demonstrates: worksheets are part of
every engine, practice ships from the start, features need behaviour tests, and course
placement has its own invariant test.

> **Reference skills:** read `src/skills/counting/` and `src/skills/addition/` before
> implementation. Copy their public shape and kit usage, not their activity bodies.

---

## Status — Phases 0–14 complete; publishing is the one step left

Built 2026-09-03/04. All **63 lessons** (52 teaching + 11 practice) are registered
across **eleven engines**, in course units u22–u37, and the gate is green: lint,
**92 test files / 1,369 tests**, and the production build.

| Engine | Activity | Modes | Levels |
|---|---|---|---|
| `RemoveTray` | `tray` | 10 | 1–10, 53 |
| `FrameTakeaway` | `frames` | 4 | 11–12, 20–21, 54 |
| `BondHouse` | `bonds` | 3 | 13, 43–44, 55 |
| `DifferenceLine` | `numberline` | 8 | 14–16, 22–23, 25–26, 31, 57 |
| `FactDeck` | `facts` | 4 | 17–19, 24, 56 |
| `BlockExchange` | `base10` | 5 | 27, 29–30, 36–37, 58 |
| `PlaceValueDesk` | `chart` | 5 | 28, 32–35, 59 |
| `ColumnPad` | `column` | 3 | 38–40, 60 |
| `EstimateDial` | `estimate` | 2 | 41–42, 61 |
| `StoryBoard` | `story` | 7 | 45–51, 62 |
| `StrategyPicker` | `strategy` | 1 | 52, 63 |

`audio/manifest.json` is `{}` and every line plays through live TTS, exactly as §7
requires; `subtraction.voice.test.ts` proves the inventory declares each fixed spoken
line and duplicates no lesson prompt.

### Phase 15 is deliberately not done

`manifest.json` still reads `"status": "draft"`. §0.4 makes publishing conditional on the
mobile/theme pass, and two engines have not had it: **`EstimateDial` and
`StrategyPicker` were never opened at 360px** — the signed-in session on
`localhost:3001` ended before they could be checked, and signing back in is not
something this build should do on the owner's behalf. Both are plain choice-button
layouts of a shape already verified elsewhere, and both have behaviour tests, but that
is an argument, not the pass the plan asks for.

Publishing is then one line in `manifest.json`, a `npm run skills:seed`, and the gate.

### What the phases caught

Each JSON-only phase is an architecture check and each 360px pass is a second one.
Between them they found twelve defects that a green suite did not:

1. **`known_fact` printed the answer on a button** (P4) — the choices included the target
   fact itself. Now one one-step helper plus three true facts that are neither helpers
   nor equal to the difference.
2. **A fact family could be built from equal parts** (P4), writing the same two equations
   twice. `DifferenceSpec.distinctParts` refuses that draw.
3. **A draft skill ignored the Skill Manager's off switch** (P4). `hiddenReason` returned
   early for drafts. `subtraction.course.test.ts` — the §0.3 invariant test, missing
   until then — now proves it.
4. **The family answer boxes stretched their row** (P4, 360px only). `themeSystem.field()`
   carries its own `w-full`, which beats a `w-16` passed after it.
5. **Levels 20–21 had no lesson to teach** (P5). §2 says the child answers before the
   frame reveals the partner; the engine let them tap the counters out, which is levels
   11–12 again. `isRecall` modes now ask first and confirm after.
6. **The number line clipped its own labels** (P5, 360px only) — "0" as ")" and "200" as
   "2C". The viewBox is padded as the printed figure always was, and a start label
   crowded by a landmark tick drops to a second row.
7. **Arrowheads resolved `currentColor` against the `<defs>`** (P5) so every head was
   ink-coloured instead of matching its arc, at a size that swallowed a short jump's
   label.
8. **The owed exchange was measured against the wrong number** (P6) — the original
   subtrahend rather than what is left to take, so a finished trade round would not
   accept an answer.
9. **Base-ten blocks were flat colour in one wrapping row** (P6, 360px only). A flat has
   to *be* a hundred squares; blocks are now scored 1:10:100 and grouped by place.
10. **A reason string contained the field separator** (P12). `expected` joins verdict and
    reason with a comma, and one reason had a comma in it, so a right answer compared a
    half-reason against a whole one.
11. **`place-value-builder` was taught but not declared** (P14) — caught by the manifest
    audit, not by anything a child would see.
12. **Comparison bars drew the same length** (P14, 360px only). As direct flex items
    their percentage widths were shrunk back to the row, so 35 and 38 looked identical —
    a comparison model showing the opposite of its point.

The lesson inventory, engine boundaries, and later phase order remain the proposed
contract. Change the master table first whenever implementation reveals a necessary
adjustment.

### The design in one sentence

Teach subtraction through three meanings — **take away**, **compare distance**, and
**find a missing part** — then connect those meanings to facts,
place value, regrouping, written algorithms, estimation, and stories.

Subtraction is not Addition with a minus sign. In particular:

- order matters: `a − b` is generally not `b − a`;
- this age band stays in whole numbers, so every generated question has `a ≥ b`;
- counting back is useful for a small subtrahend, while counting up is usually better
  for a small difference;
- regrouping must be shown as an exchange that preserves value, never as a digit
  mysteriously becoming larger;
- story type determines the unknown. Keywords such as “left” and “more” do not.

---

## 0. Pre-flight

### 0.1 Establish the current baseline

The Addition plan records migration errors that no longer describe this repository.
Capture a fresh baseline immediately before Phase 0:

```bash
npm run lint
npm test
npm run build
```

Every phase must leave all three green. Do not preserve an old known-red baseline in a
new skill plan.

### 0.2 Files outside the skill folder

The build should touch only:

1. `src/skills/registry.ts` — one import and one array entry;
2. `src/curriculum/course.json` — teaching and practice units appended after `u21`;
3. `src/assets/svg/thumbnail/subtraction.svg`, generated SVG ids, and the generated
   server seed files produced by the normal scripts.

No subtraction activity imports from `addition/`. If both skills need the same purely
visual primitive, extract that primitive to `src/skills/kit/manipulatives/` with tests;
do not move arithmetic state or question generation into the shared kit.

### 0.3 Two level numbers still exist

`params.level` is subtraction's contiguous `1..63` order. The level shown in the Learn
course is the lesson's position across `course.json`. Append the entire subtraction
block; never interleave it with an existing skill. A course test must prove that every
subtraction lesson appears once, in skill order, in one unbroken block.

### 0.4 Visibility while building

Keep the manifest at `status: "draft"` through Phase 14. Preview lessons through the
Skill Manager, use a developer viewer aged 9 for the later age bands, and publish only
after the complete mobile/theme/feature pass.

---

## 1. Architecture — 11 interactions, not 52 components

An engine owns one thing the child's finger does. A lesson configures its mode and
number range in JSON. No engine branches on `params.level`.

| # | Engine | Activity id | Primary interaction | Teaching levels |
|---|---|---|---|---|
| A | `RemoveTray` | `tray` | Remove, separate, match, and connect actions to equations | 1–10 |
| B | `FrameTakeaway` | `frames` | Remove counters from a five- or ten-frame | 11–12, 20–21 |
| C | `BondHouse` | `bonds` | Fill the missing whole or part in a number bond/equation | 13, 43–44 |
| D | `DifferenceLine` | `numberline` | Make backward jumps or count up to measure a gap | 14–16, 22–23, 25–26, 31 |
| E | `FactDeck` | `facts` | Recall or derive a subtraction fact from a related fact | 17–19, 24 |
| F | `BlockExchange` | `base10` | Remove blocks and exchange a larger unit downward | 27, 29–30, 36–37 |
| G | `PlaceValueDesk` | `chart` | Work by place in H/T/O columns | 28, 32–35 |
| H | `ColumnPad` | `column` | Enter result digits and recorded exchanges right to left | 38–40 |
| I | `EstimateDial` | `estimate` | Round, estimate, and judge reasonableness | 41–42 |
| J | `StoryBoard` | `story` | Build a removal/comparison bar model and solve its unknown | 45–51 |
| K | `StrategyPicker` | `strategy` | Choose and compare valid solution paths | 52 |

Each engine also receives one mixed, unscaffolded practice lesson at levels 53–63.
Practice cycles through named modes with `params.question.practice: true`; it does not
randomly sample modes, offer hints, speak on open, or show a read-aloud control.

### Why subtraction owns these engines

Addition's frames fill, its blocks bundle upward, and its number line predominantly
jumps forward. Subtraction removes, compares, and exchanges downward. Sharing the
render-only frame grid or base-ten block is sensible; sharing the whole activity would
couple telemetry, hints, validation, feature settings, and incorrect-state handling.

---

## 2. Master teaching table

Every `Numbers` rule is enforced by `subtractionNumbers.ts`. “No regroup” means every
top digit is at least the corresponding bottom digit. Unless a row explicitly teaches
zero, generators exclude trivial `0 − 0` and duplicate questions within a round.

| L | Technique | Lesson id | Engine · mode | conceptKey | Numbers / answer | Standards | Age |
|---|---|---|---|---|---|---|---|
| 1 | Take objects away | `take-away` | tray · `remove` | `remover` | whole 2–10; remove 1…whole−1; tap removed objects, answer remainder | K.OA.A.1 | 5–6 |
| 2 | Count what remains | `count-what-remains` | tray · `remainder` | `remainder-counter` | whole 3–10; some already removed; tap only remaining objects | K.OA.A.1 | 5–6 |
| 3 | Separate a part | `separate-a-part` | tray · `separate` | `separator` | whole 3–10; move named part to a second space | K.OA.A.1, K.OA.A.3 | 5–6 |
| 4 | Match groups to compare | `compare-by-matching` | tray · `match_groups` | `comparer` | groups 2–10, unequal; pair items, answer unmatched count | K.CC.C.6, 1.OA.A.1 | 5–7 |
| 5 | Connect an action to an equation | `read-subtraction-equations` | tray · `equation_match` | `subtraction-equation-reader` | whole≤10; shown start/removed/remainder; choose matching `a−b=c` | K.OA.A.1 | 5–7 |
| 6 | Count back | `count-back` | tray · `count_back` | `count-back` | a 4–15, b 1–3; tap b countdown steps | 1.OA.C.5 | 5–7 |
| 7 | Subtract zero | `subtract-zero` | tray · `subtract_zero` | `subtract-zero` | a 0–20, b=0 | 1.OA.C.6 | 5–7 |
| 8 | Subtract all | `subtract-all` | tray · `subtract_all` | `subtract-self` | a 1–20, b=a | 1.OA.C.6 | 5–7 |
| 9 | Subtract one | `subtract-one` | tray · `subtract_one` | `previous-number-subtractor` | a 1–20, b=1 | 1.OA.C.5, 1.OA.C.6 | 5–7 |
| 10 | Use fingers | `use-fingers` | tray · `fingers` | `finger-subtractor` | a≤10, b≤a; lower b raised fingers | *(trajectory)* | 5–7 |
| 11 | Use a five-frame | `five-frame` | frames · `five` | `five-benchmark` | a≤5, b≤a; remove b, answer remainder | K.OA.A.5 | 5–6 |
| 12 | Use a ten-frame | `ten-frame` | frames · `ten` | `ten-frame-subtractor` | a≤10, b≤a | 1.OA.C.6 | 5–7 |
| 13 | Find a missing part with bonds | `number-bonds` | bonds · `part_unknown` | `part-whole-decomposer` | whole≤10, one part shown, other part blank | K.OA.A.3, 1.OA.B.4 | 5–7 |
| 14 | Move back on a number path | `number-path-back` | numberline · `path_back` | `backward-number-path` | a≤20, b≤9 | 1.OA.C.5 | 5–7 |
| 15 | Subtract on an open number line | `open-number-line-back` | numberline · `open_back` | `subtraction-number-line` | a 20–100, b 2–29 | 2.NBT.B.5 | 7–9 |
| 16 | Count up to find the difference | `count-up-for-difference` | numberline · `count_up` | `difference-finder` | b<a≤100, difference 1–10 | 1.OA.B.4, 2.NBT.B.5 | 6–8 |
| 17 | Use fact families | `fact-families` | facts · `family` | `fact-family` | parts 1–9, whole≤18; fill four facts once | 1.OA.B.4 | 6–8 |
| 18 | Think addition | `think-addition` | facts · `missing_addend` | `missing-addend` | a−b within 20; choose `b + ? = a`, then answer | 1.OA.B.4, 1.OA.D.8 | 6–8 |
| 19 | Use doubles to subtract | `subtract-with-doubles` | facts · `doubles` | `doubles-knower` | `2n−n`, n 2–10 | 1.OA.C.6 | 6–8 |
| 20 | Recall subtraction facts from 5 | `subtract-from-5` | frames · `from_five` | `five-benchmark` | answer 5−b before the frame reveals the partner | K.OA.A.5 | 5–7 |
| 21 | Recall subtraction facts from 10 | `subtract-from-10` | frames · `from_ten` | `make-ten` | answer 10−b before the frame reveals the partner | K.OA.A.4, 1.OA.C.6 | 5–7 |
| 22 | Bridge through 10 | `bridge-through-10` | numberline · `bridge_ten` | `bridging-ten` | a 11–19, b crosses 10, result 1–9 | 1.OA.C.6 | 6–8 |
| 23 | Bridge through 100 | `bridge-through-100` | numberline · `bridge_hundred` | `bridging-hundred` | a 101–199, b crosses 100 | 2.NBT.B.7 | 7–9 |
| 24 | Use a known fact | `use-a-known-fact` | facts · `known_fact` | `known-fact-user` | target derived ±1 from a fact within 20 | 1.OA.C.6 | 6–8 |
| 25 | Subtract a friendly number, then adjust | `compensation` | numberline · `compensate_subtrahend` | `compensator` | b ends in 8 or 9; subtract next ten, then add back 1 or 2 | 2.NBT.B.5, 2.NBT.B.9 | 7–9 |
| 26 | Keep the same difference | `constant-difference` | numberline · `constant_difference` | `constant-difference` | awkward a−b; add same k to both to make b a ten | 2.NBT.B.5, 2.NBT.B.9 | 7–9 |
| 27 | Use base-ten blocks | `base-ten-blocks` | base10 · `build_subtract` | `base-ten-subtractor` | two-digit, no regroup | 2.NBT.B.5 | 6–8 |
| 28 | Use a place-value chart | `place-value-chart` | chart · `chart_subtract` | `place-value-builder` | two-digit, no regroup | 2.NBT.B.5 | 6–8 |
| 29 | Subtract multiples of 10 | `subtract-multiples-of-10` | base10 · `multiples_ten` | `tens-subtractor` | multiples of 10 within 100 | 1.NBT.C.6 | 6–8 |
| 30 | Subtract multiples of 100 | `subtract-multiples-of-100` | base10 · `multiples_hundred` | `hundreds-subtractor` | multiples of 100 within 1000 | 2.NBT.B.8 | 7–9 |
| 31 | Subtract tens, then ones | `subtract-tens-then-ones` | numberline · `jump_tens_ones` | `backward-jump-strategy` | two-digit, no regroup | 2.NBT.B.5 | 7–9 |
| 32 | Subtract hundreds, tens, and ones | `subtract-hundreds-tens-ones` | chart · `chart_three` | `place-value-builder` | three-digit, no regroup | 2.NBT.B.7 | 7–9 |
| 33 | Use expanded form | `expanded-form` | chart · `expanded` | `expanded-form-subtractor` | 2–3 digits, no regroup | 2.NBT.A.3, 2.NBT.B.7 | 7–9 |
| 34 | Check subtraction with addition | `check-with-addition` | chart · `check_addition` | `subtraction-checker` | solve a−b, then verify `difference+b=a`; two digits | 2.NBT.B.5, 2.NBT.B.9 | 7–9 |
| 35 | Subtract left to right | `left-to-right` | chart · `left_right` | `left-to-right-subtractor` | two-digit, no regroup in v1 | 2.NBT.B.5, 2.NBT.B.9 | 8–9 |
| 36 | Exchange 1 ten for 10 ones | `exchange-one-ten` | base10 · `trade_ten` | `unbundler-ten` | ones(top)<ones(bottom), tens(top)>0 | 2.NBT.B.7 | 6–8 |
| 37 | Exchange 1 hundred for 10 tens | `exchange-one-hundred` | base10 · `trade_hundred` | `unbundler-hundred` | tens(top)<tens(bottom), hundreds(top)>0 | 2.NBT.B.7 | 7–9 |
| 38 | Use the vertical algorithm | `standard-algorithm` | column · `standard` | `standard-subtraction-algorithm` | 2–3 digits, exactly one exchange | 2.NBT.B.7, 3.NBT.A.2 | 7–9 |
| 39 | Use cascading regrouping | `cascading-regrouping` | column · `cascade` | `subtraction-cascading-regrouper` | three digits, two exchanges | 3.NBT.A.2 | 8–9 |
| 40 | Regroup across zero | `regroup-across-zero` | column · `across_zero` | `zero-regrouper` | e.g. 402−185; exchange through a zero | 3.NBT.A.2 | 8–9 |
| 41 | Estimate by rounding | `estimate-by-rounding` | estimate · `round_estimate` | `rounding-estimator` | 2–3 digits; neither operand already rounded | 3.NBT.A.1 | 8–9 |
| 42 | Check whether an answer is reasonable | `is-it-reasonable` | estimate · `reasonable` | `reasonableness-checker` | real difference plus plausible/implausible claim | 3.OA.D.8 | 8–9 |
| 43 | Find the missing subtrahend | `missing-subtrahend` | bonds · `subtrahend_unknown` | `missing-subtrahend` | a−□=c, values≤20 | 1.OA.D.8 | 6–8 |
| 44 | Find the missing minuend | `missing-minuend` | bonds · `minuend_unknown` | `missing-minuend` | □−b=c, values≤20 | 1.OA.D.8 | 7–9 |
| 45 | Model take-away, result unknown | `take-away-result-unknown` | story · `remove_result` | `removal-result-modeler` | start≤50, change<start | 1.OA.A.1, 2.OA.A.1 | 6–8 |
| 46 | Model take-away, change unknown | `take-away-change-unknown` | story · `remove_change` | `removal-change-modeler` | start and result known | 1.OA.A.1, 2.OA.A.1 | 7–9 |
| 47 | Model take-away, start unknown | `take-away-start-unknown` | story · `remove_start` | `removal-start-modeler` | change and result known | 1.OA.A.1, 2.OA.A.1 | 7–9 |
| 48 | Model comparison, difference unknown | `compare-difference-unknown` | story · `compare_difference` | `comparison-difference-modeler` | both quantities known, each≤50 | 1.OA.A.1, 2.OA.A.1 | 6–8 |
| 49 | Model comparison, bigger unknown | `compare-bigger-unknown` | story · `compare_bigger` | `comparison-bigger-modeler` | smaller and difference known | 1.OA.A.1, 2.OA.A.1 | 7–9 |
| 50 | Model comparison, smaller unknown | `compare-smaller-unknown` | story · `compare_smaller` | `comparison-smaller-modeler` | bigger and difference known | 1.OA.A.1, 2.OA.A.1 | 7–9 |
| 51 | Solve multi-step problems | `multi-step-problems` | story · `multi_step` | `subtraction-multi-step-solver` | two operations, addition/subtraction mix, nonnegative throughout | 3.OA.D.8 | 8–9 |
| 52 | Explain and compare strategies | `explain-and-compare` | strategy · `compare_paths` | `subtraction-strategy-chooser` | tagged problem pool; accept every genuinely fitting strategy | 2.NBT.B.9, 3.NBT.A.2 | 8–9 |

In `lessons.json`, standards use full ids such as `CCSS.1.OA.C.6`. Level 10 carries
`standards: []` plus a `trajectoryLevel`, matching the contract used by Addition's
finger lesson.

### 2.1 Concept-key reuse

Reuse a key only when practice should update the same mastery record, not merely because
the drawings look alike.

| Existing key | Reused at | Why it is the same concept |
|---|---|---|
| `five-benchmark` | 11, 20 | five remains the visual anchor |
| `make-ten` | 21 | complements of ten are the same relationship |
| `part-whole-decomposer` | 13 | the whole and its two parts are unchanged |
| `comparer` | 4 | one-to-one matching is counting's comparison |
| `fact-family` | 17 | the same four related equations |
| `missing-addend` | 18 | subtraction is solved as `part + ? = whole` |
| `doubles-knower` | 19 | the known double supplies the fact |
| `bridging-ten` / `bridging-hundred` | 22–23 | crossing the place-value boundary is the concept |
| `known-fact-user` | 24 | derive an unknown fact from a known one |
| `compensator` | 25 | round one operand, operate, then undo that adjustment |
| `place-value-builder` | 28, 32 | digits keep their place-value meaning |
| `rounding-estimator` | 41 | same rounding competence |
| `reasonableness-checker` | 42 | same magnitude judgement |

Do **not** reuse `unitiser-ten` for exchanging one ten into ten ones: composing and
decomposing a unit are related but observably different skills. The new keys
`unbundler-ten` and `unbundler-hundred` keep those records honest.

### 2.2 Manifest prerequisites

Proposed `manifest.requires`:

```json
[
  "counter", "corresponder", "comparer", "five-benchmark", "make-ten",
  "part-whole-decomposer", "place-value-builder", "fact-family",
  "doubles-knower", "unitiser-ten", "unitiser-hundred"
]
```

Lesson-level `requires` should name only one or two genuine prerequisites taught by the
manifest or at a lower subtraction level. Subtraction depends on Addition conceptually,
but do not put every Addition key in the manifest merely to make contract tests pass.

### 2.3 Practice lesson order

Practice is part of the initial contract, not an unnumbered appendix:

| L | Lesson id | Engine | Modes |
|---|---|---|---|
| 53 | `practice-tray` | tray | remove, remainder, separate, match/equation, count_back, rule modes |
| 54 | `practice-frames` | frames | five, ten, from_five, from_ten |
| 55 | `practice-bonds` | bonds | all three unknown positions |
| 56 | `practice-facts` | facts | family, missing_addend, doubles, known_fact |
| 57 | `practice-numberline` | numberline | path/open back, count up, bridge, compensation, constant difference |
| 58 | `practice-base10` | base10 | no-regroup, multiples, and exchange modes |
| 59 | `practice-chart` | chart | chart, expanded, check_addition, left-to-right |
| 60 | `practice-column` | column | standard, cascade, across_zero |
| 61 | `practice-estimate` | estimate | round_estimate, reasonable |
| 62 | `practice-story` | story | all seven story modes |
| 63 | `practice-strategy` | strategy | compare_paths |

Each practice lesson keeps a concept key already taught by that engine. It does not
invent a `practice-*` mastery concept.

---

## 3. Folder layout

```text
src/skills/subtraction/
  manifest.json
  lessons.json
  voice.json
  audio/manifest.json
  index.ts
  subtraction.test.ts
  subtraction.activities.test.tsx
  subtraction.hints.test.ts
  subtraction.numbers.test.ts
  subtraction.features.test.tsx
  subtraction.course.test.ts
  subtraction.practice.test.tsx
  subtraction.figures.test.tsx
  subtraction.manifest.test.ts
  assets/
  internal/data/
    subtractionNumbers.ts
    subtractionLayout.ts
    subtractionPalette.ts
    subtractionAssets.ts
    strategyCards.ts
    storyCast.ts
  activities/
    RemoveTray.tsx
    FrameTakeaway.tsx
    BondHouse.tsx
    DifferenceLine.tsx
    FactDeck.tsx
    BlockExchange.tsx
    PlaceValueDesk.tsx
    ColumnPad.tsx
    EstimateDial.tsx
    StoryBoard.tsx
    StrategyPicker.tsx
```

Every activity definition in `index.ts` supplies a playable `defaultParams` and a
worksheet adapter (`build`, `prompt`, `printed`, `method`, and `figure` where the model
matters). Printed questions must preserve the unknown's position; a worksheet that
turns `□ − 7 = 5` into `12 − 7 = □` changes the lesson.

---

## 4. `subtractionNumbers.ts` — the arithmetic contract

All randomness enters through this module. Activities never invent their own operands.

```ts
export type ExchangeMode = "never" | "ones" | "tens" | "both" | "across_zero" | "any";

export interface DifferenceSpec {
  minuendRange?: [number, number];
  subtrahendRange?: [number, number];
  differenceRange?: [number, number];
  exchange?: ExchangeMode;
  multipleOf?: 10 | 100;
  smallSubtrahend?: boolean;
  smallDifference?: boolean;
  crossBoundary?: 10 | 100;
  excludeEqual?: boolean;
}

export interface Difference {
  minuend: number;
  subtrahend: number;
  difference: number;
}

export function drawDifference(spec: DifferenceSpec): Difference;
export function drawConstantDifference(spec: DifferenceSpec): Difference & { offset: number };
export function drawSubtractionStory(kind: StoryKind, spec: StorySpec): StoryNumbers;
export function digitsOf(value: number): { hundreds: number; tens: number; ones: number };
export function exchangesIn(a: number, b: number): ExchangeStep[];
export function withoutRepeat<T>(draw: () => T, key: (value: T) => string, seen: Set<string>): T;
```

Non-negotiable properties:

1. `minuend ≥ subtrahend ≥ 0`; negative results are outside this skill.
2. `difference === minuend − subtrahend` is stored on every question and becomes
   `expected: String(difference)` unless the prompt asks for another unknown.
3. Exchange constraints describe the actual digit process, including propagation
   through zero. They are property-tested over at least 200 draws per lesson spec.
4. Generate/filter uses a bounded retry and constructive fallback. No unbounded loop.
5. Count-back specs keep the subtrahend small; count-up specs keep the difference
   small. Random numbers must reinforce the named strategy.
6. Constant difference changes **both** operands by the same offset and asserts
   `(a + k) − (b + k) === a − b`.
7. Every round rejects repeated operand/unknown-position combinations.

---

## 5. Engine behaviour

All movement uses tap-source, tap-destination. Removed items stay visible in a muted
“taken away” area or with a strike mark, so the child can audit what changed. Undo is
available before Check and does not count as support.

### A. `RemoveTray` — `tray`

- `remove`: child taps exactly the named number of objects, then counts the remainder.
- `remainder`: objects are already moved aside; child taps only what remains.
- `separate`: tap objects, then the second space; the two parts remain visible.
- `match_groups`: pair one item from each row; the unpaired tail is the difference.
- `equation_match`: the acted-out start, removed part, and remainder stay visible while
  the child selects the one equation whose operand roles match them.
- `count_back`: each tap removes one object and speaks the next lower number.
- `subtract_zero`, `subtract_all`, `subtract_one`: rule lessons use a pad/choices after
  a minimal visual; large groups become numeral tiles.
- `fingers`: start with the minuend raised and lower the subtrahend.

A Check before the required number is removed is refused, not scored. Removing too many
is prevented as an illegal move, not filed as a wrong arithmetic answer.

### B. `FrameTakeaway` — `frames`

`five`, `ten`, `from_five`, and `from_ten` share one grid, and `expected` is always the
remainder, never the count removed. They differ in *when* the frame moves:

- `five` and `ten` **build** the answer. The minuend starts filled and the child taps
  counters out; removed cells preserve a faint mark so “started with” and “left” are
  both visible.
- `from_five` and `from_ten` **check** it. The frame is a picture, not a control: the
  child states the fact from memory and the counters are crossed out afterwards to
  confirm the partner. Making these tappable turns levels 20–21 back into levels 11–12,
  which is the failure §2 names them “Recall” to prevent.

### C. `BondHouse` — `bonds`

Modes: `part_unknown`, `subtrahend_unknown`, `minuend_unknown`. The diagram always
labels roles as whole and parts; the equation below preserves operand order. Multi-box
work submits once on Check.

### D. `DifferenceLine` — `numberline`

- `path_back` and `open_back`: start at the minuend and retain backward arcs.
- `count_up`: start at the subtrahend; forward arcs measure the difference.
- `bridge_ten` / `bridge_hundred`: first land exactly on the boundary, then continue.
- `compensate_subtrahend`: round the subtrahend up, subtract it, then add back the
  amount used to round it.
- `constant_difference`: move both endpoints by the same offset before measuring.
- `jump_tens_ones`: selected jumps may be made in either valid order.

The prompt and endpoint labels must make direction explicit. A negative-direction jump
cannot be communicated by colour alone; arcs carry a minus label and arrowhead.

### E. `FactDeck` — `facts`

- `family`: two addition and two subtraction equations; one Check.
- `missing_addend`: choose the related addition equation, then answer subtraction.
- `doubles`: expose the known `n+n=2n` before asking `2n−n`.
- `known_fact`: choose a valid helper fact, then adjust once.

Choosing a helper is a walkthrough support, not an extra scored question. Setting
`answerInput: pad | choices` is read here and anywhere else that offers both.

### F. `BlockExchange` — `base10`

The minuend starts built, and a tap takes one block away. The exchange is a named
control ("Break 1 ten into 10 ones") rather than the tap-rod-then-tap-area gesture this
section first proposed: a tap on a rod cannot mean both "take this away" and "break this
apart", and removal has to stay one tap to match every other engine in the skill.
`trade_ten` opens a rod into ten units; `trade_hundred` opens a flat into ten rods. The total value before and after exchange is invariant and tested.
An unperformed required exchange refuses Check with a state-specific message.

### G. `PlaceValueDesk` — `chart`

Modes: `chart_subtract`, `chart_three`, `expanded`, `check_addition`, `left_right`.
Every numeric input uses `themeSystem.field()` and `inputMode="numeric"`.
`check_addition` keeps the original subtraction visible, asks the child to add the
difference and subtrahend, and accepts the check only when it reconstructs the minuend.
Left-to-right questions keep each place subtraction nonnegative in v1; signed partials
belong to a later integer skill.

### H. `ColumnPad` — `column`

Digits are entered right to left. Exchanges are written as crossed-out old value plus
new value; do not use a tiny unexplained “borrow 1” mark. `standard` has one exchange,
`cascade` has two, and `across_zero` explicitly animates `1 hundred → 10 tens → 9 tens
+ 10 ones`. A dropped exchange reports `place_value` rather than generic `unknown`.

### I. `EstimateDial` — `estimate`

`round_estimate` asks for an approximate difference and labels it “about”. `reasonable`
asks Yes/No, then a fixed reason. Wrong claims include operand reversal, missed place
value, and off-by-10/100 cases; do not generate only absurd distractors.

### J. `StoryBoard` — `story`

Removal uses one bar that shrinks or has a crossed segment. Comparison uses aligned
bars; neither group is “taken away.” Modes preserve the six unknown positions in the
master table. Story sentences live in lesson JSON as templates over a small fixed cast,
are read aloud, and never teach keyword matching. `multi_step` carries both answers in
one `expected` (`"<middle>,<final>"`) and gates the second on the first, rather than
recording two separate questions: the shared round loop counts one answer per question,
and a wrong middle amount is refused instead of scored, so a child who has combined the
two changes is stopped where the mistake is still visible.

### K. `StrategyPicker` — `strategy`

Problems are tagged with every strategy that genuinely fits. Examples:

- `83−79`: count up or constant difference;
- `64−7`: count back or bridge through 10;
- `402−185`: written regrouping across zero, not mental count-back.

Accept any tagged strategy. Then compare two correct worked paths for clarity and
number of steps; never ask a child to choose between one correct and one broken path
and call that strategy comparison.

---

## 6. Hints, feedback, and error kinds

Each engine exports a pure three-rung hint builder:

1. lesson `kidTip` — names the strategy;
2. current state — names what has been removed, remains, or needs exchanging;
3. worked next step — advances the method without replacing the whole interaction.

Use live state: “You started at 14 and made 2 of 5 jumps” is useful; “count back” after
the child has already counted up is not.

Proposed subtraction-specific `errorKind` values should use existing union members
where possible. Before adding any new value, inspect `src/skills/types.ts` and the
learning analyzer. Important classifications are:

- `reversed` when operands are swapped;
- `off_by_one` for one too many/few backward steps;
- `miscounted_items` for a mismatch between removed/remaining objects and the answer;
- `place_value` for a dropped or misapplied exchange;
- `unknown` only when no more informative classification is true.

An illegal or unfinished move is refused and does not call `submit`, open a hint, or
change first-try accuracy.

---

## 7. Voice declaration and art — no audio generation

Create `voice.json` during scaffold because `index.ts` registers its groups at import
time. Complete the script only after all lesson prompts stabilize. Lesson
`params.play.audioPrompt` values are collected automatically; do not duplicate them in
`voice.json`.

Use subtraction-scoped praise so the global phrase registry cannot play Addition or
Counting praise after a subtraction answer. The skill build writes the phrase inventory
and wires `koda.speech.say`; it does **not** run the recorder, synthesize clips, or add
generated audio assets. `audio/manifest.json` remains `{}` throughout this plan, so the
app uses live TTS until the separate audio-production pass is run by the owner.

Audio production — including its dry run, phrase-budget review, recording, generated
clips, and populated audio manifest — is explicitly outside Phases 0–15.

Ship six visually distinct local countables plus `subtraction.svg`. Palette roles:

- starting whole / minuend: violet;
- part removed / subtrahend: rose with a strike or movement cue;
- remainder / difference: emerald;
- comparison partner: sky;
- neutral structure: ink and line tokens.

Never encode “removed” as faded colour alone, and do not use amber/yellow.

---

## 8. Tests

Minimum suite:

1. `describeSkillContract(skill)` and `describeActivitySmoke(skill)`.
2. One standard-round behaviour driver per engine, reading `expected` from
   `learning.present`, never recomputing the arithmetic.
3. Generator properties: 200 draws per used spec, exact exchange shape, nonnegative
   result, constant-difference invariant, and bounded fallback.
4. Pure hint tests for untouched, partial, exchanged, and near-complete states.
5. Feature tests proving every toggle changes rendered/observable behaviour.
6. Course tests proving all 63 lessons appear exactly once, in order, as one block; and
   disabling subtraction removes all of them.
7. Practice tests: 11 lessons, one per engine, at least 100 questions total, cycling
   through every named mode, with no hints/read-aloud/opening speech.
8. Figure and worksheet tests for frame, bond, line, base-ten, chart, column, and story
   output; unknown positions and regrouping marks must survive printing.
9. Manifest tests pin identity, audience, feature ids, settings, and voice ownership.
10. Accessibility assertions: unique control names, 44px touch targets, held state not
    colour-only, and no button for a non-interactive numeral tile.

---

## 9. Course placement

Append after current `u21`; never insert subtraction before existing lessons. Teaching
uses thirteen four-lesson units, followed by three practice units.

| Unit | Title | Levels |
|---|---|---|
| u22 | Taking Away | 1–4 |
| u23 | Equations, Back, Zero, and All | 5–8 |
| u24 | One, Fingers, and Frames | 9–12 |
| u25 | Bonds, Paths, and Differences | 13–16 |
| u26 | Facts That Undo | 17–20 |
| u27 | Ten as a Bridge | 21–24 |
| u28 | Friendly Differences | 25–28 |
| u29 | Tens and Hundreds | 29–32 |
| u30 | Written Strategies | 33–36 |
| u31 | Exchanging Down | 37–40 |
| u32 | Estimate and Find the Unknown | 41–44 |
| u33 | Take-Away Stories | 45–48 |
| u34 | Comparison Stories and Strategies | 49–52 |
| u35 | Practice — Objects, Frames, Facts, and Bonds | 53–56 |
| u36 | Practice — Lines, Blocks, Charts, and Columns | 57–60 |
| u37 | Practice — Estimation, Stories, and Strategies | 61–63 |

Unit ids are correct for the current course. Recheck the tail of `course.json` before
implementation; if another skill lands first, append with the then-next ids instead of
renumbering existing units.

---

## 10. Build phases

An engine is implemented once with all modes in the master table. Later JSON-only
phases are architecture checks: if they need a new component or a level branch, the
earlier engine was under-parameterised.

| Phase | Teaching levels | New engines | Other deliverables |
|---|---|---|---|
| 0 | — | — | fresh baseline; number generator/tests; layout; palette; local SVG art |
| 1 | 1–10 | A `RemoveTray` | scaffold, manifest, registry, voice groups, structural tests, first course units |
| 2 | 11–13 | B `FrameTakeaway`, C `BondHouse` | complete all future modes now |
| 3 | 14–16 | D `DifferenceLine` | all eight line modes, including later strategy modes |
| 4 | 17–19 | E `FactDeck` | all four fact modes |
| 5 | 20–26 | none | seven JSON lessons; recall frames and number-line label fixes |
| 6 | 27–28 | F `BlockExchange`, G `PlaceValueDesk` | all block/chart modes; scored blocks grouped by place |
| 7 | 29–35 | none | seven JSON lessons; worksheet coverage expands |
| 8 | 36–40 | H `ColumnPad` | exchange lessons on blocks, three written modes |
| 9 | 41–44 | I `EstimateDial` | missing-unknown lessons on bonds |
| 10 | 45–51 | J `StoryBoard` | story templates and fixed cast |
| 11 | 52 | K `StrategyPicker` | tagged strategy metadata |
| 12 | 53–63 | none | eleven practice lessons, one per engine; practice tests |
| 13 | — | — | complete and validate the voice phrase inventory; no audio command or generated clips |
| 14 | — | — | features/settings, worksheet, art, manifest, and course audit |
| 15 | — | — | publish last after mobile/theme/manual pass |

Every phase gate:

```bash
npm run lint
npm test
npm run build
```

Also open every new engine in the running app at 360px in light and dark. Tests do not
exercise StrictMode double-mount, viewport overflow, or thumb reach.

---

## 11. Manifest proposal

### Features

| Feature id | Observable effect |
|---|---|
| `audio_speech` | spoken counts, prompts, exchanges, and hints |
| `sound_chimes` | remove/place/success/error sounds |
| `haptic_feedback` | tactile remove, place, jump, and exchange feedback |
| `counting_badges` | sequence badges on removed or remaining objects |
| `running_difference_badge` | live current value/gap on tray and line engines |
| `strategy_scaffold` | bond arms, line arcs, exchange narration, and partial rows |
| `step_context_tags` | warm-up/guided/milestone labels from shared round chrome |
| `premium_lessons` | gates lessons after configured free count |

### Settings

Mirror Addition's `warmupLabel`, `activityLabel`, `guidedLabel`, `milestoneLabel`,
`speechRate`, `answerInput`, and `freeLessons`. Do not add a setting without naming its
reader and covering it in a test.

Suggested identity:

```jsonc
{
  "id": "subtraction",
  "name": "Subtraction",
  "version": "1.0.0",
  "description": "Fifty-two ways to subtract, from taking objects away to choosing the strategy the numbers deserve.",
  "category": "core",
  "author": "Koda Math Lab",
  "iconName": "CircleMinus",
  "tagline": "Take away, compare, and find the missing part.",
  "thumbnail": "subtraction",
  "status": "draft",
  "audience": { "ages": [5, 9], "category": "operations" }
}
```

---

## 12. Subtraction-specific error register

1. **Generating `b > a`.** No negative answers in this skill.
2. **Swapping operands.** `a−b` and `b−a` are not alternate forms.
3. **Always teaching count back.** Small differences should invite count up.
4. **Changing only one operand in constant difference.** The difference is preserved
   only when the same offset is applied to both.
5. **Calling comparison “take away.”** Matched rows and aligned bars compare; nothing
   disappears from either original group.
6. **Keyword story solving.** Unknown position controls the model, not words such as
   “left,” “more,” or “fewer.”
7. **An invisible removed set.** Keep moved/crossed items visible enough to audit.
8. **Exchange without conservation.** Block count changes; total value must not.
9. **Treating a required exchange as a wrong answer.** An unfinished representation is
   refused, not submitted.
10. **Hiding regrouping across zero.** Show both exchanges explicitly.
11. **A worksheet that moves the blank.** Preserve missing minuend/subtrahend position.
12. **Practice with scaffolds still on.** Practice is retrieval, not a long guided round.

All twelve general traps in `ADDITION_BUILD_PLAN.md` §12 still apply: expected answers,
one submit per question, theme tokens, speech ownership, accessible names, no XP in
skill code, and no cross-folder activity imports.

---

## 13. Decisions to settle before Phase 0

| # | Decision | Recommendation |
|---|---|---|
| 1 | Ship 52 teaching + 11 practice lessons now? | Yes. Practice is an established product contract, not a post-launch extra. |
| 2 | Own engines or point lessons at Addition activities? | Own the arithmetic engines; extract only render-only kit primitives when duplication is proven. |
| 3 | Include partial differences with negative intermediate values? | **No for v1.** Level 34 checks with inverse addition instead; signed partials belong to a later integer skill. |
| 4 | Use “borrow” or “exchange/regroup”? | Use **exchange** in child copy; optionally mention “sometimes called borrowing” only in adult pedagogy notes. |
| 5 | Questions per round | Five for teaching; four for dense column/story modes if 360px testing shows fatigue. Practice rounds are 9–12 questions and cycle modes. |
| 6 | Thumbnail | Ship `subtraction.svg` and publish it to the shared Art collection during the ship phase. |
| 7 | Course start | Append after the current final unit. Today that is u21, so the proposal starts at u22. |
| 8 | Publication state | Draft until Phase 15; published is the final change. |

### Definition of done

- All 63 lessons open from Skill Manager and the course, in order and exactly once.
- Every engine has a behaviour driver, worksheet adapter, pure live-state hints, and a
  practice lesson.
- All generator specs pass property tests and never return a negative result or wrong
  exchange shape.
- Every feature toggle changes observable behaviour and every setting has a reader.
- Perfect/mistake rounds score through the shared kit; no activity awards XP directly.
- Light and dark themes work at 360px, with no page-level horizontal scroll.
- Disabling subtraction removes all 63 lessons; publishing occurs only after this pass.
