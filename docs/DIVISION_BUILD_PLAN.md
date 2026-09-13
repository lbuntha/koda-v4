# Division — proposed build plan

Status: **complete — all nineteen phases built.** 68 lessons, 12 engines, 289
division tests green (2,940 across the whole repo, no regressions), every engine
driven by hand in the running app. Left as **draft**: see "What is outstanding"
at the end. Written against
[SKILL_BUILD_TEMPLATE.md](SKILL_BUILD_TEMPLATE.md); implementation rules live in
[SKILL_DEVELOPMENT.md](SKILL_DEVELOPMENT.md) and are not repeated here.

## Release scope

- **ID / name / ages:** `division` / Division / 7–12 (grades 3–6)
- **Learner outcome:** given any whole-number division within 4-digit ÷ 2-digit, the
  child chooses a route, carries it out, says what the remainder means in the
  situation asked about, and checks the answer by multiplying back.
- **Prerequisites (manifest `requires`):** `counter`, `skip-counter`, `count-on`,
  `part-whole-decomposer`, `place-value-builder`, `unitiser-ten`, `unitiser-hundred`,
  `equal-grouper`, `repeated-adder`, `array-reader`, `missing-dimension`,
  `known-fact-user`, `multiplicative-commutativity`, `column-multiplier`,
  `unbundler-ten`, `unbundler-hundred`, `rounding-estimator`
- **Included:** sharing and grouping meanings, array and number-line models, the
  inverse relation and division facts, remainders and their four interpretations,
  place-value division, partial quotients, short and long division, divisibility and
  factor work, estimation, word problems including mean, strategy choice.
- **Deferred:** fractions as division (`3 ÷ 4 = ¾`), decimal quotients beyond a single
  bridging lesson, negative dividends, algebraic division. These belong to the
  fractions and decimals skills.
- **Closest reference engine:** `src/skills/multiplication/` — same trajectory, same
  number-module pattern (`internal/data/multiplicationNumbers.ts`, 1,138 lines),
  same twelve-engine shape. Tests: `multiplication.activities.test.tsx`,
  `multiplication.practice.test.tsx`, `multiplication.manifest.test.ts`.

---

## 1. The one decision that shapes everything: two meanings, one symbol

`12 ÷ 3` is two different questions and children who only ever meet one of them
stall at remainders and at long division:

- **Sharing (partitive):** 12 sweets shared between 3 children. *How many each?*
  The divisor is a **number of groups**; the answer is a **group size**.
- **Grouping (quotative):** 12 sweets put into bags of 3. *How many bags?*
  The divisor is a **group size**; the answer is a **number of groups**.

Every model in this skill is tagged with which meaning it shows, because they
diverge where it matters:

| | Sharing | Grouping |
|---|---|---|
| Physical act | deal one at a time, round-robin | pull off a fixed lot, repeatedly |
| Number line | *cannot* be shown honestly | hop back by the divisor, count hops |
| Remainder | what cannot be dealt evenly | what is left of the final short lot |
| Long division | "how many hundreds each" | — |
| Leads to | unit rate, mean | measurement, ratio |

`ShareTray` (§3, engine A) is the only engine with a hard rule that both meanings
appear before any lesson mixes them, and `divisionNumbers.ts` carries `meaning:
"share" | "group"` on every drawn question so a generator cannot silently produce
grouping questions for a sharing lesson.

**Consequence for the number module:** nothing in this skill draws "a dividend and
a divisor". It draws a `Quotient { dividend, divisor, quotient, remainder, meaning }`
built from the *answer outwards* — pick quotient and divisor, multiply, add a
remainder that is provably less than the divisor. Drawing a dividend first and
dividing gives lessons whose remainders are whatever chance supplies, which is how
a "no remainder" lesson ships with remainders in it.

---

## 2. Architecture — 12 engines

An engine owns one thing the child's finger does. Lessons configure mode and number
constraints in JSON. No engine branches on `params.level`.

| # | Engine | Activity id | Primary interaction | Teaching levels |
|---|---|---|---|---|
| A | `ShareTray` | `share` | Deal a total out round-robin, or pull off lots of a fixed size | 1–8 |
| B | `ArrayDivide` | `array` | Given a total and one side, partition the array; read both divisions off it | 9–11 |
| C | `HopBack` | `numberline` | Hop back by the divisor to zero and count the hops; or forward to the total | 12–14 |
| D | `FactDeck` | `facts` | Answer a division fact from a named helper multiplication fact or table row | 15–21 |
| E | `RemainderYard` | `remainder` | Share into groups that do not come out even; record and interpret what is left | 22–25 |
| F | `PlaceValueDesk` | `chart` | Divide place by place; scale down by ten and a hundred | 26–30 |
| G | `ChunkPad` | `chunk` | Subtract easy multiples of the divisor and total the chunks taken | 31–32 |
| H | `DivisionPad` | `column` | Short and long division: divide, multiply, subtract, bring down | 33–39 |
| I | `FactorLab` | `factors` | Test divisibility, find factor pairs by dividing, factor to primes | 40–45 |
| J | `EstimateDial` | `estimate` | Round to compatible numbers, judge reasonableness, check by multiplying back | 46–48 |
| K | `StoryBoard` | `story` | Build a sharing or grouping bar model and solve its unknown | 49–55 |
| L | `StrategyPicker` | `strategy` | Choose and compare valid division routes | 56 |

