# Fractions — proposed build plan

Status: **plan only.** Nothing built. Written against
[SKILL_BUILD_TEMPLATE.md](SKILL_BUILD_TEMPLATE.md); implementation rules live in
[SKILL_DEVELOPMENT.md](SKILL_DEVELOPMENT.md) and are not repeated here. Division's
plan is the nearest worked example — see
[DIVISION_BUILD_PLAN.md](DIVISION_BUILD_PLAN.md) §8 for what its nineteen phases
actually caught, several of which are pre-empted below.

## Release scope

- **ID / name / ages:** `fractions` / Fractions / 8–12 (grades 3–6)
- **Learner outcome:** given any fraction, mixed number, decimal or percent within
  grade 6, the child can place it on a line, name an equivalent, compare it to
  another, add, subtract, multiply and divide with it, and say what the whole was.
- **Prerequisites (manifest `requires`):** `counter`, `comparer`,
  `part-whole-decomposer`, `equal-grouper`, `place-value-builder`, `unitiser-ten`,
  `unitiser-hundred`, `multiplicative-commutativity`, `column-multiplier`,
  `equal-sharer`, `measurer-divider`, `halver`, `array-divider`,
  `division-remainder-reader`, `remainder-interpreter`, `short-divider`,
  `factor-finder`, `common-factor-finder`, `prime-factoriser`,
  `place-value-scaler`, `quotient-continuer`
- **Included:** equal parts and the unit fraction, fractions as numbers on a line,
  equivalence and simplest form, comparing and ordering, mixed numbers, the four
  operations, decimals and percents as other names, benchmark estimation, word
  problems, strategy choice.
- **Deferred:** ratio and proportion beyond a single percent bridge, rational
  numbers below zero, algebraic fractions. Those belong to a ratio skill and a
  pre-algebra one.
- **Closest reference engine:** `src/skills/division/` — the most recently built
  skill, the same twelve-engine shape, and the direct source of this skill's
  prerequisites. Tests: `division.hints.test.ts`, `division.audit.test.tsx`,
  `division.practice.test.tsx`.

**Division is a hard prerequisite, not a neighbour.** Simplifying needs
`common-factor-finder`; a common denominator needs `prime-factoriser`; `3 ÷ 4 = ¾`
needs `division-remainder-reader` and `remainder-interpreter`; and the decimal
bridge needs `quotient-continuer`, which exists precisely because division's level
39 was written as a bridge to here.

---

## 1. The one decision: a fraction is one number, of a whole somebody named

Nearly every fraction error a child makes is one of two beliefs, and both are
reasonable given how fractions are usually introduced:

- **"3/4 is a 3 and a 4."** Two numbers stacked up. It is why 1/2 + 1/3 becomes
  2/5, why 1/8 is thought bigger than 1/4, and why multiplying is expected to make
  things bigger.
- **"1/2 is a fixed amount."** Half a pizza and half a stadium are not the same
  quantity, and a child who has only ever halved one pizza has no reason to know it.

So two rules hold everywhere in this skill:

**A fraction is built from copies of its unit fraction.** `3/4` is `1/4 + 1/4 + 1/4`.
That single framing makes comparing, adding and multiplying all follow from one
idea rather than three rules: same denominator means same-sized pieces, so you
count them; different denominators means different-sized pieces, so you cannot.
Every engine that draws a fraction draws it as *that many of those*, and level 4
exists to establish it before anything else is asked.

**Every question names its whole.** The generator carries a `whole` — a bar, a
circle, a set of twelve counters, a length, a number — and it appears on screen.
Levels 3 and 19 are the two that make it the point, and the comparison engine
refuses to compare fractions of different wholes without saying so.

### Consequence for the generator

Nothing draws a numerator and a denominator. It draws a **whole**, a **partition**
it can honestly be cut into, and a **count** of those parts:

```ts
interface Fraction { whole: Whole; parts: number; taken: number }
```

Two constraints fall out of that, and both are silent failures if missed:

