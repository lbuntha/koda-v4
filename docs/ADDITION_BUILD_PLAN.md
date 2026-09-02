# Addition Quest — build plan

**Skill id:** `addition` · **Ages:** 5–9 · **Category:** `operations` · **52 techniques → 52 lessons on 12 activity engines.**

This is the step-by-step plan for building the Addition skill from the technique
inventory. It is written to be executed in order, one phase at a time, with a green
`tsc` / `npm test` / `npm run build` after every phase. Nothing here is optional
decoration: every rule below is either a contract the codebase enforces
(`src/skills/types.ts`, `src/skills/kit/testing/skillContract.ts`) or a mistake
counting already paid for once.

> **Reference skill:** `src/skills/counting/`. Read it before writing anything.
> Addition copies its shape exactly — metadata and curriculum in JSON, only the
> activities in code, two lines of structural tests, one import in the registry.

---

## Status — built

Phases 0–15 are complete and the skill is published. What the plan describes as
future work, and where the skill has since moved past the plan:

- **The voice clips are not recorded.** Deliberate, per Phase 14 §4: `voice.json`
  is complete and the dry run lists **96 phrases**, but `audio/manifest.json` is
  still `{}` and the skill speaks through live TTS. Record with
  `npm run voice:record -- --skill addition` when the spend is wanted.
- **64 lessons, not 52.** Units u18–u20 — twelve practice lessons — were added
  after this plan was written. Everything below that says 52 means the 52
  techniques; `addition.course.test.ts` holds the real count.
- **Phase 15's manual pass is now three tests, not a checklist.**
  `addition.features.test.tsx` proves each of the seven feature toggles changes
  the round, `addition.course.test.ts` proves disabling the skill empties its
  lessons out of the course, and `describeSkillContract` proves the manifest and
  the code agree about which features exist at all. Light/dark and 360px stay a
  thing to look at.

---

## 0. Pre-flight — read this before Phase 1

### 0.1 The repo is mid-migration. Know which API is current.

`SkillRound` **no longer accepts `showTip` / `onToggleTip`**. Hints are now a
*ladder*: the activity supplies `hints: string[]` (gentlest first) and the kit owns
which rung is showing via `round.hint`.

```tsx
// CURRENT — copy this
hints={additionHints(question, { entered, kidTip: copy.kidTip })}

// STALE — four counting activities used to do this; it is a type error now
showTip={showTip} onToggleTip={() => setShowTip(v => !v)}
```

At the time of writing, `TouchOrbit`, `SubitizingRush`, `TenFrameRocket` and
`FroggySkip` are migrated; **`Base10Foundry` is not**, so `npx tsc --noEmit` is red
on that one file. That redness is pre-existing and not ours. Establish the baseline
before Phase 1 so a later failure is unambiguous:

```bash
npx tsc --noEmit 2>&1 | tee /tmp/tsc-baseline.txt   # expect: Base10Foundry showTip errors only
npm test                                            # expect: green
```

Measured on 2026-08-31: `npm test` → **48 files, 521 tests, all passing**. `tsc` →
`Base10Foundry.tsx(388,7): Property 'showTip' does not exist` and nothing else.

**Gate rule for every phase:** `tsc` errors must be *the baseline set and nothing
else*; `npm test` must be fully green.

### 0.2 Never copy a counting activity wholesale

Copy its *shape* (params → `question` → `SkillRound` → `submit`), not its body.
Counting's activities carry level-specific history addition does not need.

### 0.3 Three edits outside the skill folder. No more.

1. `src/skills/registry.ts` — one import, one array entry.
2. `src/curriculum/course.json` — new units **appended last**, so existing level numbers do not shift.
3. `src/assets/svg/thumbnail/addition-quest.svg` + `npm run svg:ids` — the store tile.

If we want to avoid (3) entirely, set `"thumbnail": "layers"` (a `lessonIcons` key)
and skip it. Recommended: ship the tile, counting has one.

---

### 0.4 Two different numbers are both called "level"

- **`params.level`** in `lessons.json` is the skill's own ordering. The contract test
  requires it to run `1..n` with no gaps and no duplicates. It is what decides build order.
- **`levelNumber`** shown to the child is the lesson's **position in `course.json`**,
  counted across every unit (`getCourseUnits` in `src/curriculum/index.ts`).

They are different numbers, and they only agree if the course lists addition's lessons
in `params.level` order. Ours will, because the units in §9 follow the level table.
Get this wrong and a lesson the skill calls level 7 tells the child "Lesson 22 of 67".

### 0.5 Why a finished lesson can still be invisible

Four gates sit between a lesson and the Learn page. When a new lesson does not appear,
it is almost always one of these, not a bug:

| Gate | Where | What to do while building |
|---|---|---|
| `status: "draft"` | `manifest.json`, checked by `hiddenReason` | draft is developer-only; `isDeveloper` is true in dev builds |
| Skill age range | `manifest.audience.ages` vs the viewer's age | addition is `[5, 9]` |
| **Lesson age band** | `ageBand[0] > viewer.age + 1` hides it (`STRETCH_YEARS = 1`) | the default viewer is **age 6**, so every lesson whose `ageBand` starts at 8 — levels 35, 38, 43, 44, 51, 52 — is hidden until the viewer is older |
| Not in `course.json` | `getCourseUnits` resolves refs | until its unit is appended, open it from a **Skill Manager preview** instead |

To see the whole skill while building, set the viewer once in the browser console:

```js
localStorage.setItem("koda_viewer_v1", JSON.stringify({ age: 9, isDeveloper: true, showAllSkills: true }));
```

## 1. Architecture — why 12 engines and not 52 components

A technique is **not** a component. It is a *lesson*: a JSON entry that configures a
reusable engine. 52 components would be 52 places to fix one bug; the contract in
`docs/PLUGINS.md` §7 exists to stop exactly that.

Each engine owns one **interaction** — one thing a child's finger does. Every technique
that is answered the same way rides the same engine with different `params`.

| # | Engine (component) | activity id | The interaction | Techniques | Lessons |
|---|---|---|---|---|---|
| A | `CountTray` | `tray` | Tap objects in two bins; a running counter names each tap | 1–7 | 7 |
| B | `FrameFill` | `frames` | Tap counters into a five-, ten- or double ten-frame | 8, 9, 18, 19 | 4 |
| C | `BondTree` | `bonds` | Tap or type the parts and whole of a bond diagram | 10, 22, 23, 45 | 4 |
| D | `FactDeck` | `facts` | Card with a fact; answer from a pad, or match a related fact | 15, 16, 17, 24, 25, 26 | 6 |
| E | `JumpLine` | `numberline` | Place jumps on a number path / open number line | 11, 12, 20, 21, 28, 31 | 6 |
| F | `BlockYard` | `base10` | Tap flats/rods/units into place, bundle ten into one | 13, 29, 30, 36, 37 | 5 |
| G | `PlaceValueDesk` | `chart` | Type digits into H/T/O columns, combine column by column | 14, 32, 33, 34, 35 | 5 |
| H | `ColumnPad` | `column` | Vertical algorithm: write each digit, carry above the column | 38, 39 | 2 |
| I | `ChainBoard` | `multi` | Reorder / pair three or more addends, keep a running total | 27, 40, 41, 42 | 4 |
| J | `StoryBoard` | `story` | Read/hear a story, build a bar model, answer | 46–51 | 6 |
| K | `EstimateDial` | `estimate` | Round each addend, choose the estimate, judge a claim | 43, 44 | 2 |
| L | `StrategyPicker` | `strategy` | Choose the smartest strategy, then watch two paths compared | 52 | 1 |

**7+4+4+6+6+5+5+2+4+6+2+1 = 52.** Every technique in the inventory has exactly one home.

### 1.1 The one rule that keeps this honest

> An engine never asks which level it is. Mode is a lesson parameter.

`FrameFill` does not know that `make-10` is level 19. It knows `mode: "make_ten"`.
That is what lets a 53rd technique ship as JSON.

---

## 2. Master lesson table

`params.level` is the number in column **L**. The contract test requires levels
`1..n` with no gaps, so **build in this order** — a phase always adds a contiguous
block, never a hole.

`Numbers` is the random-generation rule. Every lesson generates fresh numbers per
question; none is a fixed list.