Each engine also receives one mixed, unscaffolded practice lesson — levels 57–68.

### 2.1 What division reuses, and what it must own

**Reused by reference** (`activity: "multiplication/..."`, no code shared):

| Lesson | Reuses | Why it is literally the same screen |
|---|---|---|
| 16 `table-divide` | `multiplication/table` · `find_cell` | finding 56 in the 7-row and reading the column is one finger action, taught once |

**Owned, despite the shared name** — the rule from `MULTIPLICATION_BUILD_PLAN.md` §2.1
applies again. `FactDeck`, `PlaceValueDesk`, `EstimateDial`, `StoryBoard` and
`StrategyPicker` share names with three other skills and share nothing else:

- `DivisionPad` vs `ColumnPad`: multiplication's column writes partial products and
  adds shifted rows downward. Division's works **left to right** across the dividend
  and runs a four-step cycle with a bring-down. Different validation, different hint
  ladder, different refusal messages.
- `EstimateDial`: multiplication rounds both factors up or down freely. Division must
  round to **compatible** numbers (`347 ÷ 6 → 360 ÷ 6`, not `350 ÷ 6`), which is a
  different draw and a different explanation.
- `StoryBoard`: a division bar model marks the *whole* and asks for a part or a part
  count. Multiplication's marks a part and asks for the whole.
- `FactDeck`: holds a **multiplication** helper card for a **division** question. The
  inverse step is the thing being taught, and no existing deck has it.

**Deliberately not reused as a shared `kit/` helper:** `RemainderYard`'s leftover bin.
It looks like `CanvasBin` and should *use* `CanvasBin` for rendering
(`docs/canvas-layout-pattern.md`), but the leftover slot carries the `r < divisor`
invariant and must refuse a drop that breaks it. That is skill logic, not layout.

---

## 3. Master teaching table

Every constraint is enforced by `divisionNumbers.ts` (§5). Unless a row teaches them,
generators exclude `÷1`, `n ÷ n`, and duplicate questions within a round. `n ÷ 0` is
never drawn — it appears only at level 7, as a refusal.