1. **The shape constrains the denominator, not the other way round.** A bar can
   show sevenths; a circle at thumbnail size cannot, and a set of twelve counters
   can only show denominators that divide twelve. Drawing `1/7` of a circle
   produces a picture whose parts are visibly unequal, which teaches the opposite
   of the lesson. `partitionsFor(whole)` is the single judge.
2. **An improper fraction and its mixed number are drawn from the same quantity.**
   `7/4` and `1¾` must be visibly the same amount of the same whole, or levels
   22–24 are two unrelated notations rather than two names.

---

## 2. Architecture — 12 engines

| # | Engine | Activity id | Primary interaction | Teaching levels |
|---|---|---|---|---|
| A | `FoldStrip` | `strip` | Cut a whole into equal parts, shade copies of the unit fraction | 1–6 |
| B | `FractionLine` | `numberline` | Place and name fractions as numbers on a line | 7–11 |
| C | `EquivalenceMill` | `equivalence` | Split or merge every part; read the new name for the same amount | 12–16 |
| D | `CompareBar` | `compare` | Line two fractions up against the same whole and judge | 17–21 |
| E | `MixedBoard` | `mixed` | Group loose parts into wholes, and break wholes back into parts | 22–24 |
| F | `AddStrip` | `add` | Add and subtract by counting same-sized pieces, re-cutting when they differ | 25–32 |
| G | `AreaGrid` | `multiply` | Shade one fraction across another on a grid | 33–37 |
| H | `ShareOut` | `divide` | Measure how many of one fraction fit inside another | 38–42 |
| I | `DecimalBridge` | `decimal` | The same quantity as a fraction, a decimal and a percent | 43–48 |
| J | `EstimateDial` | `estimate` | Judge against 0, ½ and 1 before calculating | 49–50 |
| K | `StoryBoard` | `story` | Model a fraction word problem on a bar | 51–56 |
| L | `StrategyPicker` | `strategy` | Choose a route that suits these particular fractions | 57 |

Each engine also receives one mixed, unscaffolded practice lesson — levels 58–69.

**Totals: 69 lessons — 57 teaching, 12 practice. ~58 modes.**

### 2.1 What fractions owns, and what it reuses

**Reused by reference** (`activity: "division/..."`, no code shared): none. It was
tempting to point level 52 — *four cakes shared between three* — at
`division/story`, but that engine's bar is cut into a whole number of parts and
its answer is a whole number with a remainder. Here the remainder *becomes* the
answer. Same story, different mathematics.

**Owned despite the shared name.** `EstimateDial`, `StoryBoard` and
`StrategyPicker` exist in three other skills and share nothing but a word.
Division estimates by moving a total to a compatible number; this one judges
against ½. The rule from `MULTIPLICATION_BUILD_PLAN.md` §2.1 applies again.

**Shared for real:** `kit/` gets nothing new. `NumberPad` is division's, in
division's `internal/ui`, and a skill may not reach into another's internals — so
fractions writes its own, and it needs a different one anyway: a fraction is two
fields and a bar, not a number.

---

## 3. Master teaching table

Every constraint is enforced by `fractionNumbers.ts` (§5). Unless a row teaches
them, generators exclude `1/1`, `n/n` and any partition the chosen whole cannot
be honestly cut into.