| L | Technique | lesson id | Engine · mode | conceptKey | Numbers (random each question) | Child answers | Standards | Age |
|---|---|---|---|---|---|---|---|---|
| 1 | Count all | `count-all` | tray · `count_all` | `count-all` | a,b ∈ 1–5, a+b ≤ 10 | taps every object, then Check | K.OA.A.1, K.OA.A.2 | 5–6 |
| 2 | Put groups together | `put-groups-together` | tray · `combine` | `combiner` | a,b ∈ 1–5 | taps both bins into one, then Check | K.OA.A.1 | 5–6 |
| 3 | Count on | `count-on` | tray · `count_on` | `count-on` | a ∈ 4–9, b ∈ 1–3 | taps only the second bin, counting on from a | 1.OA.C.5 | 5–7 |
| 4 | Start with the larger number | `start-with-larger` | tray · `count_on_larger` | `count-on-from-larger` | a ∈ 1–3, b ∈ 5–9 (smaller shown first) | picks which bin to start from, then counts on | 1.OA.B.3, 1.OA.C.5 | 6–7 |
| 5 | Add zero | `add-zero` | tray · `add_zero` | `additive-identity` | a ∈ 1–10, b = 0; half the questions flipped 0+a | number pad | 1.OA.C.6 | 5–7 |
| 6 | Add one | `add-one` | tray · `add_one` | `next-number-adder` | a ∈ 0–19, b = 1; half flipped | number pad | 1.OA.C.5, 1.OA.C.6 | 5–7 |
| 7 | Use fingers | `use-fingers` | tray · `fingers` | `finger-adder` | a,b ∈ 1–5, a+b ≤ 10 | raises fingers on two hands, then Check | *(empty)* | 5–7 |
| 8 | Use a five-frame | `five-frame` | frames · `five` | `five-benchmark` | a ∈ 1–4, b ∈ 1–4, a+b ≤ 5 | fills cells, then Check | K.OA.A.5 | 5–6 |
| 9 | Use a ten-frame | `ten-frame` | frames · `ten` | `ten-frame-adder` | a ∈ 1–9, b ∈ 1–9, a+b ≤ 10 | fills cells, then Check | 1.OA.C.6 | 5–7 |
| 10 | Use number bonds | `number-bonds` | bonds · `whole_unknown` | `part-whole-decomposer` | parts ∈ 1–9, whole ≤ 10 | types the whole | K.OA.A.3 | 5–7 |
| 11 | Use a number path | `number-path` | numberline · `path` | `number-path` | a ∈ 1–10, b ∈ 1–5, a+b ≤ 20 | taps forward one square at a time | 1.OA.C.5 | 5–7 |
| 12 | Use an open number line | `open-number-line` | numberline · `open` | `open-number-line` | a ∈ 10–40, b ∈ 2–9 | draws one jump, lands, names the total | 2.NBT.B.5 | 7–9 |
| 13 | Use base-ten blocks | `base-ten-blocks` | base10 · `build_add` | `base-ten-adder` | a,b two-digit, **no regroup** (ones sum ≤ 9) | places rods+units, then Check | 1.NBT.C.4 | 6–8 |
| 14 | Use a place-value chart | `place-value-chart` | chart · `chart_add` | `place-value-builder` | a,b two-digit, no regroup | types T and O columns | 1.NBT.C.4 | 6–8 |
| 15 | Learn doubles | `doubles` | facts · `doubles` | `doubles-knower` | n ∈ 1–10, fact n+n | number pad | 1.OA.C.6 | 6–8 |
| 16 | Near doubles — one more | `near-doubles-one-more` | facts · `near_up` | `near-doubles` | n ∈ 1–9, fact n+(n+1) | number pad, after naming the double | 1.OA.C.6 | 6–8 |
| 17 | Near doubles — one less | `near-doubles-one-less` | facts · `near_down` | `near-doubles` | n ∈ 2–10, fact n+(n−1) | number pad, after naming the double | 1.OA.C.6 | 6–8 |
| 18 | Make 5 | `make-5` | frames · `make_five` | `five-benchmark` | a ∈ 1–4; answer 5−a | fills the rest of the five-frame | K.OA.A.4 | 5–7 |
| 19 | Make 10 | `make-10` | frames · `make_ten` | `make-ten` | a ∈ 1–9; answer 10−a | fills the rest of the ten-frame | K.OA.A.4 | 5–7 |
| 20 | Make the next multiple of 10 | `next-multiple-of-10` | numberline · `bridge_ten` | `bridging-ten` | a ∈ 11–89 not a multiple of 10; answer 10−(a mod 10) | jumps to the next ten | 2.NBT.B.5 | 6–8 |
| 21 | Make the next multiple of 100 | `next-multiple-of-100` | numberline · `bridge_hundred` | `bridging-hundred` | a ∈ 110–890 not a multiple of 100 | jumps to the next hundred | 2.NBT.B.7 | 7–9 |
| 22 | Break apart an addend | `break-apart-an-addend` | bonds · `split_one` | `addend-decomposer` | a ∈ 6–9, b ∈ 3–9, a+b > 10 (bridging pair) | splits b into (10−a) and the rest | 1.OA.C.6 | 6–8 |
| 23 | Decompose both addends | `decompose-both-addends` | bonds · `split_both` | `addend-decomposer` | a,b two-digit, no regroup | splits both into tens+ones | 1.NBT.C.4 | 7–9 |
| 24 | Use a known fact | `use-a-known-fact` | facts · `known_fact` | `known-fact-user` | known ∈ doubles/make-10 set; target = known ± 1 or ± 10 | picks the helper fact, then answers | 1.OA.C.6 | 6–8 |
| 25 | Use fact families | `fact-families` | facts · `family` | `fact-family` | a,b ∈ 1–9, a ≠ b, a+b ≤ 18 | fills the four missing members | 1.OA.B.4, 1.OA.D.8 | 6–8 |
| 26 | Switch the addends | `switch-the-addends` | facts · `commute` | `commutativity` | a ∈ 1–4, b ∈ 6–9 (gap ≥ 3 so switching pays) | states the switched fact, then answers | 1.OA.B.3 | 6–8 |
| 27 | Regroup addends to make friendly pairs | `friendly-pairs` | multi · `pairs` | `friendly-pairs` | 3–4 addends ∈ 1–9 containing one pair summing to 10 | taps the pair together first | 1.OA.A.2, 1.OA.B.3 | 6–8 |
| 28 | Use compensation | `compensation` | numberline · `compensate` | `compensator` | b ends in 8 or 9 (e.g. 37+19) | rounds b up, adds, then gives back | 2.NBT.B.5, 2.NBT.B.9 | 7–9 |
| 29 | Add multiples of 10 | `add-multiples-of-10` | base10 · `multiples_ten` | `tens-adder` | a,b multiples of 10, a+b ≤ 100 | places rods, then Check | 1.NBT.C.4, 2.NBT.B.8 | 6–8 |
| 30 | Add multiples of 100 | `add-multiples-of-100` | base10 · `multiples_hundred` | `hundreds-adder` | a,b multiples of 100, a+b ≤ 1000 | places flats, then Check | 2.NBT.B.8 | 7–9 |
| 31 | Add tens, then ones | `add-tens-then-ones` | numberline · `jump_tens_ones` | `jump-strategy` | a,b two-digit, no regroup | one big jump of tens, then small ones | 2.NBT.B.5 | 7–9 |
| 32 | Add hundreds, tens and ones | `add-hundreds-tens-ones` | chart · `chart_three` | `place-value-builder` | a,b three-digit, no regroup | types H, T, O | 2.NBT.B.7 | 7–9 |
| 33 | Use expanded form | `expanded-form` | chart · `expanded` | `expanded-form-adder` | a,b two- or three-digit, no regroup | writes each as H+T+O, then totals | 2.NBT.A.3, 2.NBT.B.7 | 7–9 |
| 34 | Use partial sums | `partial-sums` | chart · `partial_sums` | `partial-sums` | a,b two-digit, **regroup allowed** | enters each partial, then the total | 2.NBT.B.7 | 7–9 |
| 35 | Add from left to right | `left-to-right` | chart · `left_right` | `left-to-right-adder` | a,b two-digit, regroup allowed | works H → T → O, adjusting as it goes | 2.NBT.B.9 | 8–9 |
| 36 | Exchange 10 ones for 1 ten | `exchange-ten-ones` | base10 · `trade_ones` | `unitiser-ten` | a,b two-digit with ones sum ≥ 10 | bundles ten units into a rod, then Check | 1.NBT.C.4, 2.NBT.B.7 | 6–8 |
| 37 | Exchange 10 tens for 1 hundred | `exchange-ten-tens` | base10 · `trade_tens` | `unitiser-hundred` | a,b with tens sum ≥ 10 | bundles ten rods into a flat | 2.NBT.B.7 | 7–9 |
| 38 | Use cascading regrouping | `cascading-regrouping` | column · `cascade` | `cascading-regrouper` | a,b three-digit, **two carries** (ones ≥ 10 *and* tens ≥ 10) | writes each digit and each carry | 3.NBT.A.2 | 8–9 |
| 39 | Use the standard vertical algorithm | `standard-algorithm` | column · `standard` | `standard-algorithm` | a,b two- or three-digit, one carry | writes each digit and each carry | 2.NBT.B.7, 3.NBT.A.2 | 7–9 |
| 40 | Add three or more numbers | `add-three-or-more` | multi · `chain` | `multi-addend` | 3–4 addends ∈ 2–19, total ≤ 60 | adds in any order, one step at a time | 1.OA.A.2, 2.NBT.B.6 | 6–9 |
| 41 | Find compatible numbers | `compatible-numbers` | multi · `compatible` | `compatible-numbers` | 4–5 addends with two pairs summing to 10/100 | selects the compatible pair(s) | 2.NBT.B.6 | 7–9 |
| 42 | Keep a running total | `running-total` | multi · `running` | `running-total` | 4–5 addends ∈ 2–15 | enters the total after every addend | 2.NBT.B.6 | 7–9 |
| 43 | Estimate by rounding | `estimate-by-rounding` | estimate · `round_estimate` | `rounding-estimator` | a,b two- or three-digit, neither ending in 0 | rounds each, picks the estimate | 3.NBT.A.1 | 8–9 |
| 44 | Check whether the answer is reasonable | `is-it-reasonable` | estimate · `reasonable` | `reasonableness-checker` | a real sum plus a claimed answer that is right, off by 10, or off by 100 | judges Yes / No, then says why | 3.OA.D.8 | 8–9 |
| 45 | Solve missing-addend equations | `missing-addend` | bonds · `part_unknown` | `missing-addend` | whole ≤ 20, one part hidden; blank in any position | types the missing part | 1.OA.D.8 | 6–8 |
| 46 | Model join problems | `join-problems` | story · `join` | `join-modeler` | start ∈ 3–20, change ∈ 2–15 | builds the bar, then answers | 1.OA.A.1 | 6–8 |
| 47 | Model part–part–whole problems | `part-part-whole` | story · `ppw` | `part-part-whole` | parts ∈ 3–25 | builds two parts into one whole | 1.OA.A.1 | 6–8 |
| 48 | Model change-unknown problems | `change-unknown` | story · `change_unknown` | `change-unknown` | start ∈ 5–30, result ∈ start+2 … start+20 | finds the change | 1.OA.A.1, 2.OA.A.1 | 7–9 |
| 49 | Model start-unknown problems | `start-unknown` | story · `start_unknown` | `start-unknown` | change ∈ 3–20, result ≤ 60 | finds the start | 2.OA.A.1 | 7–9 |
| 50 | Model comparison problems | `comparison-problems` | story · `compare` | `compare-modeler` | smaller ∈ 4–30, difference ∈ 2–15 | builds two bars, finds the larger | 2.OA.A.1 | 7–9 |
| 51 | Solve multi-step addition problems | `multi-step-problems` | story · `multi_step` | `multi-step-solver` | three quantities ∈ 3–40, two steps | answers step 1, then step 2 | 3.OA.D.8 | 8–9 |
| 52 | Explain and compare strategies | `explain-and-compare` | strategy · `compare_paths` | `strategy-chooser` | a problem drawn from a pool tagged with the strategies that fit it | picks the strategy, then judges two worked paths | 2.NBT.B.9, 3.NBT.A.2 | 8–9 |