| L | Technique | Lesson id | Engine · mode | conceptKey | Numbers / answer | Standards | Age |
|---|---|---|---|---|---|---|---|
| 1 | Share it out equally | `share-equally` | share · `share_out` | `equal-sharer` | 2–5 groups, size 2–6, no remainder; child deals, answers group size | 3.OA.A.2 | 7–9 |
| 2 | Make groups of a given size | `make-groups-of` | share · `group_by_size` | `measurer-divider` | total ≤ 40, divisor 2–6, no remainder; answers group count | 3.OA.A.2 | 7–9 |
| 3 | Which kind of question is it? | `sharing-or-grouping` | share · `which_meaning` | `division-meaning-reader` | a worded situation and a picture; name the unknown, not the answer | 3.OA.A.2 | 7–9 |
| 4 | Write the division sentence | `write-the-division` | share · `to_equation` | `division-equation-reader` | picture shown; build `a ÷ b = c`; the ÷ sign introduced here | 3.OA.A.2 | 7–9 |
| 5 | Halve it | `halving` | share · `halve` | `halver` | even totals 4–40; shown as two equal rows, not as a rule | 3.OA.C.7 | 7–9 |
| 6 | Divide by one, and by itself | `divide-by-one-and-self` | share · `identity` | `division-identity` | `n ÷ 1` and `n ÷ n`, n 2–20, both forms in every round | 3.OA.B.5 | 7–9 |
| 7 | Zero shared out — and the question with no answer | `zero-and-nothing` | share · `zero_rules` | `zero-division-reasoner` | `0 ÷ n` dealt and answered; `n ÷ 0` offered and **refused with a reason** | 3.OA.B.5 | 8–10 |
| 8 | Deal the leftovers into view | `some-are-left-over` | share · `see_leftover` | `leftover-noticer` | remainder 1..divisor−1 guaranteed; child only *notices*, does not yet record | 3.OA.A.2 | 8–10 |
| 9 | The array knows the answer | `array-to-quotient` | array · `total_and_side` | `array-divider` | total ≤ 144, one side 2–12 given, other 2–12 | 3.OA.A.4, 3.OA.B.6 | 8–10 |
| 10 | Two divisions from one array | `two-divisions-one-array` | array · `two_divisions` | `array-division-writer` | a≠b; both `ab÷a` and `ab÷b` required, checked together | 3.OA.B.6 | 8–10 |
| 11 | A row that does not finish | `array-with-remainder` | array · `partial_row` | `array-remainder-reader` | remainder 1..divisor−1; the short final row is the remainder | 4.OA.A.3 | 8–10 |
| 12 | Hop back to zero | `hop-back` | numberline · `back_to_zero` | `repeated-subtractor` | dividend ≤ 60, divisor 2–10, no remainder; every hop placed | 3.OA.A.3 | 8–10 |
| 13 | The hops are the answer | `count-the-hops` | numberline · `count_hops` | `hop-quotient-reader` | as 12; the question asks for the hop **count**, not the landing | 3.OA.A.3, 3.OA.B.6 | 8–10 |
| 14 | Skip count up to the total | `skip-up-to-total` | numberline · `forward_to_total` | `skip-counter` | step 2–10, total ≤ 100; forward hops, count them | 3.OA.C.7 | 8–10 |
| 15 | Four facts from three numbers | `fact-families` | facts · `family` | `multiplicative-fact-family` | a,b ≤ 12; all four equations required, checked together | 3.OA.B.6 | 8–10 |
| 16 | Divide with the times table | `table-divide` | **multiplication/table** · `find_cell` | `table-divider` | product ≤ tableCeiling²; find the total in a row, read the column | 3.OA.C.7 | 8–10 |
| 17 | The missing factor | `missing-factor` | facts · `missing_factor` | `missing-factor-finder` | `7 × ? = 56` and `56 ÷ 7 = ?` shown as the same question | 3.OA.A.4, 3.OA.B.6 | 8–10 |
| 18 | Divide by 2, 5 and 10 | `divide-by-2-5-10` | facts · `easy_divisors` | `easy-divisor-knower` | divisor 2, 5 or 10; quotient 2–12; helper card is `×` | 3.OA.C.7 | 8–10 |
| 19 | Divide by 4 and 8 — halve again | `halve-again` | facts · `repeated_halving` | `repeated-halver` | ÷4 as halve-halve, ÷8 as halve-halve-halve; the chain is shown | 3.OA.B.5, 3.OA.C.7 | 9–11 |
| 20 | Divide by 3, 6 and 9 | `divide-by-3-6-9` | facts · `known_multiple` | `known-fact-user` | divisor 3, 6 or 9; helper multiplication card offered, four options | 3.OA.C.7 | 9–11 |
| 21 | Use any fact you already know | `use-a-known-fact` | facts · `known_fact` | `known-fact-user` | within 144; choose the helper from four, then answer | 3.OA.B.5, 3.OA.C.7 | 9–11 |
| 22 | Write what is left over | `write-the-remainder` | remainder · `record` | `division-remainder-reader` | remainder 1..divisor−1 guaranteed; answer is the pair `q r r` | 4.OA.A.3, 4.NBT.B.6 | 8–10 |
| 23 | The leftover must be smaller | `remainder-check` | remainder · `too_big` | `remainder-bounds-checker` | a wrong answer with `r ≥ divisor` in every draw; child fixes it | 4.NBT.B.6 | 9–11 |
| 24 | What the leftover means here | `remainder-in-context` | remainder · `interpret` | `remainder-interpreter` | same numbers, four question endings: round up, round down, the remainder itself, share it on | 4.OA.A.3 | 9–11 |
| 25 | Which answer does the question want? | `choose-the-answer-form` | remainder · `choose_form` | `remainder-interpreter` | one situation, four candidate answers, exactly one fits | 4.OA.A.3 | 9–11 |
| 26 | Divide a multiple of ten | `divide-multiples-of-ten` | chart · `tens_quotient` | `tens-divider` | `k0 ÷ n`, exact; read as "k tens shared n ways" | 3.NBT.A.3, 4.NBT.B.6 | 9–11 |
| 27 | Divide by ten and a hundred | `divide-by-ten-hundred` | chart · `scale_down` | `place-value-scaler` | n 20–9900, exact; digits shown moving right, never "take a zero off" | 5.NBT.A.2 | 9–11 |
| 28 | Tens into tens | `tens-into-tens` | chart · `tens_into_tens` | `place-value-divider` | `a00 ÷ b0` and `a0 ÷ b0`, exact; the shared zero is cancelled, shown | 5.NBT.B.6 | 10–12 |
| 29 | Split by place value | `split-by-place` | chart · `split_exact` | `place-value-splitter` | 2–3 digits ÷ 1 digit, **every** place divides exactly (96÷3) | 4.NBT.B.6 | 9–11 |
| 30 | Split when a place does not divide | `split-with-exchange` | chart · `split_exchange` | `division-exchanger` | 84÷6 — tens place leaves one to carry down; exchange shown as blocks | 4.NBT.B.6 | 10–12 |
| 31 | Take away easy chunks | `partial-quotients` | chunk · `chunks` | `chunker` | 3–4 digits ÷ 1–2 digits; ×10 and ×5 chunks offered; any valid chunking accepted | 4.NBT.B.6, 5.NBT.B.6 | 10–12 |
| 32 | Fewer, bigger chunks | `efficient-chunks` | chunk · `big_chunks` | `efficient-chunker` | same draws; scored on reaching the answer in ≤ 3 chunks | 5.NBT.B.6 | 10–12 |
| 33 | Short division, nothing left over | `short-division` | column · `short_exact` | `short-divider` | 2–3 digits ÷ 2–9, every digit divides exactly, no exchange | 4.NBT.B.6 | 9–11 |
| 34 | Short division with an exchange | `short-division-exchange` | column · `short_exchange` | `short-division-exchanger` | 3–4 digits ÷ 2–9, at least one carry; the carry digit is written | 4.NBT.B.6 | 10–12 |
| 35 | Short division with a remainder | `short-division-remainder` | column · `short_remainder` | `short-division-remainder-writer` | as 34, remainder 1..divisor−1 guaranteed | 4.NBT.B.6 | 10–12 |
| 36 | When a place holds nothing | `zero-in-the-quotient` | column · `zero_digit` | `quotient-zero-placer` | a zero **inside** the quotient in every draw (e.g. 618÷6); the commonest silent error | 4.NBT.B.6 | 10–12 |
| 37 | Long division by a two-digit number | `long-division` | column · `long_exact` | `long-divider` | 3–4 digits ÷ 11–99, exact; the estimate step is its own move | 5.NBT.B.6, 6.NS.B.2 | 10–12 |
| 38 | Long division with a remainder | `long-division-remainder` | column · `long_remainder` | `long-division-remainder-writer` | as 37, remainder guaranteed; over- and under-estimates both recoverable | 5.NBT.B.6, 6.NS.B.2 | 11–12 |
| 39 | Keep going past the point | `remainder-as-decimal` | column · `decimal_tail` | `quotient-continuer` | exact to 1–2 decimal places only; the bridge to the decimals skill | 5.NBT.B.7, 6.NS.B.3 | 11–12 |
| 40 | Tests for 2, 5 and 10 | `divisible-by-2-5-10` | factors · `last_digit` | `last-digit-tester` | n ≤ 999; decided from the last digit, then verified by dividing | 4.OA.B.4 | 9–11 |
| 41 | Tests for 3 and 9 | `divisible-by-3-9` | factors · `digit_sum` | `digit-sum-tester` | n ≤ 999; digit sum built on screen; near-misses in every round | 4.OA.B.4 | 10–12 |
| 42 | Tests for 4 and 6 | `divisible-by-4-6` | factors · `combined_test` | `composite-rule-tester` | ÷6 as ÷2 **and** ÷3; ÷4 from the last two digits | 4.OA.B.4 | 10–12 |
| 43 | Find every factor by dividing | `factor-pairs-by-dividing` | factors · `factor_pairs` | `factor-finder` | n 12–120; divide by 1,2,3… and stop at the square root — the stop is taught | 4.OA.B.4 | 10–12 |
| 44 | Factors two numbers share | `common-factors` | factors · `common_factors` | `common-factor-finder` | pairs ≤ 100 with an HCF > 1 and at least two common factors | 6.NS.B.4 | 11–12 |
| 45 | Divide down to primes | `prime-factorisation` | factors · `prime_factors` | `prime-factoriser` | n 12–200, composite; factor tree; any valid order accepted | 4.OA.B.4, 6.NS.B.4 | 11–12 |
| 46 | Estimate with friendly numbers | `compatible-estimate` | estimate · `compatible` | `compatible-number-estimator` | dividend 3–4 digits; the *dividend* is adjusted to a multiple of the divisor | 3.OA.D.8, 5.NBT.B.6 | 10–12 |
| 47 | Is that answer sensible? | `is-it-reasonable` | estimate · `reasonable` | `reasonableness-checker` | a claimed quotient; wrong claims are place-value slips (×10) or a dropped zero | 3.OA.D.8 | 10–12 |
| 48 | Check by multiplying back | `check-by-multiplying` | estimate · `check_back` | `inverse-checker` | `q × d + r` rebuilt and compared with the dividend; remainder included | 4.NBT.B.6 | 10–12 |
| 49 | Sharing story — how many each | `sharing-story` | story · `size_unknown` | `group-size-modeler` | total ≤ 200, groups 2–12, exact | 3.OA.A.3 | 8–10 |
| 50 | Grouping story — how many groups | `grouping-story` | story · `count_unknown` | `group-count-modeler` | total ≤ 200, size 2–12, exact | 3.OA.A.3 | 8–10 |
| 51 | A story with something left over | `remainder-story` | story · `remainder_context` | `remainder-interpreter` | the four interpretations of level 24, now unlabelled | 4.OA.A.3 | 10–12 |
| 52 | How much for one? | `unit-rate-story` | story · `unit_rate` | `unit-rate-finder` | total and count given; answer is the per-one amount | 6.RP.A.2 | 10–12 |
| 53 | How many times as many? | `how-many-times-story` | story · `times_comparison` | `multiplicative-comparer` | comparison bars; an additive "how many more" distractor in every draw | 4.OA.A.1, 4.OA.A.2 | 10–12 |
| 54 | Two steps, one of them a division | `multi-step-story` | story · `multi_step` | `division-multi-step-solver` | one division plus one other operation; every stage a whole number | 4.OA.A.3 | 10–12 |
| 55 | The fair share of a set — the mean | `mean-as-fair-share` | story · `mean` | `mean-finder` | 3–6 values, whole-number mean; bars levelled on screen before any sum | 6.SP.B.5.C | 11–12 |
| 56 | Which route, and why | `explain-and-compare` | strategy · `compare_paths` | `division-strategy-chooser` | tagged pool; accept every genuinely fitting route | 3.OA.D.8, 5.NBT.B.6 | 11–12 |