| L | Technique | Lesson id | Engine · mode | conceptKey | Numbers / answer | Standards | Age |
|---|---|---|---|---|---|---|---|
| 1 | Are the parts equal? | `equal-parts` | strip · `equal_or_not` | `equal-part-checker` | 2–8 parts, half the draws unequal; answer yes/no and fix it | 3.G.A.2 | 8–9 |
| 2 | One part of a whole | `unit-fraction` | strip · `name_unit` | `unit-fraction-namer` | 2–12 parts; name the single shaded part | 3.NF.A.1 | 8–9 |
| 3 | One half of **what**? | `name-the-whole` | strip · `which_whole` | `whole-namer` | same fraction, two different wholes; answer which is more | 3.NF.A.1 | 8–9 |
| 4 | Three of those | `build-from-units` | strip · `build` | `unit-fraction-builder` | shade `n` copies of `1/d`; the count is entered, never the pair | 3.NF.A.1 | 8–10 |
| 5 | Reading and writing a fraction | `read-and-write` | strip · `to_notation` | `fraction-notation-reader` | picture → `a/b`; distractors swap the two numbers | 3.NF.A.1 | 8–10 |
| 6 | A fraction of a set | `fraction-of-a-set` | strip · `of_a_set` | `set-fractioner` | set of 6–24, denominator divides it exactly | 3.NF.A.1, 4.NF.B.4 | 8–10 |
| 7 | A unit fraction on the line | `unit-on-a-line` | numberline · `place_unit` | `fraction-line-placer` | 0 to 1, 2–10 parts; drag to the tick | 3.NF.A.2.A | 8–10 |
| 8 | Any fraction on the line | `fraction-on-a-line` | numberline · `place_any` | `fraction-line-placer` | 0 to 1; numerator 1..d−1 | 3.NF.A.2.B | 8–10 |
| 9 | Name the point | `name-the-point` | numberline · `read_point` | `fraction-line-reader` | tick given, name it; unsimplified names accepted and noted | 3.NF.A.2.B | 9–11 |
| 10 | Fractions that make one | `equal-to-one` | numberline · `makes_one` | `whole-completer` | `d/d`; and the missing part to reach 1 | 3.NF.A.3.C | 9–11 |
| 11 | Past one | `past-one` | numberline · `improper` | `improper-reader` | 0 to 3; numerator > denominator | 4.NF.B.3.C | 9–11 |
| 12 | Cut every part in two | `split-every-part` | equivalence · `split` | `part-splitter` | split ×2, ×3, ×4; the amount shaded never changes | 3.NF.A.3.A | 9–11 |
| 13 | Same place, another name | `same-point-two-names` | equivalence · `two_names` | `equivalence-reader` | two lines, same point, different partitions | 3.NF.A.3.B | 9–11 |
| 14 | Make an equivalent fraction | `make-equivalent` | equivalence · `scale_up` | `equivalence-maker` | multiply top and bottom by 2–6 | 4.NF.A.1 | 9–11 |
| 15 | Cancel a common factor | `simplify-once` | equivalence · `scale_down` | `fraction-simplifier` | divide by a shared factor; not necessarily to simplest | 4.NF.A.1 | 10–12 |
| 16 | Simplest form | `simplest-form` | equivalence · `simplest` | `simplest-form-finder` | divide by the highest common factor; needs `common-factor-finder` | 4.NF.A.1 | 10–12 |
| 17 | Same pieces, count them | `compare-same-bottom` | compare · `same_denominator` | `like-comparer` | same denominator 3–12 | 3.NF.A.3.D | 9–11 |
| 18 | Same count, bigger pieces | `compare-same-top` | compare · `same_numerator` | `unit-size-comparer` | same numerator; **the level that exists for "1/8 > 1/4"** | 3.NF.A.3.D | 9–11 |
| 19 | Only if the whole is the same | `same-whole-only` | compare · `different_wholes` | `whole-comparer` | two different wholes; the right answer is "you cannot tell" | 3.NF.A.3.D | 9–11 |
| 20 | Compare to a half | `compare-to-half` | compare · `benchmark_half` | `benchmark-comparer` | numerator near half the denominator | 4.NF.A.2 | 10–12 |
| 21 | Make the pieces match | `compare-unlike` | compare · `common_denominator` | `unlike-comparer` | unlike denominators, one a multiple of the other in half the draws | 4.NF.A.2 | 10–12 |
| 22 | Loose parts into wholes | `improper-to-mixed` | mixed · `to_mixed` | `mixed-number-writer` | improper, 1–4 wholes | 4.NF.B.3.C | 9–11 |
| 23 | Wholes back into parts | `mixed-to-improper` | mixed · `to_improper` | `improper-writer` | mixed, 1–4 wholes | 4.NF.B.3.C | 9–11 |
| 24 | Mixed numbers on the line | `mixed-on-a-line` | mixed · `on_line` | `mixed-line-placer` | 0 to 4; both names shown at the same point | 4.NF.B.3.C | 10–12 |
| 25 | Add the same pieces | `add-like` | add · `add_like` | `like-adder` | same denominator, sum ≤ 1 in half the draws | 4.NF.B.3.A | 9–11 |
| 26 | Take away the same pieces | `subtract-like` | add · `subtract_like` | `like-subtractor` | same denominator | 4.NF.B.3.A | 9–11 |
| 27 | Why the bottoms do not add | `why-not-add-bottoms` | add · `refute` | `denominator-reasoner` | `1/2 + 1/3`; the child is shown `2/5` and asked to disprove it on the strip | 5.NF.A.1 | 10–12 |
| 28 | When one bottom fits the other | `add-one-divides` | add · `add_nested` | `nested-adder` | one denominator a multiple of the other | 5.NF.A.1 | 10–12 |
| 29 | Make the bottoms match | `add-unlike` | add · `add_unlike` | `unlike-adder` | any denominators ≤ 12; common denominator found, not given | 5.NF.A.1 | 10–12 |
| 30 | Subtract with different pieces | `subtract-unlike` | add · `subtract_unlike` | `unlike-subtractor` | as 29; result never negative | 5.NF.A.1 | 10–12 |
| 31 | Add mixed numbers | `add-mixed` | add · `add_mixed` | `mixed-adder` | parts sum past 1 in half the draws | 4.NF.B.3.C | 10–12 |
| 32 | Subtract with an exchange | `subtract-mixed` | add · `subtract_mixed` | `mixed-exchanger` | always needs a whole broken up | 4.NF.B.3.C | 11–12 |
| 33 | A fraction of an amount | `fraction-of-amount` | multiply · `of_whole` | `amount-fractioner` | `a/b` of 12–120, exact | 4.NF.B.4.C | 10–12 |
| 34 | Copies of a fraction | `whole-times-fraction` | multiply · `whole_times` | `repeated-fraction-adder` | `n × a/b`, n 2–8; shown as repeated addition first | 4.NF.B.4.A | 10–12 |
| 35 | A fraction of a fraction | `fraction-of-fraction` | multiply · `area_model` | `fraction-multiplier` | both proper; the overlap on a grid is the answer | 5.NF.B.4.A | 11–12 |
| 36 | Cancel before you multiply | `multiply-and-simplify` | multiply · `simplify_first` | `pre-simplifier` | a shared factor across the diagonal in every draw | 5.NF.B.4.A | 11–12 |
| 37 | Smaller, not bigger | `multiplying-makes-smaller` | multiply · `scaling` | `scaling-reasoner` | predict bigger/smaller/same before calculating | 5.NF.B.5 | 11–12 |
| 38 | How many halves in three? | `how-many-fit` | divide · `measure` | `fraction-measurer` | whole ÷ unit fraction, answer a whole number | 5.NF.B.7.B | 11–12 |
| 39 | Share a whole into fraction-sized pieces | `divide-whole-by-fraction` | divide · `whole_by` | `whole-divider` | whole ÷ `a/b` | 5.NF.B.7.B | 11–12 |
| 40 | Share a fraction between people | `divide-fraction-by-whole` | divide · `by_whole` | `fraction-sharer` | `a/b ÷ n`, n 2–6 | 5.NF.B.7.A | 11–12 |
| 41 | Divide by a fraction | `divide-by-fraction` | divide · `by_fraction` | `fraction-divider` | both proper | 6.NS.A.1 | 11–12 |
| 42 | Why it looks like flipping | `why-flip` | divide · `explain_flip` | `reciprocal-reasoner` | the measuring picture and the rule side by side | 6.NS.A.1 | 11–12 |
| 43 | Tenths, two ways | `tenths` | decimal · `tenths` | `tenth-reader` | `n/10` and `0.n` | 4.NF.C.6 | 10–12 |
| 44 | Hundredths | `hundredths` | decimal · `hundredths` | `hundredth-reader` | `n/100` and `0.nn` | 4.NF.C.6 | 10–12 |
| 45 | Divide to get the decimal | `fraction-to-decimal` | decimal · `by_dividing` | `fraction-decimal-converter` | terminating only; uses `quotient-continuer` | 5.NF.B.3 | 11–12 |
| 46 | Decimal back to a fraction | `decimal-to-fraction` | decimal · `from_decimal` | `decimal-fraction-converter` | 1–2 places, simplified | 4.NF.C.6 | 11–12 |
| 47 | Per hundred | `percent` | decimal · `percent` | `percent-reader` | percent as hundredths | 6.RP.A.3.C | 11–12 |
| 48 | Three names, one number | `three-names` | decimal · `three_names` | `representation-matcher` | match a fraction, a decimal and a percent | 6.RP.A.3.C | 11–12 |
| 49 | Nearly nothing, nearly a half, nearly one | `benchmarks` | estimate · `benchmark` | `benchmark-estimator` | judge before calculating | 5.NF.A.2 | 10–12 |
| 50 | Could that be right? | `is-it-reasonable` | estimate · `reasonable` | `fraction-reasonableness-checker` | wrong claims are added denominators, never off-by-a-little | 5.NF.A.2 | 11–12 |
| 51 | A fraction of an amount, in words | `amount-story` | story · `of_amount` | `amount-fractioner` | total 12–120 | 4.NF.B.4.C | 9–11 |
| 52 | Four cakes between three | `sharing-story` | story · `share_leftover` | `fraction-as-division` | the remainder **becomes** the answer | 5.NF.B.3 | 10–12 |
| 53 | Adding in a situation | `adding-story` | story · `add_context` | `context-adder` | unlike denominators | 5.NF.A.2 | 10–12 |
| 54 | Scaling a recipe | `recipe-story` | story · `scale` | `recipe-scaler` | multiply a mixed number by 2–4 | 5.NF.B.6 | 11–12 |
| 55 | How many times as much? | `comparison-story` | story · `compare_context` | `fraction-comparer-in-context` | division of two fractions | 6.NS.A.1 | 11–12 |
| 56 | Two steps | `multi-step-story` | story · `multi_step` | `fraction-multi-step-solver` | one fraction step and one other | 5.NF.B.6 | 11–12 |
| 57 | Which way, and why | `explain-and-compare` | strategy · `compare_paths` | `fraction-strategy-chooser` | tagged pool; accept every fitting route | 5.NF.A.1, 5.NF.B.4 | 11–12 |