**Standards are written in full** in `lessons.json`: `"CCSS.K.OA.A.1"`, not `K.OA.1`.
Row 7 (`use-fingers`) ships `"standards": []` deliberately — finger counting is a
trajectory position, not a Common Core code — so it **must** carry a
`trajectoryLevel`. That is `docs/PLUGINS.md` §7 rule 6, and it is the only row that
uses the escape hatch.

### 2.1 conceptKeys — reuse before inventing

Mastery aggregates on `conceptKey` **across skills**. A new name for an old idea
splits a child's record in two. These six are counting's and must be reused exactly:

| Reused key | Taught by counting in | Reused by addition at |
|---|---|---|
| `five-benchmark` | `ten-frame-5-and-more` | L8, L18 |
| `make-ten` | `making-10` | L19 |
| `part-whole-decomposer` | `two-color-groups` | L10 |
| `place-value-builder` | `build-numbers-with-hundreds-tens-ones` | L14, L32 |
| `unitiser-ten` | `make-a-ten` | L36 |
| `unitiser-hundred` | `make-a-hundred` | L37 |

Everything else in the table is a new key addition owns. **Before adding any key,
`grep -r '"conceptKey"' src/skills/*/lessons.json`** — that grep is the only thing
standing between us and a split record.

### 2.2 The `requires` chain

`describeSkillContract` fails a lesson that requires a concept nothing before it
teaches — and `manifest.requires` seeds the set. So the manifest declares what
addition inherits from counting:

```json
"requires": ["counter", "corresponder", "make-ten", "five-benchmark",
             "part-whole-decomposer", "place-value-builder",
             "unitiser-ten", "unitiser-hundred"]
```

Then each lesson's `requires` may name any of those, or any conceptKey taught at a
**lower level number**. Keep chains short — one or two prerequisites, the real ones.

---

## 3. Folder layout

```
src/skills/addition/
  manifest.json              id, features, settings, settingsSchema, audience {ages:[5,9]}
  lessons.json               52 entries, level 1..52
  voice.json                 what the code says out loud (§7)
  audio/manifest.json        {}  ← ships empty; the recorder writes it
  index.ts                   export const skill: Skill  (copy counting/index.ts)
  addition.test.ts           describeSkillContract(skill); describeActivitySmoke(skill);
  addition.activities.test.tsx   one driver per engine (§8.2)
  addition.hints.test.ts     the pure hint builders (§6)
  assets/                    apple.svg bead.svg block.svg balloon.svg shell.svg star.svg
  internal/
    data/
      additionLayout.ts      one size ladder for every engine
      additionNumbers.ts     THE random-number contract (§4)
      additionPalette.ts     addend A / addend B / total colour roles
      strategyCards.ts       engine L's strategy metadata
  activities/
    CountTray.tsx  FrameFill.tsx  BondTree.tsx  FactDeck.tsx  JumpLine.tsx
    BlockYard.tsx  PlaceValueDesk.tsx  ColumnPad.tsx  ChainBoard.tsx
    StoryBoard.tsx EstimateDial.tsx    StrategyPicker.tsx
```

`internal/` is private: nothing outside `src/skills/addition/` may import it, and
nothing outside may import past `index.ts`.

### 3.1 Artwork

Addition ships **its own** six SVGs. It must not reference `counting-rocket` — those
ids are counting's, and a disabled counting skill would take them away mid-round.
Same rules as counting's eight: no two silhouettes alike, equal optical weight, so
the artwork never varies the difficulty of the arithmetic.

---

## 4. `additionNumbers.ts` — the random-number contract

Every technique is "clear and clean with random numbers to play". That is one module,
written **first**, in Phase 1, and unit-tested. Every engine draws from it; no engine
rolls its own `Math.random()` arithmetic.

```ts
/** Inclusive. The one place randomness enters this skill. */
export const randInt = (lo: number, hi: number): number => ...;

export interface PairSpec {
  addendRange?: [number, number];   // both addends
  aRange?: [number, number];        // first only, when the technique cares
  bRange?: [number, number];
  sumMax?: number;                  // hard ceiling on a + b
  sumMin?: number;
  regroup?: "never" | "ones" | "tens" | "both" | "any";
  multipleOf?: 10 | 100;            // both addends are multiples of this
  distinct?: boolean;               // a !== b
  minGap?: number;                  // |a - b| >= gap  (switch-the-addends)
  bridging?: boolean;               // a < 10 < a + b   (make-ten strategies)
  endsIn?: number[];                // b ends in 8 or 9 (compensation)
}

export interface Pair { a: number; b: number; sum: number }

/** Draw a pair matching every constraint, or throw. Never returns a near-miss. */
export function drawPair(spec: PairSpec): Pair;

export function drawDouble(range: [number, number]): Pair;              // n + n
export function drawNearDouble(range: [number, number], delta: 1 | -1): Pair;
export function drawChain(count: number, spec: ChainSpec): number[];    // 3–5 addends
export function drawFriendlyChain(count: number, target: 10 | 100): number[];
export function drawRoundingPair(digits: 2 | 3): Pair;                  // neither ends in 0
export function drawStory(kind: StoryKind, spec: StorySpec): StoryNumbers;

/** Reject a repeat of the last question's numbers within one round. */
export function withoutRepeat<T>(draw: () => T, key: (t: T) => string, seen: Set<string>): T;
```

### 4.1 Five rules the generator must obey

1. **Constraints are hard, not hints.** `regroup: "never"` must never produce a
   regrouping pair. Implement as *generate-and-filter with a bounded retry, then a
   deterministic constructive fallback* — never an unbounded `while (true)`, which is
   a hang on a tablet.
2. **No degenerate questions.** `0 + 0`, `1 + 1` where the lesson is about doubles of
   1, or a "make 10" question that is already 10. Each mode declares its exclusions.
3. **No repeats inside a round.** Five questions that are all `3 + 4` is a broken
   round; `withoutRepeat` is mandatory in every `nextQuestion`.
4. **The generator is pure given a draw.** Export the constraint checks
   (`isRegrouping`, `isBridging`) and unit-test them: 200 draws per spec, assert every
   one satisfies the spec. This is the cheapest bug insurance in the build.
5. **A question carries its own answer.** `expected: String(sum)` on every
   `RoundQuestion`, always — a missing `expected` makes every wrong answer
   `unknown` instead of `off_by_one`, and silently breaks the behaviour tests.

---

## 5. Engine specifications

### 5.0 Tap-to-place is the only interaction grammar — **settled**

Nothing in this skill is dragged. Every "move a thing" is **tap the source, then tap the
destination**, and it works identically in all twelve engines:

1. Tap a source (a block in the tray, an addend chip, a jump size). It becomes *held* —
   a ring, a lift, and `aria-pressed="true"`. Exactly one thing is held at a time.
2. Tap a destination (a frame cell, the build area, another chip). The move happens.
3. Tapping the held source again releases it. Tapping an illegal destination does
   nothing and does not count as an answer.

Why this and not drag:

- A five-year-old's drag on a small touchscreen misses more often than it lands, and a
  missed drag reads to the child as the app ignoring them.
- Pointer-drag is not reachable through `renderActivity`'s harness — it presses buttons
  by accessible name. A dragged interface is an untested interface here.
- Both halves are real buttons, so both get an `aria-label`, and a screen-reader user
  plays the same game as everyone else.

**Rules that make it uniform:**

- Every source is `aria-label`'d with what it is (`"Ten rod"`, `"Chip 7"`, `"Jump of 10"`),
  every destination with where it is (`"Space 4, empty"`, `"Build area, tens column"`).
- Held state is never colour alone — ring + lift + `aria-pressed`.
- Every engine that places things offers **Undo** (`"Undo last move"`), which is not a
  support and is not reported to the log. Putting a block back is not asking for help.
- A single-tap shortcut is allowed where the destination is unambiguous: tapping an
  empty ten-frame cell fills it, because there is nowhere else it could go.

Each engine is one file with the same skeleton. Written once here so twelve files do
not each invent it:

```tsx
export interface XSetup { mode?: XMode; /* number ranges */ questionsPerRound?: number }
export interface XParams extends XSetup { question?: XSetup }   // lessons nest under `question`

interface XQuestion extends RoundQuestion { /* what is on screen */ }

const buildQuestion = (setup: XSetup, index: number, seen: Set<string>): XQuestion => { ... }

/** Pure, exported, unit-tested. Rung 1 is the lesson's kidTip. */
export function xHints(q: XQuestion, state: { ...live state...; kidTip?: string }): string[] {
  return composeHints(state.kidTip ?? "<fallback>", "<this question, from live state>", "<worked step>");
}

export const X: React.FC<ActivityProps<XParams>> = ({ params, koda, onComplete, lesson }) => {
  const setup = { ...params, ...params.question };
  const total = setup.questionsPerRound ?? 5;
  const copy = playCopy(params);
  const round = useSkillRound({
    koda, totalQuestions: total, levelNumber: lesson?.levelNumber ?? 1,
    intro: copy.audioPrompt,
    nextQuestion: useCallback((i: number) => buildQuestion(setup, i, seen.current), [params]),
    onComplete: (r) => { void koda.progress.nextStep().then(s => setNextStep(s ?? undefined)); onComplete(r); },
  });
  return (
    <SkillRound koda={koda} lesson={lesson} fallbackTitle="…" round={round} totalQuestions={total}
      prompt={promptFor(question, copy)} iconName="…" iconTone="violet"
      hints={xHints(question, { ...live, kidTip: copy.kidTip })}
      onExit={koda.ui.exit}
      onReadAloud={() => { round.useSupport("audio_replay"); void koda.speech.say(promptFor(question, copy)); }}
      recommendation={nextStep}
    >
      {/* the only part we draw */}
    </SkillRound>
  );
};
```

### 5.1 House rules every engine replicates — **settled in Phase 1**

These were decided by building levels 1–7 and then cleaning them up. They are not
preferences; each one replaced something that was actually wrong on screen or in the
log. Every engine after `CountTray` follows them without re-deciding.

**1. One frame per question.** The scene is the only container. Levels 1–7 shipped with
three frames nested — scene → bin → closed-bin tile — and none of the inner ones said
anything the spacing and the `+` were not already saying. Groups are separated by
whitespace and the operator, not by borders. `BIN` is a soft tint and padding with **no
border**. The kit already states the principle: `SkillRound` deliberately draws no card
around the question, because boxes inside boxes is most of what makes a screen busy.

**An outline is allowed only where it carries meaning.** One survives in `CountTray`:
the empty group in *Adding Zero*. Without a border and with no objects there would be
nothing on screen at all, and a child cannot add a group they cannot see.

**2. A refused move is not an answer, and not a hint.** Starting from the smaller
number, or checking with no fingers up, gets a short transient line saying why —
`refuse(...)` — and nothing else. It must not call `submit` (the child has not said what
the total is) and it must not open the hint ladder (they never asked for help, and the
ladder would open at rung one, the generic tip, rather than at the sentence that
explains this particular no). Both are asserted in the behaviour tests.

**3. A mode's numbers live in `DEFAULT_SPEC`, never in `defaultParams`.** Two silent
bugs came out of blending them, and both are worth knowing before writing engine two:

- Spreading a lesson's setup straight over a default writes `undefined` for every key
  the lesson left out, so Count On — which *means* "start from four to nine" — became
  "start from one to nine" for any lesson that did not restate its range. Filter to the
  keys a lesson actually declared.
- A range on `defaultParams` is inherited by every mode. Count-all's `sumMax: 10`
  reached Adding One, whose declared range of 1 to 15 could then never produce anything
  above nine. Nothing failed; the lesson simply did not teach what it said.

And what a mode *is* cannot be overridden by a lesson: adding zero adds zero.

**4. A tile nobody can press is not a button.** A disabled button announces as a control
that exists but is unavailable; a group stated as a number is not a control at all.
Render it as a `div` with `role="img"` and a label, and keep `<button>` for what is
actually pressable — which also keeps `h.buttons()` in the tests meaning "the child's
available moves".

**5. A group too big to draw is stated as its number.** Above `TOO_MANY_TO_DRAW` (10),
objects become a numeral tile. Fourteen shapes beside one shape is a blob beside a
thing: a child cannot see "fourteen" in it, so the shapes buy nothing and invite
counting where the lesson is a rule.

**6. A skill goes quiet while a child is talking to Koda.** Automatic — every
engine gets it by calling `koda.speech.say()`, which they all do. The only way to
break it is to reach past the SDK to `playClip`, `new Audio()` or
`window.speechSynthesis`. `docs/VOICE.md` § "Who has the speaker" is the rule;
`createKodaSDK.test.ts` holds it for every skill at once, so a new engine needs no
test of its own for it.