**Practice, levels 57–68** — one per engine, `practice: true`, modes cycled:
`practice-share` (57), `practice-array` (58), `practice-numberline` (59),
`practice-facts` (60), `practice-remainder` (61), `practice-chart` (62),
`practice-chunk` (63), `practice-column` (64), `practice-factors` (65),
`practice-estimate` (66), `practice-story` (67), `practice-strategy` (68).

**Totals: 68 lessons — 56 teaching, 12 practice. 12 engines, ~58 modes.**

`trajectoryLevel`: `sharer` (1–5), `division-properties` (6–8), `concrete-modeler`
(9–11), `repeated-subtraction` (12–14), `inverse-thinker` (15–17), `deriver` (18–21),
`remainder-reader` (22–25), `place-value` (26–30), `chunker` (31–32),
`written-methods` (33–39), `number-theory` (40–45), `estimation` (46–48),
`problem-solver` (49–55), `strategies` (56), `practice` (57–68).

### 3.1 Concept-key reuse

Reuse a key only when practice should update the same mastery record.

| Existing key | Reused at | Why it is the same concept |
|---|---|---|
| `skip-counter` (counting) | 14 | equal steps along the number sequence, unchanged |
| `known-fact-user` (addition, subtraction, multiplication) | 20, 21 | deriving an unknown fact from a chosen known one — the operation does not change the act |
| `factor-finder` (multiplication) | 43 | the same competence, reached by dividing instead of by building arrays |
| `place-value-scaler` (multiplication) | 27 | scaling by powers of ten; down is the same idea as up |
| `group-size-modeler` (multiplication) | 49 | multiplication L52 already teaches this exact unknown; one record |
| `group-count-modeler` (multiplication) | 50 | multiplication L51, likewise |
| `reasonableness-checker` (addition, subtraction, multiplication) | 47 | the same magnitude judgement |