**Practice, levels 58–69** — one per engine, `practice: true`, modes cycled.

`trajectoryLevel`: `equal-parts` (1–3), `unit-builder` (4–6), `fraction-as-number`
(7–11), `equivalence` (12–16), `comparer` (17–21), `mixed-numbers` (22–24),
`additive` (25–32), `multiplicative` (33–37), `quotative` (38–42),
`representations` (43–48), `estimation` (49–50), `problem-solver` (51–56),
`strategies` (57), `practice` (58–69).

### 3.1 Concept-key reuse

| Existing key | Reused at | Why it is the same concept |
|---|---|---|
| `equal-sharer` (division) | 1 | deciding whether parts are equal is the same judgement, on a shape instead of a tray |
| `common-factor-finder` (division) | 16 | simplest form *is* dividing by the highest common factor |
| `quotient-continuer` (division) | 45 | division level 39 exists as the bridge to this one; one record |

Deliberate **non**-reuse:

| Tempting key | Why not | New key |
|---|---|---|
| `comparer` (counting) | comparing whole numbers is "which has more"; comparing fractions is "of the same whole, which is more" — and level 19 is entirely about the difference | `like-comparer`, `unit-size-comparer`, `whole-comparer` |
| `halver` (division) | halving a quantity and naming one half of a whole are the act and the noun | `unit-fraction-namer` |
| `group-size-modeler` (division) | 4 cakes between 3 is 1 r 1 there and 4/3 here. The same story with a different answer is a different concept | `fraction-as-division` |
| `place-value-scaler` (division, multiplication) | tenths are a place *and* a fraction, and a child who has one does not have the other | `tenth-reader` |
| `multiplicative-comparer` (division) | "how many times as many" over whole numbers does not survive contact with fractions smaller than one | `fraction-comparer-in-context` |