**8. Two controls must never share an accessible name.** This bit three times:
two chips holding the same value, two rounding dials on the same number, and both
times it read as a flaky test rather than as what it was. A screen-reader user
genuinely cannot say which one they mean or reach the second, and the harness —
which presses by accessible name — silently hits the first every time. Where a
control's natural name can repeat, put its position in the label: `Chip 3, value
5`, `Second number: round 47 to 50`.

**7. Recorded speech is shared, so praise must be scoped.** The clip registry is one
global `Map<phrase, url>`, keyed by phrase text and not by skill. Two consequences:
addition's number words already play from counting's recordings, and addition's rounds
currently play counting's praise — *"Brilliant counting!"* after 7 + 3. See §7.5.

### A. `CountTray` — `tray` (L1–7)

| mode | On screen | Child does | `expected` | Wrong-answer `errorKind` |
|---|---|---|---|---|
| `count_all` | Two bins of objects, side by side | taps every object in both; each tap tags a number | sum | `miscounted_items` if taps ≠ sum, else `off_by_one` |
| `combine` | Two bins with a gap between | taps "Put together", then counts the merged pile | sum | `miscounted_items` |
| `count_on` | Bin A **closed and labelled `a`**, bin B open | taps only B's objects, counter starts at `a+1` | sum | `off_by_one` (started at `a`) |
| `count_on_larger` | Two closed labelled bins, smaller first | picks which to start from, then counts on | sum | `reversed` if the smaller was chosen |
| `add_zero` | One bin with `a`, one visibly empty | number pad | sum | `off_by_more` |
| `add_one` | Bin of `a`, one single object beside it | number pad | sum | `off_by_one` |
| `fingers` | Two hands, ten tappable fingers | raises `a` on the left hand, `b` on the right, Check | sum | `miscounted_items` |

- Objects are `aria-label`'d `"<noun> <n>"` (`"apple 3"`) so the test driver can tap them — same convention as `TouchOrbit`.
- Speaks each count through `koda.speech.say` gated on `config.isEnabled("audio_speech")`; the round must not advance before the last number is heard — use `useSpokenFinish` from the kit, **not** a fixed delay.
- Feature flag `counting_badges` → the number tag on a tapped object.

### B. `FrameFill` — `frames` (L8, 9, 18, 19)

One component, two geometries: a five-frame (1×5) and a ten-frame (2×5).
`mode: "five" | "ten" | "make_five" | "make_ten"`.

- `five` / `ten`: `a` cells arrive pre-filled in colour A; the child taps `b` more in
  colour B; **Check** submits the total.
- `make_five` / `make_ten`: `a` arrives filled; the child fills the *rest* and answers
  **how many they added** (`expected = 5 − a` / `10 − a`) — not the total. Getting this
  backwards is the single likeliest bug in this engine; the prompt says
  *"How many more to make 10?"* and the `expected` must match it.
- Cells are `aria-label`'d `"Space n, filled|empty"` — identical to `TenFrameRocket`,
  so the driver is a copy.
- Two colours make the parts visible. Palette: A = violet, B = sky. **Never amber.**

### C. `BondTree` — `bonds` (L10, 22, 23, 45)

A whole above two parts, joined by two strokes.

| mode | Given | Blank | `expected` |
|---|---|---|---|
| `whole_unknown` | both parts | the whole | `a + b` |
| `split_one` | `a + b` bridging pair | the two pieces of `b`: `10 − a` and the rest | `"3+2"` style, both boxes checked |
| `split_both` | two-digit `a`, `b` | four boxes: tens and ones of each | all four |
| `part_unknown` | whole + one part, blank in any of the three positions | the missing part | the missing number |

- Multi-box questions submit **once**, on Check, with `given` as the joined string.
  Never one `submit` per box — that would file four answers for one question.
- `place_value` is the `errorKind` when a `split_both` answer swaps tens and ones.

### D. `FactDeck` — `facts` (L15–17, 24–26)

A fact card and a number pad, plus a *relationship strip* that is the actual teaching.

- `doubles`: `n + n`, with the pair drawn as two identical rows so the double is visible.
- `near_up` / `near_down`: two steps — first tap the double the child knows
  (`5 + 5 = 10`), then answer the near double. Step one is a *support*, not a scored
  question: report it with `round.useSupport("walkthrough")`, not `submit`.
- `known_fact`: three helper-fact cards; the child picks the one that helps, then answers.
  Picking the wrong helper is a wrong answer with `errorKind: "unknown"` and a hint,
  not a failed question — it re-asks.
- `family`: four boxes (`a+b`, `b+a`, and the two subtractions). One Check.
- `commute`: shows `3 + 8`, asks for the switched form, then the sum. `errorKind:
  "reversed"` when the child re-states the original.
- Setting `answerInput` (`pad` | `choices`) decides whether the answer is typed or picked.

### E. `JumpLine` — `numberline` (L11, 12, 20, 21, 28, 31)

A horizontal line with a marker and an arc for each jump the child makes.

| mode | Line | Jump control | `expected` |
|---|---|---|---|
| `path` | ticked 0–20, every number labelled | +1 button, one square per tap | sum |
| `open` | unticked, only landed points labelled | choose jump size, then Jump | sum |
| `bridge_ten` | 0–100, tens marked | one jump to the next ten | `10 − (a % 10)` |
| `bridge_hundred` | 0–1000, hundreds marked | one jump to the next hundred | `100 − (a % 100)` |
| `compensate` | open | jump the rounded `b`, then jump back | sum, in two moves |
| `jump_tens_ones` | open | a tens jump, then a ones jump | sum, in two moves |

- Two-move modes accept the moves in either order but require both before Check.
- The marker's position is `aria-live` so its number is announced; the Jump button is
  labelled `"Jump forward N"` for the driver.
- This is **not** counting's `FroggySkip`. That one hops a fixed step to a target and
  speaks each pad; this one records arcs of chosen size and keeps them on screen,
  which is the whole point of an open number line. Different interaction, own engine.

### F. `BlockYard` — `base10` (L13, 29, 30, 36, 37)

Flats (100), rods (10), units (1) in a tray; a build area below. Tap a block, tap the area.

- `build_add`: tap a block, tap the build area — build `a`, then `b`, then Check.
- `multiples_ten` / `multiples_hundred`: only rods / only flats — the arithmetic is
  the same as counting rods, which is the point.
- `trade_ones`: the ones column is allowed to exceed 9; a **Bundle** button appears
  when ten units are present and swaps them for one rod. The lesson is not complete
  until the bundle is made — `expected` is the total, but a Check with an unbundled
  ten is refused with the rung-2 hint, not a wrong answer.
- `trade_tens`: the same, one place up.
- Speaks `"10 ones make 1 ten"` / `"10 tens make 1 hundred"` — both phrases are
  already recorded in counting's voice; addition declares them in its own
  `voice.json` too, because clips are per-skill.

### G. `PlaceValueDesk` — `chart` (L14, 32–35)

A H | T | O grid; each cell is a `themeSystem.field()` input.

- `chart_add` / `chart_three`: one row per addend, one for the total.
- `expanded`: each addend is written as `300 + 40 + 7` before the columns are added.
- `partial_sums`: a row per partial (`40+30`, `7+8`), then the total. Every partial is
  checked on the single Check; a wrong partial names *which column* in the feedback.
- `left_right`: same grid, but the columns unlock left to right and the running total
  is shown after each — the adjustment is the lesson.
- **All inputs are `inputMode="numeric"` and `themeSystem.field()`.** Never a raw
  slate-shaded input; that is a second definition of the surface and it is wrong in
  one theme.

### H. `ColumnPad` — `column` (L38, 39)

The vertical algorithm, with a carry box above each column.

- Digits are entered right to left; a column is not accepted until its carry (if any)
  is written. `standard` generates exactly one carry; `cascade` generates two.
- `errorKind: "place_value"` when the digit is right but in the wrong column;
  `"off_by_more"` when a carry is dropped.
- The carry boxes are `aria-label`'d `"Carry into tens"` etc.

### I. `ChainBoard` — `multi` (L27, 40–42)

Addend chips in a row, reordered and merged by tapping one chip then another.

- `pairs`: 3–4 chips, exactly one pair makes 10; tapping the two chips merges them into a
  `10` chip, then the rest is easy.
- `chain`: free order; a running total appears after each merge.
- `compatible`: 4–5 chips, the child selects **all** compatible pairs before adding.
- `running`: no reordering; the child types the total after every addend, so the
  question has *n* sub-answers and one Check.

### J. `StoryBoard` — `story` (L46–51)

The story in words (and read aloud — these children cannot read it), a bar model to
build, then the answer.

| mode | Bar model | Unknown |
|---|---|---|
| `join` | one bar growing by a second segment | the result |
| `ppw` | two parts under one whole | the whole |
| `change_unknown` | start bar + gap + known result | the change |
| `start_unknown` | gap + known change + known result | the start |
| `compare` | two bars, the longer overhanging | the larger quantity |
| `multi_step` | three segments, answered in two steps | step 1, then step 2 |

- Story text is **authored per lesson** as templates in `params.question.stories`,
  with `{a}`, `{b}`, `{name}`, `{thing}` placeholders filled from the drawn numbers
  and a small cast list. That keeps the words in JSON, where lessons live.
- The names and objects must be a fixed short list, not random strings — the voice
  recorder can then cover the frames, and a child hears a familiar cast.
- `multi_step` submits twice, as two questions of the round, not two answers to one.

### K. `EstimateDial` — `estimate` (L43, 44)

- `round_estimate`: each addend sits on a mini number line between its two nearest
  tens/hundreds; the child taps each onto the nearer one, then picks the estimate.
  `expected` is the *estimate*, not the exact sum — say so in the prompt.
- `reasonable`: shows a completed sum with a claimed answer; the child answers
  Yes/No and then picks the reason ("about 90, so 890 is far too big"). Claim errors
  are drawn as ×10, ×100 or off-by-one so the reason is always one of a fixed set.

### L. `StrategyPicker` — `strategy` (L52)

- A problem is drawn, tagged in `strategyCards.ts` with which strategies genuinely
  fit it (e.g. `48 + 19` → compensation, jump-tens-then-ones; **not** doubles).
- Step 1: pick a strategy. Any *tagged* strategy is correct — this is the one lesson
  with more than one right answer, and the feedback names why each fits.
- Step 2: two worked paths are shown side by side; the child judges which was fewer
  steps. That is what "compare strategies" means for an eight-year-old.
- This engine reads no new pedagogy — the cards are metadata over the other 51.

---

## 6. Hints — three rungs, from live state

Rung 1 is the lesson's `kidTip` (JSON). Rungs 2 and 3 are built by the engine from
what the child has actually done, and both are read aloud by `SkillHint`.

Every engine exports its hint builder as a **pure function** and
`addition.hints.test.ts` tests them — the pattern `subitizeHints` established in
counting. A hint that describes a state the child is not in is worse than no hint.

- **Rung 2 — this question:** *"You have filled 7 of the ten. How many empty spaces are left?"*
- **Rung 3 — the worked step:** the method with these numbers, stopping one step
  short of the answer where the child is choosing between answers, and going all the
  way where the answer is produced by doing.

---

## 7. Voice — define now, record later

Nothing is recorded in this build. We **write the script**; `npm run voice:record`
runs afterwards, deliberately, because it costs money per phrase.

### 7.1 What is collected automatically

`scripts/generate-voice.mjs` reads every lesson's `params.play.audioPrompt` from
`lessons.json`. So 52 lesson intros are covered by writing the lessons — **do not
list them in `voice.json`**.

### 7.2 What `voice.json` must declare

```jsonc
{
  "numberWords": ["zero" … "twenty"],
  "numberRange": [0, 100],          // every number an engine speaks aloud
  "phrases": [
    "10 ones make 1 ten",
    "10 tens make 1 hundred",
    "Start with the larger number.",
    "Now count on.",
    "Put the two groups together.",
    "Make ten first.",
    "Take one from here and give it to there.",
    "Add the tens, then add the ones.",
    "Carry the ten into the next column.",
    "About how many? Round each number first.",
    "Is that answer sensible?"
  ],
  "templates": [
    { "text": "How many more to make {value}?", "values": [5, 10] },
    { "text": "Double {value}. What is the total?", "values": [1,2,3,4,5,6,7,8,9,10] },
    { "text": "You have {value}. How many more to make ten?", "values": [1,2,3,4,5,6,7,8,9] },
    { "text": "Jump to the next ten from {value}.", "values": [/* the decades only */] }
  ],
  "groups": {
    "correct":   { "voices": ["Kore","Puck","Zephyr"], "phrases": ["That's the total!", "Yes — you added it!", …] },
    "incorrect": { "voices": ["Kore","Zephyr","Puck"], "phrases": ["Not quite. Count once more.", …] }
  }
}
```

### 7.2b The clip registry is global — praise needs scoping

`lib/voiceClips.ts` holds one `Map<phrase, url>` on `globalThis`, keyed by the phrase
text. It is not scoped per skill, and that cuts both ways:

- **Good:** addition's number words (`"one"`–`"twenty"`) already resolve to counting's
  recordings. The count-along is instant today, with no Gemini call and nothing recorded
  in addition's own folder.
- **Wrong:** reaction groups are appended into one shared pool, so `playReaction("correct")`
  in an addition round plays one of counting's eight clips. A child who adds 7 + 3 is
  told *"Brilliant counting!"* — and once addition is recorded, the pool becomes fourteen
  and **counting** starts saying *"You put them together!"*

**Fixed, 1 Sep 2026.** Groups are filed under the skill that declared them:
`registerSkillVoice(..., skillId)` writes `` `${skillId}:${name}` ``, `playReaction` takes
the skill and tries the scoped key first, and `playAnswerSound` passes `koda.skillId` —
already on the SDK. Counting keeps its own eight and is otherwise untouched; addition now
stays **silent** until it is recorded, rather than borrowing counting's words, which is
what `answerSound.ts` already documents as the correct fallback for a reaction.

Clips stay shared on purpose — `"seven"` is `"seven"`, and a second skill saying it should
not pay to record it again. Only reactions are scoped, because a reaction is written for
one subject and does not travel. Four tests in `lib/voiceClips.test.ts` hold the line,
including the one that matters most: a skill that has *declared* a group but recorded none
of it stays silent instead of falling through to a skill that did.

A bare, unscoped pool still answers a caller that registers without a skill id. Nothing in
the build does; it is there so an unscoped registration is not a silent failure.

### 7.2c Duplicate number words are the price of owning your own voice

The recorder works per skill folder and cannot know counting already has `"seven"`, so
recording addition would produce 21 duplicate clips. Either is defensible:

```bash
# lean on counting's numbers — records only the 28 lines new to the app
npm run voice:record -- --skill addition --folder lessons,prompts,phrases,correct,incorrect