Deliberate **non**-reuse — each of these would corrupt a record if taken:

| Tempting key | Why not | New key |
|---|---|---|
| `remainder-counter` (subtraction) | subtraction's is "count what is left after taking away". A division remainder is bounded by the divisor and is evidence the sharing *stopped*. Different check, different meaning | `division-remainder-reader` |
| `fact-family` (addition, subtraction) | additive part–whole and multiplicative part–whole are learned years apart from different evidence | `multiplicative-fact-family` |
| `halver-doubler` (multiplication) | that key is a *multiplication* shortcut (16×5 → 8×10). Halving as division is the operation itself | `halver` |
| `rounding-estimator` (addition, subtraction, multiplication) | division rounds to a **compatible** number, not the nearest one. A child fluent in one is not fluent in the other | `compatible-number-estimator` |
| `column-multiplier` (multiplication) | multiplication's column adds shifted rows downward; division's runs left-to-right with a bring-down | `short-divider`, `long-divider` |
| `equal-grouper` (multiplication) | building groups from a group size is not partitioning a known total | `equal-sharer`, `measurer-divider` |
| `multiple-recogniser` (multiplication) | "does a hop land here" is not "does this divide exactly, and how do I test it" | `last-digit-tester`, `digit-sum-tester` |

### 3.2 Practice lesson order

Practice lessons run 57–68 in engine order, each `requires` the **last** teaching
conceptKey of its engine, so practice never unlocks before the technique it mixes.

---

## 4. Features and settings

Manifest features (each must change behaviour and carry a test — §0):

| Feature | What it changes |
|---|---|
| `audio_speech` | prompts, dealing counted aloud, hints, refusal reasons |
| `sound_chimes` | deal, hop, exchange and answer chimes |
| `haptic_feedback` | a deal landing, a hop, a bring-down |
| `counting_badges` | numbers each object as it is dealt, each hop as it lands |
| `remainder_badge` | shows the leftover count as it grows in the leftover bin |
| `inverse_scaffold` | shows the matching multiplication beside the division being worked |
| `times_table_chart` | look-up chart on fact lessons; never during practice |
| `step_context_tags` | warm-up / guided / activity / milestone labels |
| `premium_lessons` | uses the Free lessons setting |

Settings: `answerInput` (choices / pad), `tableCeiling` (12 / 10), `speechRate`,
`freeLessons`, the four step labels, and one new one —
**`remainderNotation`**: `r` (`17 ÷ 5 = 3 r 2`) or `rem`. UK and US classrooms differ
and a child copying a different form from school reads their own correct answer as
wrong. Default `r`.

No yellow anywhere (`no-yellow-in-canvas-ui`). Division's palette: sky for the
dividend, violet for groups, emerald for the quotient, rose for the remainder.

---

## 5. `divisionNumbers.ts` — the single generator module

Same shape as `multiplicationNumbers.ts`: constraints declared, one judge, bounded
search, rare shapes constructed rather than waited for. Core type:

```ts
interface Quotient {
  dividend: number; divisor: number; quotient: number; remainder: number;
  meaning: "share" | "group";
}
interface QuotientSpec {
  divisorRange?: [number, number];
  quotientRange?: [number, number];
  dividendRange?: [number, number];
  remainder?: "never" | "always" | "any";
  exchange?: "never" | "some" | "any";   // does a place fail to divide?
  zeroInQuotient?: "never" | "always" | "any";
  meaning?: "share" | "group";
  excludeTrivial?: boolean;               // ÷1 and n÷n
}
```