---

## 4. Features and settings

| Feature | What it changes |
|---|---|
| `audio_speech` | hints, and the refusals an engine gives |
| `sound_chimes` | cutting, shading, snapping to a tick |
| `haptic_feedback` | a cut landing, a part shading, a snap |
| `part_labels` | writes the unit fraction inside every part, so the pieces name themselves |
| `equivalence_ghost` | shows the previous fraction faintly behind the new one, so equivalence is seen rather than asserted |
| `step_context_tags` | warm-up / guided / activity / milestone labels |
| `premium_lessons` | uses the Free lessons setting |

Settings: `speechRate`, `freeLessons`, the four step labels, and one new one —
**`fractionNotation`**: `slash` (`3/4`) or `stacked`. Classrooms differ, and a
child copying the other form reads their own correct answer as unfamiliar.

**`speaksPrompts: false` from the first commit.** This skill starts at eight.
See `SKILL_DEVELOPMENT.md` §0.1 — division recorded 74 clips and needed 18.

Palette: sky for the whole, violet for parts taken, emerald for the answer, rose
for what is left over or wrong. No amber or yellow (`no-yellow-in-canvas-ui`).

---

## 5. `fractionNumbers.ts` — the single generator module

```ts
type WholeKind = "bar" | "circle" | "set" | "length" | "number";
interface Whole { kind: WholeKind; name: string; size?: number }
interface Fraction { whole: Whole; parts: number; taken: number }

interface FractionSpec {
  partsRange?: [number, number];
  takenRange?: [number, number];
  wholeKinds?: WholeKind[];
  proper?: "always" | "never" | "any";
  simplified?: "always" | "never" | "any";
  /** For the pair modes: how the two denominators relate. */
  related?: "same" | "nested" | "coprime" | "any";
  excludeTrivial?: boolean;   // 1/1 and n/n
}
```