# or own them — 49 clips, and addition stays whole if counting ever leaves the build
npm run voice:record -- --skill addition
```

The second matches the architecture's own rule, that a skill is what it teaches, what it
draws with and what it says. The cost is 21 calls for words the app can already say.

### 7.3 The budget rule

**Anything whose text interpolates more than one number stays on live TTS.** A
prompt like *"347 plus 285"* is thousands of clips; a template like *"Double 7"* is
ten. Counting learned this with `Base10Foundry`. Target: **≤ 220 phrases** for the
whole skill.

### 7.4 The commands (run after the build, not during)

```bash
npm run voice:record -- --skill addition --dry-run     # what would be recorded; no key
npm run voice:record -- --skill addition --limit 5     # hear five before paying for 200
GEMINI_API_KEY=… npm run voice:record -- --skill addition
npm run voice:record -- --skill addition --import ./my-voice   # a real person reading
```

Until then, `audio/manifest.json` is `{}` and every line speaks through live TTS.
That is a working state, not a broken one.

---

## 8. Tests

### 8.1 Structural — two lines, inherited

```ts
// addition.test.ts
describeSkillContract(skill);
describeActivitySmoke(skill);
```

Catches: a lesson pointing at a renamed activity, a `requires` naming nothing,
duplicate levels, a level gap, a `settingsSchema` field with no setting,
an activity that crashes on a real lesson's params.

### 8.2 Behaviour — one driver per engine

Twelve drivers in `addition.activities.test.tsx`, each reading the answer **out of
the telemetry**, never recomputing it:

```ts
const expected = (h: ActivityHarness) =>
  String((h.koda.only("learning.present").at(-1)!.args[0] as { expected?: string }).expected);