Built from the answer outwards: draw `quotient` and `divisor`, draw `remainder` in
`[0, divisor)` per the spec, set `dividend = quotient * divisor + remainder`. This
makes `remainder: "never"` and `remainder: "always"` exact rather than probable, and
it is why `zeroInQuotient: "always"` (level 36) is constructible at all.

Guaranteed-invariant tests, before any engine exists:

- every draw satisfies `0 ≤ r < divisor` and `q·d + r = dividend`
- `remainder: "never"` over 2,000 draws yields zero remainders — and `"always"` yields
  none without
- `exchange: "never"` means every place of the dividend divides the divisor exactly
- `zeroInQuotient: "always"` puts the zero **inside**, never leading or trailing
- `meaning` is honoured; number-line modes refuse `meaning: "share"` at the type level
- distractors are place-value slips and off-by-one-group errors, never `answer ± 1`
- no draw repeats within a round (`withoutRepeat`, as multiplication)

---

## 6. Phases

One engine per phase, as multiplication was built. Each phase ends with: focused
tests green, the lessons playable in the real app at localhost:3001, and a 360px
light/dark check. Full `npm run lint && npm test && npm run build` at the gate
phases only (marked ⛳) — scoped vitest while iterating.

| Phase | Deliverable | Levels | New code |
|---|---|---|---|
| **0** | Pre-flight: baseline recorded, skill folder, manifest, `index.ts`, registration in `registry.ts` as **draft**, empty `audio/manifest.json`, `divisionNumbers.ts` with `Quotient`/`QuotientSpec` and its full invariant test suite. No lessons yet. | — | ~500 lines, mostly tests |
| **1** ⛳ | `ShareTray` — dealing, both meanings, the ÷ sign, halving | 1–5 | engine + 5 lessons |
| **2** | `ShareTray` properties: ÷1, ÷self, 0÷n, the refusal of n÷0, noticing leftovers | 6–8 | 3 modes, 3 lessons |
| **3** | `ArrayDivide` | 9–11 | engine + 3 lessons |
| **4** | `HopBack` | 12–14 | engine + 3 lessons |
| **5** ⛳ | `FactDeck` with the multiplication helper card; the reused `multiplication/table` lesson | 15–21 | engine + 7 lessons |
| **6** | `RemainderYard`, including the four interpretations | 22–25 | engine + 4 lessons |
| **7** | `PlaceValueDesk` | 26–30 | engine + 5 lessons |
| **8** | `ChunkPad` | 31–32 | engine + 2 lessons |
| **9** ⛳ | `DivisionPad` — short division | 33–36 | engine + 4 lessons |
| **10** | `DivisionPad` — long division and the decimal tail | 37–39 | 3 modes, 3 lessons |
| **11** | `FactorLab` | 40–45 | engine + 6 lessons |
| **12** | `EstimateDial` | 46–48 | engine + 3 lessons |
| **13** | `StoryBoard` | 49–55 | engine + 7 lessons |
| **14** | `StrategyPicker` | 56 | engine + 1 lesson |
| **15** | Practice — 12 lessons, no new engines; mode cycles verified per engine | 57–68 | 12 lessons |
| **16** | Worksheets: `WorksheetSource` adapters for the engines whose questions are written ones — `facts`, `remainder`, `chart`, `chunk`, `column`, `factors`, `estimate`. Picture engines (`share`, `array`, `numberline`) print only if figures are drawn | — | 7 adapters |
| **17** | Voice: `voice.json`, `npm run voice:plan -- --skill division` reporting 0 missing, recordings via `voice:record -- --provider openai` | — | — |
| **18** | Course placement: teaching and practice units appended separately to `course.json` | — | — |
| **19** ⛳ | Audit and publish: §0 checklist, §11 validation matrix with actual results, full offline round, real-app entry points, 360px pass, `status: "published"` | — | — |

**Phase 0 is not optional.** Multiplication's plan records that its Phase 0 caught
problems that would otherwise have been found in Phase 11. For division the specific
risk is higher: the remainder and exchange invariants are the whole skill, and a
generator that satisfies them "usually" produces lessons that teach the wrong thing
without ever failing a test.

### Suggested first cut

Phases 0–5 (levels 1–21) are a coherent, shippable release on their own: every
meaning of division, both models, and the facts — grade 3 complete, ages 7–10. It
is the natural point to stop and look before committing to written methods.

---

## 7. Open questions for review

1. **Level 39 (`remainder-as-decimal`)** reaches into the decimals skill that does not
   exist yet. Keep it as a bridge, or cut it and let decimals own it?
2. **Level 55 (mean)** is statistics wearing division's clothes. It is the best
   *application* of fair-sharing in the curriculum, but it may belong to a later
   data skill. Keep, or defer?
3. **`tableCeiling`** is a multiplication setting. Division should follow it rather
   than declare its own — but that means reading another skill's setting. Confirm:
   duplicate the setting, or add a shared one?
4. **Long division by two digits** (37–38) is grade 5–6 and the single hardest screen
   in the plan. Worth its own engine mode set, or should it be a separate later
   release once 1–36 are proven with children?

---

## 8. Build log

### Phase 0 — the generator, before any engine