Built from the whole outwards. Invariant tests to write **before any engine**:

- `partitionsFor(whole)` refuses a denominator the shape cannot show honestly — a
  circle gets 2, 3, 4, 6, 8, 12; a set of 12 gets its factors; a bar gets 2–12
- every drawn `Fraction` has `taken ≤ parts` unless `proper: "never"`
- `simplified: "always"` returns only fractions in simplest form, and `"never"`
  only ones with a common factor — checked against `common-factor-finder`'s own
  arithmetic, not a second copy of it
- `related: "nested"` guarantees one denominator divides the other; `"coprime"`
  guarantees it does not
- an improper fraction and its mixed number describe the **same** quantity of the
  **same** whole
- distractors are named misconceptions — added denominators, swapped numerator and
  denominator, the bigger-bottom-is-bigger error — never `answer ± 1`
- no draw repeats within a round

---

## 6. Phases

| Phase | Deliverable | Levels |
|---|---|---|
| **0** | `fractionNumbers.ts` + invariants, manifest, `index.ts`, draft registration, `voice.json` with `speaksPrompts: false`, **and the thumbnail** (see §7) | — |
| **1** ⛳ | `FoldStrip` | 1–6 |
| **2** | `FractionLine` | 7–11 |
| **3** | `EquivalenceMill` | 12–16 |
| **4** ⛳ | `CompareBar` — including level 19, the one that refuses | 17–21 |
| **5** | `MixedBoard` | 22–24 |
| **6** | `AddStrip` — like denominators, and the refutation at 27 | 25–27 |
| **7** ⛳ | `AddStrip` — unlike denominators and mixed numbers | 28–32 |
| **8** | `AreaGrid` | 33–37 |
| **9** | `ShareOut` | 38–42 |
| **10** | `DecimalBridge` | 43–48 |
| **11** | `EstimateDial` | 49–50 |
| **12** | `StoryBoard` | 51–56 |
| **13** | `StrategyPicker` | 57 |
| **14** | Practice — 12 lessons | 58–69 |
| **15** | Worksheets: adapters for the engines whose questions are written ones | — |
| **16** | Voice: the refusals only, scripted; recording is a separate job | — |
| **17** | Course placement; `art:seed`; `docker compose restart api` | — |
| **18** ⛳ | Audit and publish: §0 checklist, §11 matrix, 360px and dark passes | — |