it("frames: filling the rest of the ten-frame", async () => {
  await expectStandardRound(frames, async (h) => {
    for (let i = 1; i <= Number(expected(h)); i += 1) await h.press(new RegExp(`^Space ${i}\\b`));
    await h.press(/^Check$/i);
  }, { params: { mode: "make_ten", aRange: [6, 6] }, level: 19 });
});
```

Pin the ranges in test params (`aRange: [6,6]`) so a driver is deterministic even
though the lesson is random.

### 8.3 Generator — the cheapest insurance

`additionNumbers.test.ts`: for each `PairSpec` the lessons use, draw 200 pairs and
assert every one satisfies it. This is where `regroup: "never"` producing a
regrouping pair gets caught — not on a child's tablet.

---

## 9. Course placement

52 lessons → 13 units of four, **appended after `u4`** so counting's level numbers
never shift.

| Unit | Title | Lessons |
|---|---|---|
| u5 | Putting Groups Together | 1–4 |
| u6 | Zero, One and Fingers | 5–8 |
| u7 | Frames and Bonds | 9–12 |
| u8 | Blocks and Charts | 13–16 |
| u9 | Doubles and Neighbours | 17–20 |
| u10 | Making Friendly Numbers | 21–24 |
| u11 | Facts That Help | 25–28 |
| u12 | Tens and Hundreds | 29–32 |
| u13 | Taking Numbers Apart | 33–36 |
| u14 | Trading Up | 37–40 |
| u15 | Chains and Totals | 41–44 |
| u16 | Missing Parts and Stories | 45–48 |
| u17 | Bigger Stories, Better Strategies | 49–52 |

(Unit boundaries follow level order, so they cut across engines. That is correct —
a unit is a week of a child's learning, not a folder of code.)

---

## 10. Build phases

Each phase is a commit. **Gate after every phase:** `npx tsc --noEmit` shows only the
baseline errors, `npm test` is green, `npm run build` is clean, and the lesson opens
in the running app at `localhost:3001` (not a harness — StrictMode double-mounts and
mobile viewports only show up there).

| Phase | Levels | New engines | Also | Why here |
|---|---|---|---|---|
| **0** | — | — | baseline capture, `additionNumbers.ts` + its test, `additionLayout.ts`, `additionPalette.ts`, the six SVGs | the generator is the dependency of everything; write and test it before any UI |
| **1** | 1–7 | A `CountTray` | manifest, `index.ts`, `addition.test.ts`, registry entry, `audio/manifest.json {}`, course u5–u6(part) | first playable round; the scaffold is proved by the two contract lines |
| **2** | 8–10 | B `FrameFill`, C `BondTree` | — | the two frames and the bond diagram; reuses counting's cell aria-labels |
| **3** | 11–12 | E `JumpLine` | — | the number line, in its simplest two modes |
| **4** | 13–14 | F `BlockYard`, G `PlaceValueDesk` | — | place value arrives; both engines start in their no-regroup mode |
| **5** | 15–17 | D `FactDeck` | — | fact recall; the relationship strip is the new idea |
| **6** | 18–26 | *none* | 9 lessons, **JSON only** | the payoff phase: nine techniques ship without a line of TSX. If this phase needs code, an engine was under-parameterised — fix the engine, not the lesson |
| **7** | 27–28 | I `ChainBoard` | L28 rides E | reordering chips; compensation is a second JumpLine mode |
| **8** | 29–35 | *none* | 7 lessons, JSON only (F, E, G modes) | second JSON-only phase; add engine modes only where the table says so |
| **9** | 36–39 | H `ColumnPad` | L36–37 ride F | trading, then the algorithm the trading explains |
| **10** | 40–42 | *none* | 3 lessons on I | |
| **11** | 43–45 | K `EstimateDial` | L45 rides C | estimation, then missing addend |
| **12** | 46–51 | J `StoryBoard` | story templates in JSON | the biggest engine; six modes, one bar model |
| **13** | 52 | L `StrategyPicker` | `strategyCards.ts` | needs all 51 to exist first |
| **14** | — | — | `voice.json`, dry-run the recorder, verify the phrase count | the lesson prompts are only final once all 52 exist |
| **15** | — | — | course.json u5–u17, Skill Manager pass, light/dark, narrow window, disable-toggle check | ship |

### 10.0 The rule that makes half these phases free

> **An engine is written once, complete with every mode the master table gives it —
> even when the lessons for those modes arrive four phases later.**

Phase 2 builds `FrameFill` with all four modes (`five`, `ten`, `make_five`, `make_ten`)
but ships only lessons 8 and 9. Phase 6 then adds `make-5` and `make-10` as **pure
JSON**. That is why three whole phases (6, 8, 10 — nineteen lessons between them) touch
no `.tsx` at all.

If a "JSON-only" phase turns out to need code, the engine before it was
under-parameterised. Fix the engine and note it — do not quietly special-case the lesson.

A consequence to respect: `describeActivitySmoke` mounts every registered activity, and
if no lesson points at it yet it mounts with `defaultParams` alone. **Every engine's
`defaultParams` must produce a playable question by themselves.**


### 10.2 Phase cards

Each card is the phase's contract: what it creates, what it must satisfy, and the one
signal that says it went wrong. Work one card at a time and do not start the next until
the gate is green.

**Every card inherits this gate** (not repeated per card):

```bash
npx tsc --noEmit     # only the Base10Foundry baseline errors (§0.1)
npm test             # fully green
npm run build        # clean
```

---

#### Phase 0 — Groundwork · no lessons, nothing registered

| | |
|---|---|
| **Goal** | Every dependency the twelve engines share exists and is tested before any UI |
| **Creates** | `internal/data/additionNumbers.ts` + `additionNumbers.test.ts`, `internal/data/additionLayout.ts`, `internal/data/additionPalette.ts`, `assets/{apple,bead,block,balloon,shell,star}.svg` |
| **Changes** | nothing outside `src/skills/addition/` |
| **Depends on** | the baseline capture in §0.1 |

**Requirements**

1. `additionNumbers.ts` exports the full surface in §4 — `randInt`, `drawPair`,
   `drawDouble`, `drawNearDouble`, `drawChain`, `drawFriendlyChain`, `drawRoundingPair`,
   `drawStory`, `withoutRepeat` — plus the predicates `isRegrouping`, `isBridging`,
   `digitsOf`, `carriesIn`, which is what makes the tests possible.
2. Every constraint path has a **bounded retry** (say 200 attempts) and then a
   deterministic constructive fallback. No `while (true)`.
3. `additionLayout.ts` is one size ladder for the whole skill — token, frame cell, block,
   chip, badge — stepping down with the viewport the way `countingLayout.ts` does.
   Minimum touch target 44px at the smallest step.
4. `additionPalette.ts` fixes the colour *roles*: addend A = violet, addend B = sky,
   total = emerald, the part being changed = rose, everything else ink. **No amber.**
5. Six SVGs, one per countable, no two silhouettes alike, equal optical weight.

**Done when** — 200 draws per spec satisfy the spec; `npm test` green. The app is
unchanged because nothing is registered yet, and that is correct.

**Wrong if** — a generator can return a pair the spec forbids, or a test needs a seed to
pass. These functions are random by design; the *properties* are what is asserted.

---

#### Phase 1 — Scaffold + `CountTray` · levels 1–7

| | |
|---|---|
| **Goal** | A registered, playable skill with seven lessons on one engine |
| **Creates** | `manifest.json`, `lessons.json` (7), `index.ts`, `voice.json` (groups only), `audio/manifest.json` = `{}`, `activities/CountTray.tsx`, `addition.test.ts`, `addition.activities.test.tsx`, `addition.hints.test.ts` |
| **Changes** | `src/skills/registry.ts` (one import, one entry), `src/curriculum/course.json` (u5) |
| **Depends on** | Phase 0 |

**Requirements**

1. `manifest.json`: `id: "addition"` (must equal the folder name — `generate-skill-seed.mjs`
   throws otherwise), `status: "draft"`, `audience.ages: [5, 9]`,
   `category: "operations"`, the six features and seven settings of §11, and the
   `requires` list of §2.2.
2. `voice.json` must exist **from this phase** — `index.ts` reads `voiceJson.groups`
   at import time. Ship the `groups` block now; the rest lands in Phase 14.
3. `CountTray` implements **all seven modes** (`count_all`, `combine`, `count_on`,
   `count_on_larger`, `add_zero`, `add_one`, `fingers`) per §5.A.
4. Objects are `aria-label`'d `"<noun> <n>"`. Counting speech uses `useSpokenFinish`,
   never a fixed delay.
5. Lessons 1–7 exactly as the master table: ids, conceptKeys, `params.level` 1–7,
   `standards` (level 7 is `[]` **with** a `trajectoryLevel`), `ageBand`, and a
   `params.play` block carrying `audioPrompt`, `kidTip`, `stepByStep`,
   `targetObjective`, `shortDesc`, `prompts`.
6. `course.json` gains unit **u5** with levels 1–4. Levels 5–7 wait for u6 in Phase 2 —
   until then they open from a Skill Manager preview (§0.5).

**Done when** — the skill appears in the Skill Manager, all seven lessons open, a clean
round pays three stars, and the finish screen reads "Lesson 1 of …".

**Wrong if** — XP appears anywhere in the skill's own code, or `learning.present` is
called without an `expected`.

---

#### Phase 2 — `FrameFill` + `BondTree` · levels 8–10

| | |
|---|---|
| **Goal** | The two manipulatives most of the later strategies are explained with |
| **Creates** | `activities/FrameFill.tsx`, `activities/BondTree.tsx`, 3 lessons |
| **Changes** | `index.ts` (two activity entries), `course.json` (u6 completes: levels 5–8) |

**Requirements**

1. `FrameFill` ships **four** modes: `five`, `ten`, `make_five`, `make_ten` (§10.0).
2. `make_*` answers **how many were added**, not the total. Prompt and `expected` must
   agree — this is the likeliest bug in the skill.
3. Cells are `aria-label`'d `"Space n, filled"` / `"Space n, empty"`, matching
   `TenFrameRocket`, so the driver is a copy of counting's.
4. `BondTree` ships **four** modes: `whole_unknown`, `split_one`, `split_both`,
   `part_unknown`. Multi-box modes submit **once**, on Check (trap 11).
5. Lessons 8, 9 (frames) and 10 (bonds). Level 8 reuses `five-benchmark`, level 10
   reuses `part-whole-decomposer` — no new keys for these.

**Done when** — both engines pass their behaviour drivers with pinned ranges, and
`make_ten` is playable from a preview even though its lesson is nine levels away.

---

#### Phase 3 — `JumpLine` · levels 11–12

| | |
|---|---|
| **Goal** | The number line, in every form the skill will ever need |
| **Creates** | `activities/JumpLine.tsx`, 2 lessons |
| **Changes** | `index.ts`, `course.json` (u7 starts) |

**Requirements**

1. **Six** modes at once: `path`, `open`, `bridge_ten`, `bridge_hundred`, `compensate`,
   `jump_tens_ones`.
2. Arcs persist on screen — an open number line the child cannot see their own jumps on
   is a number path with the labels rubbed off.
3. Two-move modes (`compensate`, `jump_tens_ones`) require both moves before Check and
   accept them in either order.
4. The marker position is `aria-live`; the jump button reads `"Jump forward N"`.
5. Write down, in the file's header comment, **why this is not `counting/numberline`** —
   `FroggySkip` hops a fixed step to a target; this records arcs of chosen size. The
   registry rule says check for an existing interaction first, so the answer belongs in
   the code.

---

#### Phase 4 — `BlockYard` + `PlaceValueDesk` · levels 13–14

| | |
|---|---|
| **Goal** | Place value, as blocks and as columns |
| **Creates** | `activities/BlockYard.tsx`, `activities/PlaceValueDesk.tsx`, 2 lessons |
| **Changes** | `index.ts`, `course.json` (u7 completes) |

**Requirements**

1. `BlockYard` ships **five** modes: `build_add`, `multiples_ten`, `multiples_hundred`,
   `trade_ones`, `trade_tens`.
2. In the trade modes, a Check with an unbundled ten is **refused with the rung-2 hint**,
   not scored as a wrong answer. The child has not answered yet; they have not finished.
3. `PlaceValueDesk` ships **five** modes: `chart_add`, `chart_three`, `expanded`,
   `partial_sums`, `left_right`.
4. Every input is `themeSystem.field()` with `inputMode="numeric"`. No raw slate shades.
5. Both lessons here are **no-regroup** — the regrouping modes exist in code but have no
   lesson until Phases 8 and 9.

---

#### Phase 5 — `FactDeck` · levels 15–17

| | |
|---|---|
| **Goal** | Fact recall, and the relationships that make recall cheap |
| **Creates** | `activities/FactDeck.tsx`, 3 lessons |
| **Changes** | `index.ts`, `course.json` (u8 continues) |

**Requirements**

1. **Six** modes: `doubles`, `near_up`, `near_down`, `known_fact`, `family`, `commute`.
2. In `near_up` / `near_down`, naming the helper double is a **support**
   (`round.useSupport("walkthrough")`), not a scored answer. One question, one `submit`.
3. `commute` classifies a re-statement of the original fact as `errorKind: "reversed"`.
4. The `answerInput` setting (`pad` | `choices`) is read here with `koda.config.get`,
   which is what makes it a real setting rather than a line in a manifest.

---

#### Phase 6 — JSON only · levels 18–26 · **nine lessons, no TSX**

| | |
|---|---|
| **Goal** | Prove the architecture: nine techniques ship as data |
| **Creates** | 9 lesson entries |
| **Changes** | `lessons.json`, `course.json` (u9, u10, u11 fill) |

**Requirements**

1. Levels 18–19 → `frames` `make_five` / `make_ten`; 20–21 → `numberline`
   `bridge_ten` / `bridge_hundred`; 22–23 → `bonds` `split_one` / `split_both`;
   24–26 → `facts` `known_fact` / `family` / `commute`.
2. Each lesson writes its own `params.question` ranges from the master table, and its own
   `params.play` copy — the `kidTip` here is rung 1 of the hint ladder, so it must be the
   *strategy*, not a restatement of the question.
3. Levels 18 and 19 reuse `five-benchmark` and `make-ten`. Grep before writing.

**Done when** — nine lessons play and **`git diff --stat` shows no `.tsx`**.

**Wrong if** — any engine needed a new mode. That is a Phase 2/3/5 miss; go back and add
the mode to the engine with its own driver, then return here.

---

#### Phase 7 — `ChainBoard` · levels 27–28

| | |
|---|---|
| **Goal** | More than two addends, and the first mental adjustment |
| **Creates** | `activities/ChainBoard.tsx`, 2 lessons (27 on `multi`, 28 on `numberline` — JSON) |
| **Changes** | `index.ts`, `course.json` (u11 completes) |

**Requirements**

1. **Four** modes: `pairs`, `chain`, `compatible`, `running`.
2. Merging is tap-then-tap (§5.0): tap chip A, tap chip B, they become one chip.
   `"Chip 7"` labels; the merged chip announces its new value.
3. `running` has *n* sub-answers and one Check — still one `submit`.
4. Level 28 is a lesson only: `numberline` mode `compensate` already exists.

---

#### Phase 8 — JSON only · levels 29–35 · **seven lessons, no TSX**

| | |
|---|---|
| **Goal** | The tens/hundreds and written-strategy band, as data |
| **Changes** | `lessons.json`, `course.json` (u12, u13 fill) |

**Requirements**

1. 29–30 → `base10` `multiples_ten` / `multiples_hundred`; 31 → `numberline`
   `jump_tens_ones`; 32–35 → `chart` `chart_three` / `expanded` / `partial_sums` / `left_right`.
2. Levels 34–35 are the **first lessons that allow regrouping**. Check the generator spec
   is `regroup: "any"`, not the inherited `"never"` — a silently non-regrouping
   partial-sums lesson teaches nothing and looks fine.
3. Level 32 reuses `place-value-builder`.

**Done when** — seven lessons play; no `.tsx` in the diff.

---

#### Phase 9 — `ColumnPad` · levels 36–39

| | |
|---|---|
| **Goal** | Trading, then the algorithm that trading explains |
| **Creates** | `activities/ColumnPad.tsx`, 4 lessons (36–37 on `base10` — JSON; 38–39 on `column`) |
| **Changes** | `index.ts`, `course.json` (u14 fills) |

**Requirements**

1. Levels 36–37 are JSON on `BlockYard`'s `trade_ones` / `trade_tens`, reusing
   `unitiser-ten` and `unitiser-hundred`. They come **before** the algorithm on purpose.
2. `ColumnPad` ships `standard` (one carry) and `cascade` (two carries, three digits).
3. A column is not accepted until its carry is written; carry boxes are
   `aria-label`'d `"Carry into tens"` / `"Carry into hundreds"`.
4. `errorKind: "place_value"` for a right digit in the wrong column; `"off_by_more"` for
   a dropped carry.
5. Level 38's `ageBand` starts at 8, so it is invisible to the default age-6 viewer —
   set the viewer before saying it does not work (§0.5).

---

#### Phase 10 — JSON only · levels 40–42 · **three lessons, no TSX**

| | |
|---|---|
| **Goal** | The rest of `ChainBoard` |
| **Changes** | `lessons.json`, `course.json` (u14 completes, u15 starts) |

**Requirements** — 40 → `chain`, 41 → `compatible`, 42 → `running`; ranges per the master
table; no `.tsx` in the diff.

---

#### Phase 11 — `EstimateDial` · levels 43–45

| | |
|---|---|
| **Goal** | Estimation, reasonableness, and the missing addend |
| **Creates** | `activities/EstimateDial.tsx`, 3 lessons (43–44 on `estimate`; 45 on `bonds` — JSON) |
| **Changes** | `index.ts`, `course.json` (u15 completes, u16 starts) |

**Requirements**

1. **Two** modes: `round_estimate`, `reasonable`.
2. In `round_estimate` the `expected` is the **estimate**, not the exact sum, and the
   prompt says "about". A child who answers exactly right is still wrong here, so the
   feedback must say why without calling them wrong.
3. `reasonable` draws its claimed answers as ×10, ×100 or off-by-one, so the "why" is
   always one of a fixed, speakable set.
4. Level 45 is JSON on `bonds` `part_unknown`, with the blank in any of three positions.

---

#### Phase 12 — `StoryBoard` · levels 46–51

| | |
|---|---|
| **Goal** | The six problem types, on one bar model |
| **Creates** | `activities/StoryBoard.tsx`, `internal/data/storyCast.ts`, 6 lessons |
| **Changes** | `index.ts`, `course.json` (u16 completes, u17 starts) |

**Requirements**

1. **Six** modes: `join`, `ppw`, `change_unknown`, `start_unknown`, `compare`, `multi_step`.
2. Story text is **authored in `lessons.json`** as templates with `{a}`, `{b}`, `{name}`,
   `{thing}`. Code fills placeholders; code never writes sentences.
3. The cast is a short fixed list, not random strings — a familiar cast for the child, and
   a recordable set of frames for the voice.
4. Every story is read aloud on open (`audioPrompt`) and on demand. These children cannot
   read the problem; a story they can only read is a story they do not get.
5. `multi_step` is **two questions of the round**, not two answers to one question.

---

#### Phase 13 — `StrategyPicker` · level 52

| | |
|---|---|
| **Goal** | The lesson that looks back at the other 51 |
| **Creates** | `activities/StrategyPicker.tsx`, `internal/data/strategyCards.ts`, 1 lesson |
| **Changes** | `index.ts`, `course.json` (u17 completes) |

**Requirements**

1. `strategyCards.ts` tags each problem shape with the strategies that genuinely fit it.
   `48 + 19` → compensation, jump-tens-then-ones. **Not** doubles.
2. This is the one lesson with **more than one correct answer**. `submit` accepts any
   tagged strategy; the feedback names why each one fits.
3. Step 2 compares two worked paths and asks which took fewer steps. That is what
   "compare strategies" means at eight years old.

---

#### Phase 14 — Voice script · no lessons

| | |
|---|---|
| **Goal** | Every line the skill says is declared, and the recorder is proved — without spending anything |
| **Changes** | `voice.json` |

**Requirements**

1. Complete `voice.json` per §7.2: `numberWords`, `numberRange`, `phrases`, `templates`,
   and the `groups` already shipped in Phase 1.
2. **Do not list lesson prompts.** `generate-voice.mjs` collects `params.play.audioPrompt`
   from `lessons.json` itself.
3. Run the dry run and read the count:
   ```bash
   npm run voice:record -- --skill addition --dry-run
   ```
   Over ~220 phrases means a template is expanding over too wide a range. Cut the range;
   dynamic numeric lines belong on live TTS (§7.3).
4. Recording itself is **not** part of this build. It costs money per phrase and needs a
   key, so it stays a deliberate command run later.

**Done when** — the dry run lists a sane set and the app still speaks (through live TTS)
with `audio/manifest.json` still `{}`.

---

#### Phase 15 — Ship

| | |
|---|---|
| **Goal** | 52 lessons in the course, correct everywhere, visible to the right children |
| **Changes** | `course.json` audit, `manifest.json` (`status: "published"`), thumbnail SVG |

**Requirements**

1. All thirteen units u5–u17 present, in level order, appended **after** u4. Verify
   `getCourseUnits` numbers addition's lessons 1–52 in the same order as `params.level`
   (§0.4).
2. `src/assets/svg/thumbnail/addition-quest.svg` added, then `npm run svg:ids`.
3. `npm run skills:seed` regenerates `server/app/skill_defaults.json` — it runs inside
   `npm run build` too, but run it deliberately and read the diff.
4. Skill Manager: every feature toggle changes behaviour; every setting renders and is
   read; the Activity trail shows addition's rows; **disabling the skill removes all 52
   lessons** from the Learn page.
5. Light and dark, 360px wide, and a real round on a phone-sized viewport at
   `localhost:3001`.
6. Flip `status` to `"published"` **last**.


### 10.1 Phase definition of done

- [ ] Every new lesson opens from the Learn page **and** from a Skill Manager preview.
- [ ] A perfect round shows three gold stars; one mistake shows two gold and one hollow.
- [ ] The finish screen says "Lesson N of 52", and "Level" on it means XP level.
- [ ] Correct in **light and dark** and at 360px wide.
- [ ] Every random constraint holds over 200 draws (the generator test).
- [ ] Each new feature flag is actually read with `koda.config.isEnabled`.

---

## 11. Manifest — features and settings

Every feature must be *read*; a flag nothing checks is a lie in the Skill Manager.

| Feature id | Read by | Effect |
|---|---|---|
| `strategy_scaffold` | B, C, E, G, I | shows the strategy diagram (bond arms, jump arcs, partial rows). Off = answer only |
| `audio_speech` | A, B, E, F, K, L + `SkillHint` | speaks counts, totals and hints |
| `sound_chimes` | all | pop / success / error |
| `haptic_feedback` | A, B, F, I | vibration on a tap or a bundle |
| `running_total_badge` | A, E, I | the live total badge beside the work |
| `step_context_tags` | `SkillRound` | the "Warm-up / Guided" chip |

| Setting | Type | Read by |
|---|---|---|
| `warmupLabel` / `activityLabel` / `guidedLabel` / `milestoneLabel` | text | `tagLabels` on `SkillRound` |
| `speechRate` | number 0.5–2.0 | every `koda.speech.say` call |
| `answerInput` | choice `pad` \| `choices` | D, and any engine offering both |
| `hapticIntensity` | choice | `koda.haptics.pulse` |

---

## 12. Error register — the twelve traps

Each of these has already cost this codebase a day, or is a rule the contract test
enforces silently.

1. **`showTip` on `SkillRound`** — removed. Use `hints` + `round.hint`. (§0.1)
2. **A lesson with no `conceptKey`** — the SDK refuses events it cannot attribute, so
   the learning log stays *silently empty*. The contract test catches it; do not
   suppress it.
3. **A level gap** — build in level order (§2), or `numbers levels 1..n` fails.
4. **A missing `expected`** — every wrong answer files as `unknown`, and the
   behaviour driver fails with "presented a question with no expected answer".
5. **XP anywhere in the skill** — never. `scoreRound` owns it; stars come from
   first-try accuracy.
6. **A raw slate shade** — `themeSystem.field()`, `bg-surface`, `text-ink`,
   `border-line`. Check both themes.
7. **Amber / yellow** — hard to read in this app. Addition's palette is violet
   (addend A), sky (addend B), emerald (total), rose (the part being changed), ink.
8. **A cross-folder import** — never `from "../counting/..."`. Reuse goes through
   `kit/` or a lesson referencing `"counting/tenframe"`.
9. **`koda.config` is not reactive** — read at mount. A Skill Manager toggle applies
   next round. Do not build for live updates.
10. **`koda.speech.say()` resolves when the line has *finished*** — await it where the
    child must hear it before the round reacts. A fixed delay is a guess and was
    wrong on mobile. `useSpokenFinish` exists for this.
11. **One `submit` per question** — multi-box modes (bonds, partial sums, fact
    families) Check once and submit once, with `given` as the joined string.
    Submitting per box files four answers for one question and wrecks first-try accuracy.
12. **An unlabelled control** — every button needs an `aria-label` or visible text.
    If a test driver cannot find it, a screen reader cannot either; that is the bug,
    not the test.

---

## 13. Open decisions — settle before Phase 1

| # | Decision | Recommendation |
|---|---|---|
| 1 | Ship a `addition-quest.svg` thumbnail, or use an icon key? | Ship the SVG; counting has one, and the store row looks unfinished without it |
| 2 | `status: "draft"` while building? | Yes — `draft` until Phase 15, so a half-built skill is developer-only |
| 3 | Questions per round | 5, like counting. Story and column lessons may want 4 — set it per lesson, never in code |
| 4 | ~~Drag-and-drop, or tap-to-place?~~ | **SETTLED 2026-08-31 — tap-to-place everywhere.** The grammar is §5.0, and it is binding on all twelve engines |
| 5 | Do we fix `Base10Foundry`'s stale `showTip` first? | Not ours to fix in this build, but the baseline must be captured (§0.1) so its errors are never confused with new ones |