`internal/data/divisionNumbers.ts` and its 29-test invariant suite, the manifest,
`index.ts`, registration in `registry.ts` as **draft**, an empty
`audio/manifest.json` and a `voice.json` carrying only the lines the plan commits
to. No lessons, no activity.

One thing changed from §5 as written: `QuotientSpec.exchange` takes
`"never" | "always" | "any"` rather than `"never" | "some" | "any"`, so every
frequency field in the spec reads the same way.

**What Phase 0 caught.** Nothing in the code — the invariants held first time —
but the suite caught a wrong *claim*. `exchangesIn(17, 5)` was expected to be 0
on the grounds that 17 / 5 is a single place. It is 1: the lone ten cannot be
divided by 5, so it is exchanged for ten ones. A `split-by-place` lesson drawn
with `exchange: "never"` would have been correct anyway — but the belief behind
the test was wrong, and it would have surfaced at level 29 as a lesson that
teaches place-by-place division using numbers that do not divide place by place.

### Phase 1 — `ShareTray`, levels 1-5

`share_out`, `group_by_size`, `which_meaning`, `to_equation`, `halve`. One finger
action — move a counter onto a plate, or back off it — with the tray *refusing* an
answer rather than marking one wrong when the deal is unfinished or unequal.

**What Phase 1 caught.** The kit's `describeSkillContract` refused the release:
level 5's hint and `kidTip` lean on doubling ("if you know double six is twelve,
you know half of twelve") and `doubles-knower` was not in the manifest's
`requires`. The lesson would have unlocked for a child who had never met doubles.
Declared, and the prerequisite chain is now honest.

### Phase 2 — the properties, and the first remainder

`identity`, `zero_rules`, `see_leftover` (levels 6-8). Two decisions worth keeping:

- **`n ÷ 0` never reaches the generator.** It is not a division with an awkward
  answer; it is not a division. `satisfiesQuotient` refuses a divisor below one,
  so the question is constructed by hand, offered as every third question of the
  round, and its right answer is a button that says it cannot be done. Picking
  `0` is scored **wrong** — it is the commonest misconception, not the answer.
- **The remainder rule is enforced with counters, not stated.** The tray refuses
  an answer while the leftover box still holds enough to go once round every
  plate. That is `r < d`, three levels before the notation exists, and a child
  can see it because the counters to do it with are in the box.

### What the first pass through the real app caught

Five issues that no test had, found by playing all eight levels at localhost:3001:

1. **The refusal nagged before the child had done anything.** "Deal them all out
   first." rendered straight from `blockedBecause`, so it was on screen before a
   single counter had been touched — a telling-off for not having started. It now
   waits for an attempted answer and clears on the next move.
2. **The situation looked like a fifth option.** On `to_equation` the story sat in
   a centred card on the same surface as the four answer buttons, directly above
   them. Now left-ruled body text.
3. **`20 ÷ 4 = 500` was being offered beside `= 5`.** `quotientDistractors`
   shuffled all usable candidates uniformly, so a hundred-times slip could beat a
   ten-times one. The candidate list is written most-plausible-first; it now takes
   in order and shuffles only for screen position.
4. **Level 8 pushed its own answer buttons off the bottom of the screen.** Thirty
   counters at full size. Counters shrink above eighteen, plates and pile are
   shorter.
5. **Level 7's first question read "Share all 0 between the 5 plates."** Now
   "There is nothing to share. How many does each of the 5 plates get?"

Four new tests cover 1 and 3. 2, 4 and 5 are visual and copy changes checked on
screen.

### Phases 3-14 — the other eleven engines

| Phase | Engine | Levels | What it turns on |
|---|---|---|---|
| 3 | `ArrayDivide` | 9-11 | The grid must be *built* before it will take an answer — reading a side off a shape you made is the technique |
| 4 | `HopBack` | 12-14 | Every question drawn through `drawGroupQuotient`, narrowed to `meaning: "group"` at the type level |
| 5 | `FactDeck` | 15-21 | The helper is written as a question (`7 × ? = 56`), never as its own answer |
| 6 | `RemainderYard` | 22-25 | `r < divisor` is a refusal, not a mark; four readings of one remainder |
| 7 | `PlaceValueDesk` | 26-30 | The split is computed, and 29 vs 30 is whether the digits can supply it |
| 8 | `ChunkPad` | 31-32 | The tally *is* the quotient; stopping early is refused with the evidence still on screen |
| 9-10 | `DivisionPad` | 33-39 | Digits judged where they are written, not at the end |
| 11 | `FactorLab` | 40-45 | Every test shown with its evidence; the factor tree is built by the child |
| 12 | `EstimateDial` | 46-48 | Division rounds to **compatible** numbers, not nearest ones |
| 13 | `StoryBoard` | 49-55 | The bar is cut before the answer counts; the additive trap is offered every time |
| 14 | `StrategyPicker` | 56 | Every genuinely fitting route accepted; `fits` predicates are the content |

### One planned reuse that did not survive contact

Level 16 was to reuse `multiplication/table` · `find_cell`. It is one finger
action — but `find_cell` asks "what is 7 × 8?", and a lesson titled "Divide with
the table" that asks a child to multiply is the exact silent mismatch §0 warns
about. It became `table_divide` on `FactDeck`: same grid, division's question —
find the total in a row, read off its column. The plan's reuse table is wrong on
this one row and right about the principle.