### What division's build says to do differently here

Five of division's nineteen phases lost time to things this plan can avoid:

- **Draw the thumbnail in Phase 0, beside the others.** Division's was claimed in
  the manifest for nineteen phases before anyone noticed it did not exist, and
  when drawn it copied the one sibling that breaks the shelf's style. `thumbnail`
  falls back to rendering the id as *text*, so a missing card throws nothing.
- **Run `art:seed` and restart the api in the same phase as the thumbnail.** The
  client and server keep separate art registries, and the server's only seeds at
  startup. Same for `skill_registry` — see [[new-skill-needs-api-restart]].
- **One hint ladder per mode, written when the mode is.** Division's written
  method shared one ladder across five modes; it restated itself and gave the
  no-carry mode advice about carrying.
- **Name every constraint after the thing it constrains.** Division spent a phase
  on `exchange` versus `placeSplit` — two conditions that sound identical and are
  not. Here the pair is `simplified` versus `related`: a fraction can be in
  simplest form *and* share a denominator relationship with its partner.
- **A row's label must name what its box wants.** Addition's left-to-right lesson
  labelled a running-total box "Then the ones", and children wrote the ones. In
  this skill the risk is everywhere a numerator box sits under a picture.

---

## 7. Open questions for review

1. **Circles at all?** They are the canonical fractions picture and they are bad
   at it — sevenths are indistinguishable from sixths by eye, and comparing two
   circles is harder than comparing two bars. Bars for everything, with circles
   only where a lesson names them? Or drop circles?
2. **Level 27 shows a child a wrong answer** (`1/2 + 1/3 = 2/5`) and asks them to
   disprove it. That is the most direct way to kill the misconception and it means
   putting an untruth on screen. Keep?
3. **Decimals inside fractions, or their own skill?** Levels 43–48 are six lessons
   that a decimals skill would also want. Bridge here and cross-reference later,
   or hold them back?
4. **Percent at level 47** is one lesson of a topic that deserves twenty. Bridge,
   or cut and leave it to a ratio skill?
5. **69 lessons is division's size again.** Fractions is arguably the hardest
   subject in primary mathematics and the one children most often lose. Is a
   bigger first release right, or is 1–32 (through mixed numbers) the honest cut?

### Phase 6 — `AddStrip`, levels 25–27

Built: `add_like`, `subtract_like`, `refute`, plus five more modes the engine
already carries for phase 7. 27 lessons, 206 tests.

What it caught:

- **`1 1/2 − 1.5/3`.** The first draw swapped numerators between the two
  fractions when a subtraction came out negative. A value matched against sixths
  is not a value over thirds, so the swap produced a fraction of a piece. Now
  each numerator is drawn in its own denominator, compared in matched terms and
  re-drawn — bounded at 60 attempts — when the relationship is wrong.
- **Three buttons on a four-button question.** `refuteQuestion` shuffled a list
  of four and sliced it, and `1/2 + 1/4` put `2/4` in the list twice. React kept
  one and dropped the other. Options are now collected through `uniqueOptions`,
  which drops both repeated strings and second spellings of the same amount —
  two buttons worth the same is a question with two right answers.
- **Distractors that collapse.** Where the pieces already match, three of the
  four method-shaped wrong answers *are* the right answer, so a like-denominator
  question had two options. The pool now runs to eight candidates in priority
  order, ending with the ordinary miscount.
- **Half the like-adding draws never crossed a whole.** The plan asks for half;
  random draws gave 21%. Now alternated by index, so a round shows both.
- **No way back.** Reported from a real session: a wrong answer leaves the work
  exactly as it was, and "Try again" returns to the same question. `SkillRound`
  now takes `onStartOver`, wired into every engine in fractions and division
  that holds something a child builds. Addition, subtraction, multiplication and
  counting still have the gap.
- The teaching walk was a hand-written list of modes, so an engine added without
  a line in it went unread. It is now checked against the curriculum.