### What Phases 3-19 caught

- **Phase 3.** A square array made "two divisions from one array" into one
  division written twice, and the first offered distractor for a quotient is the
  *divisor* — which is the true value in the second sentence, so the question
  silently had two right answers. `distinctSides` was added to the generator
  spec; the distractor is now chosen to avoid the true side.
- **Phase 5.** The same square problem in `family`: `4 × 4` and `16 ÷ 4` each say
  themselves twice, so "four facts from three numbers" produced two. And
  `helperOptions` shipped three options instead of four whenever the quotient was
  2, because "one less than the quotient" clamped back onto the right answer.
- **Phase 7 — the largest catch of the build.** Levels 29 and 30 had been
  constrained with `exchange`, which asks whether *short division carries*.
  Splitting by place value is a different question: 420 ÷ 4 carries (2 tens will
  not divide by 4) **and** splits perfectly (400 and 20 both do). The constraint
  became `placeSplit`, a new frequency in the spec with its own judge. Without
  it, level 30 — "when a place will not divide" — would have been full of numbers
  whose places divide fine.
- **Phase 7, again.** The friendly-split search is correct but not *natural*: for
  342 ÷ 2 it offered 200 + 140 + 2. A child told to split into hundreds, tens and
  ones should see hundreds, tens and ones, so the place split is preferred
  wherever it works.
- **Phase 14.** Level 56 required its own `conceptKey`, which the contract suite
  caught as a prerequisite nothing earlier teaches.
- **Phase 16.** Seven engines print; five are pictures and report that they
  cannot, which `canPrint` surfaces rather than printing a caption beside a box.
- **Phase 19.** `mean-as-fair-share` carried `iconTone: "violet"`. That is not one
  of the six the host renders, and it becomes indigo without complaint — the
  §0 rule, caught exactly where §0 says it will be.

### Phase 17 — voice, scripted not recorded

`voice.json` holds the eighteen fixed lines this skill speaks, and every one of
them is a **refusal** — the sentence an engine says when it will not take an
answer yet. Everything else spoken is a question, generated per draw.
`npm run voice:plan -- --skill division` enumerates 74 lines (56 lesson
`audioPrompt`s plus the refusals) and reports all 74 unrecorded, which is correct
and expected: recording is a separate job, deferred deliberately. Until then every
line takes the live TTS path.

### Phase 18 — course placement

Fifteen new units, 76-90: eleven teaching and four practice, appended in that
order. All 68 lessons placed exactly once, every prerequisite taught before the
lesson that needs it, and no unit mixes teaching with practice.

### After the build — voice cut back, hints raised

Two related changes once the skill was finished:

**No prompt is read aloud.** This skill starts at seven and a seven-year-old can
read; reading the question to them takes the reading out of the question, which
in levels 49-55 is most of the work. `voice.json` sets `speaksPrompts: false`
(a new flag the recorder honours), all twelve engines pass `intro: undefined`,
and the clip count went from **74 to 18** — the eighteen refusals, which are not
reading but the app answering a move the child just made. Reactions still come
free from the common pack. The speaker button stays, unrecorded, on live TTS for
a child who needs it. `audioPrompt` stays in the lessons: `lib/worksheet.ts`
prints it as the sheet's instruction line.

**Which makes the hint ladder the only support left**, so it was audited rung by
rung across all 55 modes. Four things were wrong:

- The written method — levels 33-38, the hardest content — had **one ladder
  shared across five modes**. Its second and third rungs restated each other,
  and it offered `short_exact`, the mode that never carries, advice about what
  to do with a carry. Seven ladders now, one per mode.
- `halve` had `share_out`'s ladder **word for word**: it told a child to count
  plates and said nothing about halving. Its third rung is now the check that
  makes halving worth teaching apart — *does your answer, doubled, give you back
  what you started with?*
- `which_meaning` said "holders", a word on no screen a child sees. It now
  quotes the two phrases that actually distinguish the meanings.
- The fact deck's third rung read *"it takes more than six 5s to get there"* —
  true, vague, and for 6 ÷ 3 almost content-free. It now brackets against ten,
  the one multiple a child never has to work out.

`division.hints.test.ts` (13 checks over 288 ladders) guards all of it: no
repeated rung, no restatement, no shared ladder across the column modes, no
answer stated outright, no jargon.

## What is outstanding

The skill is **draft**, not published, and deliberately. Two of Phase 19's gate
items were not met:

1. **No 360px or dark-mode pass.** `resize_window` cannot narrow the browser
   window on this machine, so the phone-width layout of twelve engines is
   unverified. Several of them — the bus stop, the times-table row, the factor
   candidates — are the kind of wide layout that phone width punishes.
2. **`npm run lint` and `npm run build` cannot run in this repo.**
   `tsconfig.app.json` lists `@testing-library/jest-dom` in `types` and it is not
   a dependency, so `tsc --noEmit` stops before checking anything. Division was
   typechecked against a copy of the config with that entry removed and is clean.
   Pre-existing; not introduced here.

Voice recording is outstanding by choice rather than by omission.

Publishing is one switch in the Skill Manager once those are settled.
