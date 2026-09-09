# Multiplication — proposed build plan

**Skill id:** `multiplication` · **Ages:** 6–10 · **Category:** `operations` ·
**56 teaching techniques + 12 practice lessons on 12 activity engines.**

This follows the executable shape of `SUBTRACTION_BUILD_PLAN.md`, which in turn
followed `ADDITION_BUILD_PLAN.md`. Those two skills settled the contracts this one
inherits: engines are parameterised by mode and never branch on level, practice ships
with the release rather than after it, every declared feature has a behaviour test,
worksheets are part of each engine, and course placement has its own invariant test.

> **Reference skills:** read `src/skills/kit/example/ExampleActivity.tsx`, then
> `src/skills/counting/index.ts` for registration. Open one production engine from
> `addition/activities/` only for behaviour the example does not show. Copy the public
> shape and kit usage, never an activity body.

## Status — complete, and published

Built 2026-09-08. **Twelve engines, sixty-eight lessons, levels 1–68** — the
whole skill. Gate green: lint, tests, production build. Placed in the course at
u48–u64. Voice recorded: 97 clips, `voice:plan` reports **0 missing**.

**Phase 6 passed the architecture check**: ten lessons, no new code, no level
branches.

**`status: "published"`.** The last act of the build, taken after the 360px and
dark passes came back clean. Two tests pin it: the audit asserts the status, and
the course test asserts that a nine-year-old *without* a developer flag is
offered all sixty-eight lessons — a skill that slipped back to draft would empty
itself off the Learn page with no other symptom.

Every phase from 3 on has been opened in the running app — Phase 3 lesson by
lesson, the rest through the Skill Manager preview. Each pass up to Phase 5
found a defect the suite could not see; Phase 6's found none, which is the
result that phase was designed to produce.

| Delivered | Where |
|---|---|
| Baseline | lint clean · 1,712 tests · build ✅ |
| Arithmetic contract | `internal/data/multiplicationNumbers.ts` — 10 specs, all bounded-search-then-scan-then-throw |
| Derived-fact ladder | `internal/data/helperFacts.ts` — 108 rows, 9 strategies, built from the per-table rule |
| Layout / palette | `multiplicationLayout.ts`, `multiplicationPalette.ts` — two grid densities, four semantic roles, no yellow |
| Artwork | `assets/` — apple, egg, pencil, sticker, coin, leaf. Flat, valid, yellow-free |
| Tests | `multiplication.numbers.test.ts` — 69 cases |

### What Phase 0 caught

Two defects that a green suite would not have shown, both of the kind this plan's
error register was written for:

1. **The comparison trap could be the answer** (§12 trap 15, shipped inside the
   generator). `times_as_many` drew its two numbers independently, and `base = 2`
   with `times = 2` gives `2 × 2 = 4` and `2 + 2 = 4`. That single pair would have
   marked the additive misreading — the exact confusion level 53 exists to correct —
   as correct. `drawMultiplicationStory` now rejects any pair where the two readings
   coincide, by the property rather than by excluding the literal.
2. **`factLevel` credited a table for a fact it never teaches.** `13 × 4` resolved to
   level 24, because the fours are taught there. But the fours run to twelve, so
   `13 × 4` is not a fact this skill owns, and a helper chain could have been built on
   one. `factLevel` now requires the *partner* to be inside the table's range before
   crediting that table — which is what makes §5.3 rule 3 enforceable rather than
   aspirational.

A third failure was the test being wrong rather than the data: near-square rows are
keyed by their smaller side, so `[3, 4]` shows up among the threes. The coverage check
now scopes to the table strategies and checks near squares separately.

### Phase 1 — `GroupTray`, levels 1–7

| Delivered | Where |
|---|---|
| Engine | `activities/GroupTray.tsx` — all seven modes, tap-to-place, refusals, worksheet adapter |
| Lessons | `lessons.json` — levels 1–7, contiguous |
| Scaffold | `manifest.json` (8 features, 7 settings), `voice.json`, `audio/manifest.json`, `index.ts` |
| Support | `multiplicationSound.ts`, `multiplicationChrome.ts`, `multiplicationAssets.ts`, `useNudge.ts`, `NumberPad.tsx` |
| Registration | `src/skills/registry.ts`, course units **u48** (levels 1–4) and **u49** (levels 5–7) |
| Tests | contract + smoke, 19 behaviour cases, 13 feature/setting cases, 11 course cases |

**`times_table_chart` was not declared.** The plan lists it among the manifest features,
but `GroupTray` has no chart to show and §0's rule is that a declared feature must change
behaviour and have a test. Declaring it now would ship a dead switch in the Skill Manager.
It arrives with `TableGrid` in Phase 5, which is the first engine that can honour it.

### What Phase 1 caught

1. **An infinite render loop that hung the round rather than failing it.** The
   per-question reset effect depended on the object `useNudge` returns, which is rebuilt
   every render — so the effect ran on every render, set state, and rendered again. No
   assertion fails on this; the test run simply never finishes, which is why it read as a
   hung suite rather than a bug. The effect now depends on the stable callback inside.
2. **`factor_roles` could draw a square.** Three groups of three has no wrong way round:
   both assignments of the two factors are correct, so the question scored without
   teaching anything. This is rule 2 of §5.3 — "never emit `a = b` where the task is about
   the two factors differing" — and level 5 is exactly such a task. `distinctFactors` is
   now set for that mode alone; the other modes still draw squares freely, because a
   picture of three groups of three matches exactly one sentence.
3. **A distractor that was a correct answer.** `groups_to_equation` offered
   `${groups} + ${size}` as a wrong option. For two groups of two that reads `2 + 2 = 4`
   — a true repeated addition of the picture on screen, which the child would have been
   marked wrong for choosing. The `+` option is now offered only above two groups, and no
   option may total the answer.

Two test-only faults are worth recording because both would have read as product bugs:
DOM queries deferred past `h.unmount()` return zero, which looks exactly like a feature
being switched off; and a `make_groups` round at six-by-six is 360 presses, which times
out under a loaded suite while proving nothing a two-by-two tray does not.

### Phase 1 follow-up — the sound was only half connected

Found on review, after the phase was first reported green. Three faults, all of which the
suite passed over because each was an *absence*:

1. **The engine never counted aloud.** The manifest's `audio_speech` promised "reads
   prompts, counts groups, and speaks hints", and the only `speech.say` in the engine was
   the read-aloud button. Addition's and subtraction's trays both say the number on every
   tap; for a six-year-old that count *is* the audio of the lesson. `GroupTray` now counts
   one-to-one inside a group as objects are placed, and speaks the running total —
   four, eight, twelve — as groups are added up, which is the skip count level 3 teaches.
2. **`voice.json` declared six lines the engine never said,** including two templates with
   placeholders it had no code to fill. Phase 15 would have recorded all six and played
   none. It now declares exactly the nine fixed refusal lines that are spoken, and a test
   reads the engine's source both ways: a declared line the engine never says fails, and a
   spoken line that is not declared fails.
3. **Refusals were silent.** The written nudge names the numbers, but a child who cannot
   read got a buzz and a chime and no way to learn what was wrong. Each refusal now has a
   fixed spoken sentence — recordable, unlike the dynamic text — while the on-screen line
   keeps the specifics.

Both gates are honoured: `audio_speech` for the activity's own speech, which the kit does
not cover, and `quietWhenPractising` on top of it, because a voice counting along with
retrieval practice is help. Five new tests hold it there.

The chime map was already correct and is unchanged: `playSound` consults the device's own
sound preference, so `sound_chimes` and the learner's mute both apply. Judged answers
chime, matching Addition. Subtraction defines `right`/`wrong` tones and never plays them,
which looks like a defect on that side rather than a pattern to copy.

**Still silent until Phase 15:** the spoken answer reaction. `playAnswerSound`
deliberately has no TTS fallback — a reaction fires on every answer, and a network round
trip between a child and their next question is worse than saying nothing — so praise
arrives when the clips are recorded, not before.

---

## Phase 2 — `ArrayGrid`, levels 8–12

All six modes shipped, including `split_array`, whose lesson does not arrive until level
33 in Phase 6. Writing the engine complete now is what lets that lesson be JSON.

| Delivered | Where |
|---|---|
| Engine | `activities/ArrayGrid.tsx` — six modes, resize by ± controls, worksheet adapter and figure |
| Lessons | levels 8–12; `teaches` gains five conceptKeys |
| Course | level 8 appended to **u49**; **u50** added for levels 9–12 |
| Voice | inventory regenerated from every engine — 15 spoken refusal lines |
| Tests | 17 array cases: one driver per mode, resize bounds, the commuted pair, refusals, split integrity |

### The design decisions worth recording

- **The array is resized, never redrawn.** A child who adds a row and watches the total
  jump by a whole row has seen where multiplication comes from; a child shown a fresh
  picture each question has seen five pictures. This is the one thing the engine does that
  an image could not, and it came straight from the Polypad benchmark.
- **± controls rather than a drag handle.** The plan offered either. Buttons are the
  keyboard path and the testable one; a drag handle would add pointer-event surface that
  jsdom cannot exercise, for an interaction the buttons already cover.
- **`commute` and `array_to_equation` refuse square arrays.** Same reason level 5 does:
  turning a 4 × 4 array changes nothing a child can notice, and "both sentences" for a
  square is one sentence written twice.
- **Both equations are one verdict.** Choosing one and being told would hand the child the
  other for free, and the pair *is* the idea.
- **`counting_badges` numbers the cells only at roomy density.** Past eight a side the
  cells are too small to carry a number, and the grid steps down; a badge that renders as
  an unreadable smudge is worse than none.

### What Phase 2 caught

Nothing in the product: every driver passed first run, and four repeat runs of the file
were clean. Two things are worth noting anyway.

- **`missing_dimension`'s driver read the wrong number.** It matched the first
  `\d+ squares` in the page, and the running-total badge also says "squares" — so the
  driver would have chased its own tail as the array grew. Narrowed to the prompt's own
  phrasing before it could flake.
- **A pre-existing Addition test now sits close to its timeout.** `addition.activities`
  runs 17s of test time, and its `base10` build loop presses up to 52 buttons a question
  across five questions. Adding this skill's suite raises parallel load and tipped that
  test over the 20s per-test limit once in three full runs. The logic is untouched and it
  passes on its own and on re-run; it is the same weight problem Phase 1 fixed in its own
  tests, in a file outside this build's scope.

## Phase 3 — `SkipTrack`, levels 13–16

All four modes shipped. One engine, one apparatus: hops are *placed*, one at a
time, and every landing is spoken as it is reached.

| Delivered | Where |
|---|---|
| Arithmetic | `HopRun` / `HopSpec` / `drawHopRun` / `hopKey` in `multiplicationNumbers.ts`; `MultipleSpec` gains a step **set** |
| Geometry | `HOP_LINE` and `HOP_LABEL_LIMIT` in `multiplicationLayout.ts` |
| Engine | `activities/SkipTrack.tsx` — four modes, ± hop controls, worksheet adapter and figure |
| Lessons | levels 13–16; `teaches` gains three conceptKeys |
| Course | **u51** — Hops, Lines, and Multiples |
| Voice | three new spoken refusals: "Make the hops first.", "You are at the start.", "The line stops there." |
| Tests | 27 number-line cases, 8 new arithmetic cases |

### The design decisions worth recording

- **The last landing is named as a product, right or wrong.** `4 hops of 5 is
  4 × 5 = 20` is in the feedback either way, and it has its own test. §12 trap 7
  is not a thing you avoid once; it is a line you have to keep saying.
- **`skip_count` counts in twos, threes, fours, fives and tens only.** The sixes
  to nines are not skip counts at this age — they are derived facts, and they
  arrive with `FactDeck` in Phase 4. This is why `HopSpec` takes a *set* of
  lengths and not only a range.
- **The line runs exactly one hop past the answer.** A line that stopped on the
  answer would answer the question; an unbounded one lets a child wander off the
  apparatus. One hop of room makes an overshoot possible *and* visible.
- **`count_multiples` hides the unmade landings.** Every other mode draws a tick
  wherever a hop can land, because on a short line those ticks are the
  apparatus. A line already ticked in fives answers "is 27 a multiple of 5" by
  itself, so that one mode shows only the hops actually made and the number in
  question.
- **`count_multiples` stops at sixty, not the plan's hundred and twenty.** A
  deliberate narrowing: 120 was written for a question, and this line is hopped.
  Sixty hops of two is not a lesson.
- **`productDistractors` is not used for the landings.** Its place-value slip
  offers ten times the product, which on a line ending at ninety is dismissed by
  size alone. The wrong landings here are one hop short, one hop long, and the
  two numbers added — the answers this task actually produces.
- **`missing_hop` judges a short run rather than refusing it.** Refusing until
  the child lands on the target would make every answer correct. Same call
  `missing_dimension` makes on the array.

### What Phase 3 caught

Nothing in the product; every driver passed first run. Three things are worth
recording anyway.

1. **A pinned `Math.random` pins more than the coin flip.** The test forcing a
   *non*-multiple set `Math.random` to a constant, and passed while asserting
   the opposite of what it meant to. At 0.9 the anchor lands on the ceiling and
   the only offset ever tried is `+2`, which overshoots two hundred times and
   drops `drawMultipleQuestion` into its documented fallback — a multiple. The
   test now feeds a *sequence*. The generator is correct: under real randomness
   `pick` finds `-1` or `-2` within a draw or two, and the fallback still
   returns a question whose label matches its own arithmetic.
2. **The features suite proves a switch works on one engine.** `counting_badges`
   and `strategy_scaffold` mean something different on every apparatus — cells,
   objects, landings — and `multiplication.features.test.tsx` drives `GroupTray`
   alone. Five feature cases now run against the line as well; a switch that
   reaches one engine and stops there is a dead control on two thirds of a skill.
3. **Three feature descriptions had gone out of date and nothing failed.**
   "Numbers the objects inside each group as they are placed" stopped being true
   when `ArrayGrid` shipped, and was wrong twice over once the line arrived. The
   Skill Manager shows that text to a parent; it is the only place a feature
   explains itself, and no test reads it. All five now describe what the switch
   does across the whole skill.

## Phase 4 — `FactDeck`, levels 17–19

All ten modes shipped. Seven of them have no lesson until Phase 6; writing them
now is what lets those nine derived-fact lessons arrive as JSON.

| Delivered | Where |
|---|---|
| Engine | `activities/FactDeck.tsx` — ten modes, helper card, route picking, worksheet adapter |
| Lessons | levels 17–19; `teaches` gains `doubles-knower`, `tens-multiplier`, `fives-multiplier` |
| Course | **u52** — Twos, Tens, Fives, and the Chart (level 20 joins it in Phase 5) |
| Voice | one new spoken refusal: "That one does not help." |
| Tests | 37 fact cases |

### The design decisions worth recording

- **The helper is a support, not a question.** Turning the card over files
  `useSupport("walkthrough")` and scores nothing. Fetching the fact the strategy
  is built on is the behaviour the lesson wants; scoring it would mark a child
  down for doing the thing they are being taught. Addition's `FactDeck` settled
  this and the shape is copied deliberately.
- **A lesson names its driving factor, not its level.** `add_a_group` derives
  both the threes and the sixes, `break_apart` the sevens, elevens and twelves.
  `drivers: [3]` versus `drivers: [6]` is the whole difference between levels 26
  and 27, so the engine never asks which level it is.
- **The helper's own product is offered every time.** Stopping at the helper is
  *the* error of a derived-fact lesson. `productDistractors` treats it as one
  candidate in ten and offers it about a third of the time, which is not often
  enough for the feedback that names the mistake to be worth writing.
- **A wrong route is refused, not scored.** `known_fact` withholds the answer
  buttons until a helper is chosen, and a card that does not help says why and
  stays on screen to be reconsidered.
- **`rowsFor` throws on an impossible lesson.** Asking `double_double` for the
  sevens is an authoring mistake; handing back the fours would hide it.

### What Phase 4 caught

1. **The picture and the sentence disagreed, and every test passed.** `10 × 2`
   was captioned "what is 2 tens?" and drawn as two sticks of ten. The product
   is right either way — which is exactly why 1,947 green tests said nothing —
   but this skill fixes `a × b` as *a groups of b* (decision 4), so that sentence
   reads *ten twos* and the model was of something else. This is §12 trap 2
   happening inside the one lesson whose entire content is which number counts
   what. Found by opening the lesson in the Skill Manager preview.

   Two fixes. `tens` now always draws `n × 10`, because n sticks of ten is the
   picture the place-value lesson needs and `n × 10` is the sentence that means
   it — a deliberate departure from the master table's `10 × n`, which was
   written before the convention was fixed. And `doubles` renders an honest
   `a × b` dot grid rather than two fixed rows, so `7 × 2` is seven twos on
   screen and says so, while `2 × 7` is two sevens and is called a double.
2. **A crash waiting on `n = 1`.** The master table asks for `n` from 1 for the
   doubles and tens. `1 × 2` has a product of 2, and there are not four distinct
   options for it that are not the answer plus or minus one — so
   `productDistractors` refuses, correctly, and the round would have thrown. The
   drill starts at two, which is where the identity lesson at level 6 already
   put it.
3. **Three test-only faults, all of which would have read as product bugs.** A
   support was asserted against the wrong telemetry name (`learning.useSupport`
   rather than `supportUsed`); a list of candidate cards was captured before the
   first press and went stale the moment the right one cleared the row; and a
   loop pressed the same card four times instead of four different ones, so it
   reported that twelve of twenty questions never accepted their helper. The
   refusal check now runs over twenty fresh questions, because which card helps
   is drawn per question and a single-question version passes or fails on the
   draw.

## Phase 5 — `TableGrid`, levels 20–23

All four modes, plus the two things this phase owed the rest of the skill: the
`tableCeiling` setting and the `times_table_chart` feature Phase 1 deliberately
left undeclared.

| Delivered | Where |
|---|---|
| Chart | `internal/ui/TimesTableChart.tsx` — one component, apparatus for `TableGrid` and reference for `FactDeck` |
| Patterns | `internal/data/tablePatterns.ts` — four rules, bounded draw, per-row notes |
| Engine | `activities/TableGrid.tsx` — four modes, worksheet adapter, true-square figure |
| Setting | `tableCeiling` (10 or 12) — reaches the chart **and** the factors drawn |
| Feature | `times_table_chart` — a reference chart in fact lessons, never in practice |
| Lessons | levels 20–23; `teaches` gains three conceptKeys |
| Course | level 20 appended to **u52**; **u53** added for 21–23 |
| Tests | 26 table cases, plus feature and setting coverage |

### The design decisions worth recording

- **The chart is not shrunk to fit.** Thirteen columns at a real touch size is
  about 620px. Squeezing that into 360px puts 26px targets under a seven-year-
  old's finger, so the chart keeps its size and scrolls inside its own
  container instead — which is what §6.E asked for and what trap 16 is about.
- **`find_cell` accepts either cell.** The chart really is symmetric and both
  cells really do hold the product. Teaching a child that only one of them
  counts would contradict level 10 and pre-empt level 23.
- **A pattern hunt is only a hunt if the answer is a proper subset.** "Tap every
  even answer in the twos" is every cell — a true observation and a pointless
  selection. A row and a rule are drawn together and kept only when the match
  is between two and eight cells, which is what makes the fives and the odd
  rows the ones that come up.
- **The "all of them" patterns are said, not tapped.** The nines digit sum and
  the tens column cannot be selection tasks for the same reason. They are
  carried as `noteFor` and spoken in the feedback for whichever row is in play,
  right or wrong — a round that only speaks on success has taught tapping.
- **`pattern_hunt` prints nothing.** A selection across a chart the sheet does
  not carry; rewriting it as "list them" would be different arithmetic (§9).

### What Phase 5 caught

1. **The scroll boxes could not scroll.** Measured in the running app: with its
   parent constrained to 360px, the times table sat at its full 620px and
   overflowed *upward* by 138px. `overflow-x-auto` never engaged, because
   nothing ever overflowed the box — every one of these boxes is a flex item,
   and a flex item defaults to `min-width: auto` and will not shrink below its
   content. `SCROLL_BOX` now carries `min-w-0 max-w-full`, which fixes the
   array and the number line too: both have had the same latent defect since
   Phases 2 and 3, and both would have pushed the page sideways on a phone.
   This is §12 trap 16, and the trap was written down four phases before the
   code that fell into it.
2. **Every engine was one question out of step in practice.** `useSkillRound`
   numbers its questions from one; the worksheet builder numbers them from
   zero; all five engines handed the hook's number straight to a builder that
   expected the other. Nothing failed — the cycle still covered every mode,
   just rotated — so a practice round would have quietly opened on its second
   technique. Invisible to a test that calls `buildQuestion` directly, which is
   what all of them did; there is now one that goes through the component.
   Worth catching before Phase 14 builds twelve practice lessons on it.
3. **The features suite refused to let the phase ship silently.** Its two audit
   tests — every declared feature has a test, every declared setting has a
   reader — failed the moment the manifest gained `times_table_chart` and
   `tableCeiling`, before either had been covered. That guard was written in
   Phase 1 and this is the first phase it has actually bitten on.

## Phase 6 — ten lessons, no code

The plan's main architecture check, and the reason the five engines before it
were written complete rather than to the level in front of them. Nine derived
techniques on `FactDeck` and the array split on `ArrayGrid`, all ten shipped as
entries in `lessons.json`.

| Delivered | Where |
|---|---|
| Lessons | levels 24–33 — `times-four` through `split-the-array` |
| Course | level 24 appended to **u53**; **u54**, **u55**, **u56** added |
| Manifest | eight conceptKeys, including `known-fact-user` reused from addition |
| Tests | `multiplication.ladder.test.tsx` — 9 cases |

**Nothing else changed.** No engine file, no new component, no parameter added
to a setup type. `times-three` and `times-six` are the same mode with different
`drivers`; `times-seven` and `times-eleven-twelve` likewise. That is what the
`drivers` parameter was added for in Phase 4, and this is the phase that
justified it.

### How the check was proved rather than asserted

"No new code" is easy to claim and easy to be wrong about, so the new test file
checks the two things that would show it false:

- **Every lesson the skill defines is mounted and asked for a question.** The
  shared smoke suite opens only the first lesson per engine, so nineteen of the
  thirty-three had never been opened at all. A lesson whose params its engine
  cannot serve now fails in a second rather than on a tablet.
- **No derived fact leans on a helper its own level has not reached** (§12 trap
  9). `factLevel` gives the earliest level at which each helper is known, and
  every one has to come strictly before the lesson deriving from it. This is
  §3.2's `requires` chain as an executable invariant rather than a diagram.
- **The helper card reconstructs the answer**, read back out of the card's own
  wording — "now double it", "now take one 8 away" — rather than out of the
  ladder's `derivedProduct`, which would only prove the table agrees with
  itself.

### What Phase 6 caught

1. **A lesson placed nowhere.** `near-squares` was defined and left out of every
   unit — the course held 32 of 33. Caught immediately by the placement test
   written in Phase 1, which is the whole reason course placement has its own
   invariant rather than being eyeballed.
2. **Nothing else.** Every one of the ten opened, drew from the right table, and
   showed the right helper the first time it was asked to; a full `times-eight`
   round played clean in the app with no console errors. The engines took the
   parameters the lessons handed them because they were written to be
   parameterised, which was the bet Phases 1–5 were placing.

## Phase 7 — `FactorBoard`, levels 34–37

Four modes, and two of them share one apparatus: ten numbers tried against a
total. Finding every pair and deciding whether any pair exists are the same act,
which is what lets a child who has never heard the word "prime" answer level 37
by doing exactly what level 36 taught them.

| Delivered | Where |
|---|---|
| Engine | `activities/FactorBoard.tsx` — four modes, candidate board, worksheet adapter |
| Arithmetic | `drawTriple` and `drawHalveDouble` given the scan-then-throw discipline |
| Lessons | levels 34–37; `teaches` gains four conceptKeys |
| Course | 34–36 appended to **u56**; **u57** added for 37 |
| Voice | five new spoken refusals |
| Tests | 29 factor cases |

### The design decisions worth recording

- **Neither grouping is ever refused.** `associative` records which pair the
  child multiplied first and accepts both, because the freedom to choose *is*
  the property. Refusing one would teach the opposite of the lesson.
- **The board judges pairs, not taps.** See below — this was nearly a defect.
- **Halving is refused twice over.** Once for an odd factor, and once for the
  direction that makes the product harder. Both are moves rather than answers,
  so neither is scored.
- **`prime_composite` refuses an answer before anything has been tried.** §6.L
  asks for it to be decided by attempting pairs on the board rather than by
  recall, and the only way to mean that is to require an attempt.

### What Phase 7 caught

1. **"Tap every divisor" is not "find every pair".** The board offers 1–10, and
   7 divides 28 — but `4 × 7` is the pair a tap on 4 already found, so 7 is the
   *larger* half of a pair, not a new one. The first version expected the set of
   divisors and would have marked a child wrong for noticing that 7 goes into
   28. A tap now contributes the pair it belongs to, either end finds it, and
   the button says which pair it named. Verified in the app on 45, where tapping
   the 9 correctly reads `5 × 9`.
2. **A rewrite that made the product worse.** `50` is in the halve-and-double
   partner list and is even, so `16 × 50` had two legal-looking directions —
   and halving the fifty gives `32 × 25`, honest arithmetic and harder than what
   it replaced. The draw now bars a factor that is already round, so exactly one
   direction is ever worth taking, and the other is refused with a reason.
3. **`1` on a primality board points at the wrong answer.** It divides
   everything, and it lit up in the same green as a real find. Removed from
   `prime_composite` and kept for `factor_pairs`, where `1 × 45` is a genuine
   pair. Every composite below 101 still has a divisor in 2–10, so the board can
   still settle every question it asks.
4. **Two generators from Phase 0 relaxed their own constraints.** `drawTriple`
   returned `lo × lo × lo` when its search ran out — legal only by luck, and 216
   for a ceiling of 120 with a range of sixes. `drawHalveDouble` returned a
   hard-coded `16 × 5` whatever range it was given. Both now scan and then
   throw, which is what §5 asks of every generator here. Neither had been called
   before this phase.
5. **A flaky test of my own.** "Refuses to halve the odd factor" pressed
   whichever factor was not the halved one — but the partner is drawn from
   5, 15, 25 and **50**, so one run in four pressed an even number and got the
   other refusal. Pinned the draw instead of hoping for it.

## Phase 8 — `PlaceValueDesk`, levels 38–40

Three techniques that are one sentence with a different place in it: `34 × 10`
is thirty-four tens, `3 × 40` is twelve tens, `30 × 40` is twelve hundreds.
Every one is `count × place`, which is why they share an apparatus.

| Delivered | Where |
|---|---|
| Arithmetic | `drawScaledProduct` + `PLACE_NAMES` / `PLACE_ABBREV` in `multiplicationNumbers.ts` |
| Engine | `activities/PlaceValueDesk.tsx` — three modes, four columns, worksheet adapter |
| Lessons | levels 38–40; `teaches` gains three conceptKeys |
| Course | 38–40 appended to **u57** |
| Voice | five new spoken refusals |
| Tests | 18 desk cases |

### The design decisions worth recording

- **Nothing in this engine adds a zero.** §12 trap 5 is the most-installed false
  rule in the topic and this is the age it gets taught, so the digits move and
  the zero *appears*. The feedback says so in as many words — "the ones column
  was left empty, that is where the zero comes from" — and a test greps every
  string the engine can produce for the forbidden phrasing.
- **A number that already ends in zero is never drawn for `times_ten_hundred`.**
  The zero a child is meant to watch arrive would be sitting there before they
  started.
- **The ones column is always on offer.** Putting `3 × 40` in the ones, or
  `30 × 40` in the tens, is the error these levels exist to correct — so a child
  has to be able to make it, and be told what they made.
- **`tens-scaler` rather than reusing `unitiser-ten`.** §3.1's non-reuse table
  is explicit: composing a ten and scaling by ten are related, not identical.
  `place-value-builder` goes in `requires` instead.

### What Phase 8 caught

1. **The desk read "T H T O".** Column headings were taken from the first letter
   of each place name, and thousands and tens both begin with a T — on a chart
   whose entire purpose is telling one column from the next. `PLACE_ABBREV`
   now spells them out, and a test asserts all four headings differ. Found by
   looking at the screen; no assertion in the suite could have cared.
2. **The arrows were the wrong way round.** "Move left" sat to the right of
   "move back", so a child pressed the right-hand button to send digits left.
   A small lie about the one motion this desk exists to show.
3. **A flaky test of my own, again.** The desk test pressed "12 of them" with a
   digit range that also produces 9 and 16. Read from the prompt now rather
   than assumed — the same mistake as Phase 7's, and worth noting twice: a
   range in the params is not a value in the question.

### Noted, not changed

The shared round chrome's "Try Again" button is `bg-amber-500`, which is the one
colour family this project does not use (§1.5). It is legible — the variant
forces `text-slate-900`, giving 14.6:1 — so this is a palette-consistency point
rather than a defect, and it belongs to `themeSystem.ts` and every skill that
renders a wrong answer, not to this phase.

## Phase 9 — `AreaModel`, levels 41–44

Four modes on one shape: read the area of a labelled rectangle, cut a two-digit
side at its place value, write that same cut as a column of rows, and do it
again with both sides split into four pieces.

| Delivered | Where |
|---|---|
| Engine | `activities/AreaModel.tsx` — four modes, place-value grid, worksheet figure |
| Lessons | levels 41–44; `teaches` gains four conceptKeys |
| Course | **u58** — Area and Partial Products |
| Tests | 17 area cases |

### The design decisions worth recording

- **The child places each partial product; they never type a total** (§12 trap
  11). The pool offers every right answer *and* the same digits a place out, so
  putting eighty where eight hundred belongs is a move a child can make — and
  is told about by name: "10 × 9 is 90, not 900."
- **Every piece carries its own label, always** (trap 10). The grid tracks are
  sized `minmax(floor, Nfr)` from the place-value split, so a `10 × 9` piece is
  visibly wider than a `6 × 9` one and neither can collapse to a sliver. Not to
  true scale, and honest about the ordering.
- **The unit squares are shown for the first two questions and gone after.** A
  child should move from counting squares to reading the sides inside one
  round, not across a term. `unitsUntil` makes that a lesson parameter.
- **`partial_products` prints no figure.** A written column is not a picture,
  and the other three modes' figure is essential — without it the task becomes
  a different question (§9).

### What Phase 9 caught

1. **The model grew to 560 × 336 pixels.** Honest proportions, and far more
   screen than a phone has: `fr` tracks with no bounding box let the tens-by-
   tens piece expand to fill whatever width was going. The grid now lives in a
   fixed box — 340 × 176 measured in the app — and the same ratios hold inside
   it. Only visible by looking at the thing.
2. **Two pieces can want the same number.** `12 × 12` cuts into 10×10, 10×2,
   2×10 and 2×2 — and two of those are both twenty. Listing the products
   straight put twenty on the board twice: two buttons that did the same thing,
   and two React children with the same key. The pool now holds one of each and
   placing does not consume, because a child putting twenty in two pieces is
   doing exactly the right thing.
3. **The row labels needed the grid's own track sizes.** Sized independently
   they drifted out of line with the pieces they name as soon as the pieces
   stopped being equal. Both the row and the column headings now share the
   grid's `gridTemplate`, so a label always sits against its own piece.

## Phase 10 — `ColumnPad`, levels 45–47

The written method, performed in the order it is written: right to left, one
digit at a time, carries in their own boxes.

| Delivered | Where |
|---|---|
| Arithmetic | `columnSteps` and `ColumnSpec.bNoZeroDigit` in `multiplicationNumbers.ts` |
| Engine | `activities/ColumnPad.tsx` — three modes, carry boxes, ruled worksheet frame |
| Lessons | levels 45–47; `teaches` gains three conceptKeys |
| Course | **u59** — The Written Method |
| Voice | four new spoken refusals |
| Tests | 18 column cases |

### The design decisions worth recording

- **The second row has to be named before it can be written** (§12 trap 12).
  `52 × 13` asks "what does the second row multiply 52 by?" and offers `× 1`,
  `× 10` and `× 100`. Answering with the bare digit is refused, not marked:
  *"The 1 in 12 is worth 10, not 1. The second row multiplies by 10 — that is
  where its zero comes from."* Nothing anywhere in this engine writes a
  placeholder zero as a keystroke.
- **The last carry is not a carry.** `47 × 3` ends by writing 1 in the
  hundreds — a digit of the answer, not something carried into a column that
  does not exist. `columnSteps` offers a carry box only where there is a column
  to carry into, and a test sweeps every `11–99 × 2–9` to hold it there.
- **The carries are checked like digits.** A child can reach the right total by
  a wrong route, so the feedback names the column: "the ones column should be
  0." A right answer arrived at wrongly is still wrong here.
- **`two_digit` enters whole rows, not digits.** Digit-by-digit was taught at 45
  and 46; repeating it across two partial rows and a sum is eleven entries a
  question. The lesson at 47 is the two rows and what the second one multiplies
  by. Four questions per round rather than five, as §15 decision 7 anticipated.
- **`46 × 30` is never drawn.** It has only one partial row, so there is no
  second row to ask about — and asking about it is the whole content of the
  level.

### What Phase 10 caught

1. **Typing a row scattered its digits across three rows.** The active row was
   derived from "the first empty one", so it moved the instant a row got its
   first digit: `115` went in as a 1, a 1 and a 5 in three different places.
   The active row is now held, and each row is a button a child aims at. Caught
   by the round driver failing to finish — the kind of bug that never throws.
2. **A pad on screen with nothing it could do.** While the multiplier question
   was up, every key was refused. A control that can do nothing should not be
   offered — the same call the read-aloud button gets when the voice is off —
   so the pad and Check now appear only once there is somewhere for a digit to
   go. The refusal stays behind them as a safety net. Found by looking at it.
3. **A wrong assertion of my own about place value.** The test claimed
   `rows[0].multiplier × 10 === rows[1].multiplier`, which is only true when a
   number's two digits match: `56` splits into 6 and 50, not 5 and 50. The
   invariant that actually holds is that the two parts sum to the multiplier.

## Phase 11 — `EstimateDial`, levels 48–49

Two modes: round each factor on its own dial and read off what the pair comes
to, then judge a claimed answer without working it out.

| Delivered | Where |
|---|---|
| Arithmetic | `drawEstimate` and `drawReasonableClaim`; `drawEstimateProduct`'s fallback fixed |
| Engine | `activities/EstimateDial.tsx` — two modes, per-factor dials, estimate as a support |
| Lessons | levels 48–49; both conceptKeys reused from addition and subtraction |
| Course | 48 completes **u59**; **u60** added for 49 |
| Tests | 17 estimate cases |

### The design decisions worth recording

- **A single-digit factor gets no dial.** Rounding six to the nearest ten gives
  ten, which is a bigger lie than the estimate is worth and teaches a child to
  round things that did not need it. Turning a dial that is not there is
  refused with that reason.
- **Every wrong claim is out by a whole place, never by one.** `47 × 18 = 847`
  against a true 846 is a computation question in an estimation lesson's
  clothes: it cannot be judged by estimating at all. Ten times out is exactly
  the size of error an estimate catches.
- **The estimate in `reasonable` is a support.** "Round them and see" files
  `useSupport` and scores nothing, the same shape as `FactDeck`'s helper card.
  A child who can judge without it should not be made to ask.
- **Both conceptKeys are reused** (§3.1): `rounding-estimator` and
  `reasonableness-checker` are the same competences addition and subtraction
  already record, so one mastery record each rather than two.

### What Phase 11 caught

1. **The exact answer was on screen before the estimating started.** The running
   line stood on the untouched factors, so `33 × 8` read **"About 264"** — the
   true product, under the word "about", in the one lesson that asks a child not
   to work it out. It now says "Round them to see" until a dial moves. Visible
   only by looking at it, and the worst defect of the phase by some way.
2. **A third Phase 0 generator relaxing its own constraints.**
   `drawEstimateProduct` returned a hard-coded `47 × 6` when its search ran
   out — a two-digit pair however many digits the lesson asked for. That is now
   scan-then-throw, matching the fixes `drawTriple`, `drawHalveDouble` and
   `drawScaledProduct` needed in earlier phases. Four of the ten specs written
   in Phase 0 had this fault; each was found by the first phase that called it.

## Phases 12–14 — the last two engines, and practice

| Phase | Delivered |
|---|---|
| 12 | `StoryBoard` — six shapes over a fixed cast in `storyCast.ts`; levels 50–55; **u60**, **u61** |
| 13 | `StrategyPicker` + `strategyPool.ts` — level 56, the one level with no single right answer |
| 14 | Twelve practice lessons, levels 57–68; **u62**, **u63**, **u64** |

### The design decisions worth recording

- **Nobody in the story cast has a pronoun.** A name carries no reliable
  information about how a person should be referred to, and every sentence here
  can be written without guessing — "Maya has four boxes" needs none. A test
  greps all six shapes for one.
- **Every comparison offers the additive misreading** (§12 trap 15). "Four
  times as many" read as "four more" is the whole content of level 53, and
  choosing it gets its own words — *"Times, not more"* — rather than a generic
  "not quite".
- **Wrong answers come from the shape of the story, not from its numbers.** In
  "how many groups", the two numbers stated are a total and a group size, and
  their product is nothing anyone would ever answer. Each shape names its own
  mistakes: reaching for the other number, stopping after the first step.
- **Level 56 accepts every route that fits.** Scoring one above another would
  teach the opposite of the lesson. What is refused is a route whose move
  cannot be carried out on these two numbers — halving needs an even factor —
  and the refusal says which move and why.
- **A practice lesson declares no `audioPrompt` and no `kidTip`.** It speaks
  nothing and shows no hints, so declaring either would mean a clip recorded
  and never played. The voice test now asserts both directions.

### What Phases 12–14 caught

1. **A two-step story could take everything away.** "Twelve, gives twelve away,
   how many now?" answers zero — true, and a poor question: nothing is left to
   have been multiplied, and every wrong answer beside it has to be bigger than
   the right one. The subtraction now leaves at least one behind, and where the
   first step is too small to take from, the story adds instead.
2. **A comparison could be between someone and themselves.** The second name
   was drawn with an offset that could come back round to the first. The offset
   is now at least one and less than the cast size.
3. **The voice test's own extraction was too narrow.** It matched `refuse(` with
   one expression, and three call sites choose their spoken line with a
   conditional — so it silently reported success over less than it was asked to
   look at. It now walks each call and reads the whole spoken argument.

---

## Phases 15–17 — voice, audit, and the pass before publishing

### Phase 15 — voice

97 clips recorded through **OpenAI** (`voice:record -- --provider openai`; the
script defaults to Gemini when both keys are present). `voice:plan` reports
**0 missing**. Only fixed lines are recorded — anything with a number in it goes
through live TTS, because a sentence that never repeats cannot be one clip, and
a test now keeps digits out of the inventory.

### Phase 16 — audit

`multiplication.audit.test.ts` checks the skill as a unit: the manifest teaches
exactly what its lessons carry, every setting has both a default and a control,
every lesson has an icon, a tone and a CCSS standard, every lesson prints (or
honestly declines), and the course holds all 68 once, in order, with teaching
and practice in separate units.

**Caught:** the thumbnail the manifest had named since Phase 1 did not exist —
`multiplication-quest.svg` is now drawn, an array with both its sentences.
`skip-counter` was taught at level 13 but never declared, the only reused key
that had been left out. And the yellow check failed on the word "yellow" inside
the artwork's own comment saying there is none — it now measures hue on the
colours themselves.

### Phase 17 — the pass before publishing

- **All twelve engines opened in the running app**, light and dark, with no
  console errors.
- **Nothing overflows.** Every activity's content column was constrained to
  360px and measured: the times table scrolls inside its own box (360 shown,
  636 of content) and the page never scrolls sideways.
- **Dark mode measured, not eyeballed.** Every text node in every engine was
  composited against what actually sits behind it and checked for contrast.
  Nothing below 4.5:1. The one finding — the `×` separators at 3.01:1 — has
  been lifted from `text-ink/35` to `/55`.
- **Caught along the way:** the sixth skill took the entry chunk past Workbox's
  2 MiB precache ceiling and the build began to fail. Offline is a requirement
  here rather than an optimisation, so the ceiling moved and the chunk stays
  precached; splitting the skills into lazy chunks would shrink the first load
  and cost a lesson that will not open on a train.

### What the first screenshot from a real user caught

A sentence in a square. `themeSystem.button(…, "choice")` is a fixed 56px box
with `p-0` — exactly right for a single digit, and exactly wrong for anything
with a space in it. Level 2's answers, **"Yes, all equal"** and **"No, one is
different"**, spilled out of their boxes on all four sides and collided with
each other; level 33's "Cut after row 3" did the same on the array.

Neither appeared in any test, and the reason is worth writing down: every driver
in this skill presses by accessible name, and a label reads back identically
whether or not its box can hold it. jsdom does no layout, so there was nothing
to measure either. The fix is a `WORD_CHOICE` shape that sizes to its text, and
the guard is a source scan — if a `choice` tile ever holds anything longer than
a digit or an operator again, the audit suite says so and names the file.

### The 360px pass, in the end

The browser tooling pins the tab at 1440 CSS pixels and `resize_window` does not
reach it, so a real narrow viewport was not available. What worked instead:
**switch the breakpoints off**. Tailwind v4 emits `@media (width >= 40rem)` and
up, those rules are reachable through `document.styleSheets`, and setting each
one's `mediaText` to `not all` leaves the base declarations in force. Proof it
took: a probe carrying `w-9 sm:w-11` measured 36px, its mobile value. With the
round's content column then pinned to 360px, that is the sub-640 layout rather
than a squeezed desktop one.

All twelve engines came back clean: **no shell overflow, no page overflow, no
element wider than the phone outside its own scroll box, and no touch target
under 36px**. Three engines reported a spill on one pass and measured zero on a
careful re-check — read too soon after the width change, before layout settled.

Two things to know for next time. The confirming sweep was cut short when the
page reloaded mid-evaluation and froze the tab, so the pass rests on the first
complete set of measurements plus the targeted re-checks, not on a second full
sweep. And the reload almost certainly signed the session out — `localStorage`
holds it and a reload of localhost:3001 clears it.

---

## The design in one sentence

Teach multiplication as **equal groups**, made visible as **arrays** and **equal hops**,
then turn that meaning into **facts derived from helper facts**, and finally into
**place-value strategies** — the area model, partial products, and the written
algorithm — with stories and estimation deciding when each is worth using.

Multiplication is not Addition with a different sign. In particular:

- **repeated addition is a route, not the meaning.** A child who only knows
  `4 × 6 = 6+6+6+6` has nothing left when the factors become 4.5 or ⅔. Equal groups is
  the meaning; repeated addition, skip counting, and arrays are three ways to count them.
- **the two factors do different jobs.** In `4 × 6` one number is *how many groups* and
  the other is *how many in each group*. The product does not care which is which; the
  story always does.
- **commutativity is a discovery, not a convention.** It halves the fact table, and it
  is worth a lesson of its own precisely because rotating the array is surprising.
- **fluency comes from strategy, not from speed.** Every table above the foundational
  set (×2, ×5, ×10) is reachable from one of five derived-fact moves. Timed drill before
  strategy is the single most common failure in this topic.
- **"add a zero" is not multiplying by ten.** It is a rule that breaks the first time a
  decimal appears. The digits move one place; the zero is the consequence.
- **the algorithm is the last step, not the topic.** By the time a child writes
  `46 × 23` in columns they should already know it is four rectangles.

---

## 0. Benchmark — what other platforms do, and what Koda takes from each

The user requirement was that this be *complete* and *benchmarked*. Six sources were
read. Each row says what was taken and, where Koda deviates, why.

| Source | What it establishes | Taken into this plan |
|---|---|---|
| [Khan Academy, *Intro to multiplication* (Grade 3)](https://www.khanacademy.org/math/cc-third-grade-math/intro-to-multiplication) | Opens on **multiplication as equal groups**, then relates it to **skip counting and repeated addition**, then **arrays** — in that order, before any fact recall. Anchored on CCSS 3.OA.A.1. | Levels 1–16 are exactly this order: groups → repeated addition → equation → number line → arrays. No fact recall before level 17. |
| [IXL, Grade 3 multiplication skills](https://www.ixl.com/math/grade-3/skills) | The most **granular public inventory**: separate skills for *identify* vs *write* an expression for equal groups, arrays with **two** equations, number-line multiplication, multiply by 0 or 1, distributive property with a missing factor, and five distinct word-problem shapes including *compare using multiplication*. | Drove the completeness audit. Levels 2, 4, 5, 11, 12, 15, 33 and the six story levels exist because IXL separates them and a merged lesson would leave a real skill untaught. |
| [Maine DOE, *Multiplication Strategies Progression*](https://www.maine.gov/doe/pl/math/multiplication) | An eight-step written progression: **models → repeated addition → arrays → helper facts and doubling → area model → partial products → lattice → standard algorithm.** | Adopted whole as the spine of levels 41–47. **Lattice is deliberately excluded** — see §13, decision 5. |
| [UK National Curriculum / NCETM, KS1–LKS2](https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study) | Tables are taught in a specific order — **Y2: 2, 5, 10 · Y3: 3, 4, 8 · Y4: 6, 7, 9, 11, 12** — and the 2/4/8 chain is explicitly taught **by doubling**. | The derived-fact ladder at levels 24–31 covers the tables in this order, and does it by strategy rather than by table, so ×4 and ×8 arrive as one doubling chain. `tableCeiling` (§11) exists because this curriculum goes to 12 and the US one stops at 10. |
| Bay-Williams & Kling, *Math Fact Fluency* ([sample chapters](http://files.ascd.org/pdfs/publications/books/Math-Facts-Fluency-Sample-Chapters.pdf); [Kling & Bay-Williams, *Three Steps to Mastering Multiplication Facts*](https://www.academia.edu/18767576/Kling_Gina_and_Bay_Williams_Jennifer_M_Three_Steps_to_Mastering_Multiplication_Facts)) | The **foundational vs derived** split: ×2, ×5, ×10 (and ×0, ×1) are learned first, then every other fact is *derived* by **adding a group, subtracting a group, doubling, near-squares, or breaking apart**. Strategy selection is the objective; **speed is a consequence, never the target**. | This is the exact structure of levels 17–19 (foundational) and 24–32 (derived). It is also why no engine in this skill has a timer, and why §12 trap 8 exists. |
| [learningtrajectories.org, *Multiplying / Dividing*](https://www.learningtrajectories.org/math/learning-trajectories/multiplying-dividing) | Developmental levels: *Beginning Grouper → Grouper → Concrete Modeler ×/÷ → Parts and Wholes ×/÷ → Skip Counter ×/÷ → Deriver ×/÷ → Problem Solver ×/÷*. | Supplies the `trajectoryLevel` vocabulary in §2 — the same role counting's and addition's trajectory strings play, drawn from the published trajectory rather than invented. |
| [Polypad](https://polypad.amplify.com/) and [Didax virtual manipulatives](https://www.didax.com/apps/) | What a *good* digital manipulative for this topic looks like: an array whose rows and columns can be **dragged to resize**, a rectangle that can be **split and labelled**, and number tiles that group. | Engine B (`ArrayGrid`) resizes rather than being redrawn per question, and Engine F (`AreaModel`) is a splittable labelled rectangle rather than a picture. Both are apparatus, not illustration. |

**Where Koda goes further than all six.** None of these platforms ties a fact strategy
to a mastery record that later practice updates, and none refuses a half-built model
instead of marking it wrong. Koda's `conceptKey` + `requires` chain (§2.1) means
"×6 by adding a group" is a tracked capability, not a worksheet; and §4's rule that an
unfinished array or an unsplit rectangle is *refused, not submitted* is the behaviour
that makes the apparatus teach rather than test.

---

## 1. Pre-flight

### 1.1 Establish the current baseline

```bash
npm run lint
npm test
npm run build
```

Every phase must leave all three green. Do not inherit a known-red baseline from an
older plan.

### 1.2 Files outside the skill folder

The build should touch only:

- `src/skills/registry.ts` — one import, one array entry.
- `src/curriculum/course.json` — appended units only, never a renumber.
- `src/assets/svg/thumbnail/multiplication-quest.svg` — one thumbnail.

`server/app/skill_defaults.json` is **generated by `npm run build`**. Never hand-edit it.

### 1.3 Two level numbers still exist

`params.level` is this skill's local, contiguous 1…68 ordering. The course's
`levelNumber` is the global position. Learner-facing lesson numbers and XP levels are a
third thing. Let the kit display them; never compute one from another.

### 1.4 Visibility while building

The skill ships `status: "draft"` until the final phase. A draft is visible to
developers only, and the Skill Manager's off switch still applies to it — that
invariant has its own test in subtraction and needs the equivalent here
(`multiplication.course.test.ts`).

### 1.5 No yellow

`src/data/skillTreeRoadmap.ts` already contains a `stage_multiplication` entry themed
`#eab308` — yellow. That roadmap card is unrelated art and is **not** the palette for
this skill. Per the project rule, multiplication's palette uses violet, sky, emerald and
rose (§6). Do not carry the roadmap's yellow into `multiplicationPalette.ts`.

---

## 2. Architecture — 12 interactions, not 56 components

An engine owns one thing the child's finger does. A lesson configures its mode and
number range in JSON. No engine branches on `params.level`.

| # | Engine | Activity id | Primary interaction | Teaching levels |
|---|---|---|---|---|
| A | `GroupTray` | `groups` | Make, check and count equal groups; connect them to an equation | 1–7 |
| B | `ArrayGrid` | `array` | Resize a row×column array, rotate it, and split it | 8–12, 33 |
| C | `SkipTrack` | `numberline` | Place equal hops along a line and read where they land | 13–16 |
| D | `FactDeck` | `facts` | Recall a fact, or derive it from a named helper fact | 17–19, 24–32 |
| E | `TableGrid` | `table` | Read, fill and hunt patterns in the multiplication chart | 20–23 |
| F | `AreaModel` | `area` | Split a labelled rectangle by place value and total its parts | 41–44 |
| G | `ColumnPad` | `column` | Enter product digits and carries in the written algorithm | 45–47 |
| H | `PlaceValueDesk` | `chart` | Scale digits by ten and hundred; multiply multiples of ten | 38–40 |
| I | `EstimateDial` | `estimate` | Round, estimate, and judge whether a product is reasonable | 48–49 |
| J | `StoryBoard` | `story` | Build an equal-groups or comparison bar model and solve its unknown | 50–55 |
| K | `StrategyPicker` | `strategy` | Choose and compare valid solution paths | 56 |
| L | `FactorBoard` | `factors` | Regroup three factors, find factor pairs, sort prime from composite | 34–37 |

Each engine also receives one mixed, unscaffolded practice lesson at levels 57–68.

### 2.1 Why multiplication owns these engines

`ColumnPad`, `PlaceValueDesk`, `EstimateDial`, `StoryBoard` and `StrategyPicker` share
names with addition's and subtraction's engines and share **nothing else**. Addition's
column carries a one into the next column; multiplication's carries a partial product
and then adds a whole shifted row. Addition's `StoryBoard` models a join; this one
models *times as many*, which is a different bar picture. Sharing the render-only
primitives (`CanvasBin`, base-ten block, frame grid) is right; sharing an activity would
couple telemetry, hints, validation, feature settings and refusal handling across three
different operations.

`FactDeck` is a genuinely new engine here despite the shared name: it holds a **helper
fact card**, which neither addition's nor subtraction's deck has.

---

## 3. Master teaching table

Every rule is enforced by `multiplicationNumbers.ts` (§5). Unless a row explicitly
teaches zero or one, generators exclude `×0` and `×1` and exclude duplicate questions
within a round. In `lessons.json` standards use full ids such as `CCSS.3.OA.A.1`.

| L | Technique | Lesson id | Engine · mode | conceptKey | Numbers / answer | Standards | Age |
|---|---|---|---|---|---|---|---|
| 1 | Make equal groups | `equal-groups` | groups · `make_groups` | `equal-grouper` | 2–6 groups of 2–6; child builds the groups, answers total | 2.OA.C.4, 3.OA.A.1 | 6–8 |
| 2 | Decide whether groups are equal | `equal-or-not` | groups · `equal_or_not` | `equal-group-checker` | 3–5 groups, one unequal in half the draws; answer yes/no and fix it | 2.OA.C.4 | 6–8 |
| 3 | Add the same number again and again | `repeated-addition` | groups · `repeated_addition` | `repeated-adder` | 2–6 groups of 2–9, product ≤ 40; build the addition string, answer total | 2.OA.C.4, 3.OA.A.1 | 6–8 |
| 4 | Write the multiplication sentence | `groups-to-equation` | groups · `groups_to_equation` | `multiplication-equation-reader` | groups shown; choose or build `a × b = c` | 3.OA.A.1 | 7–9 |
| 5 | Say what each factor counts | `which-factor-is-which` | groups · `factor_roles` | `factor-role-reader` | given a picture and `a × b`, label which factor is *groups* and which is *in each* | 3.OA.A.1 | 7–9 |
| 6 | Multiply by one | `multiply-by-one` | groups · `times_one` | `multiplicative-identity` | `n × 1` and `1 × n`, n 1–12, both orders shown | 3.OA.B.5 | 7–9 |
| 7 | Multiply by zero | `multiply-by-zero` | groups · `times_zero` | `zero-property` | `n × 0` and `0 × n`; empty groups drawn, not stated | 3.OA.B.5 | 7–9 |
| 8 | Build an array | `build-an-array` | array · `build_array` | `array-builder` | rows 2–10, cols 2–10; drag to size, answer total | 2.OA.C.4, 3.OA.A.1 | 6–8 |
| 9 | Read rows and columns | `rows-and-columns` | array · `read_array` | `array-reader` | array shown, answer the product; rows and columns separately labelled | 3.OA.A.1 | 7–9 |
| 10 | Turn the array around | `turn-the-array` | array · `commute` | `multiplicative-commutativity` | a×b with a≠b, both ≤10; rotate, then answer whether the total changed and why | 3.OA.B.5 | 7–9 |
| 11 | Two equations from one array | `two-equations-one-array` | array · `array_to_equation` | `array-equation-writer` | a≠b; both `a×b` and `b×a` required, checked together | 3.OA.A.1, 3.OA.B.5 | 7–9 |
| 12 | Find the missing side | `missing-side` | array · `missing_dimension` | `missing-dimension` | total and one side given, other side 2–10 | 3.OA.A.4 | 7–9 |
| 13 | Skip count in equal hops | `skip-count-hops` | numberline · `skip_count` | `skip-counter` | step 2, 3, 4, 5 or 10; 3–10 hops; ≤ 100 | 2.NBT.A.2, 3.OA.A.1 | 6–8 |
| 14 | Multiply on a number line | `multiply-on-a-line` | numberline · `hops_to_product` | `multiplication-number-line` | step 2–9, hops 2–9; place every hop, answer the landing | 3.OA.A.3 | 7–9 |
| 15 | Count the hops | `count-the-hops` | numberline · `missing_hop` | `hop-counter` | landing and step given, hop count 2–10 unknown | 3.OA.A.4 | 7–9 |
| 16 | Spot the multiples | `spot-the-multiples` | numberline · `count_multiples` | `multiple-recogniser` | is n a multiple of k? k 2–10, n ≤ 120; non-multiples within 2 of one | 4.OA.B.4 | 8–10 |
| 17 | Times two — double it | `times-two` | facts · `doubles` | `doubles-knower` | `2 × n`, n 1–12, both orders | 3.OA.C.7 | 7–9 |
| 18 | Times ten | `times-ten` | facts · `tens` | `tens-multiplier` | `10 × n`, n 1–12; the ten-frame or hop model shown, never "add a zero" | 3.OA.C.7, 3.NBT.A.3 | 7–9 |
| 19 | Times five — half of ten | `times-five` | facts · `fives` | `fives-multiplier` | `5 × n`, n 1–12; helper card shows `10 × n`, halved | 3.OA.C.7 | 7–9 |
| 20 | Find a product on the chart | `read-the-table` | table · `find_cell` | `table-reader` | factors ≤ tableCeiling; row and column traced, cell answered | 3.OA.C.7 | 7–9 |
| 21 | Patterns in the table | `patterns-in-the-table` | table · `pattern_hunt` | `table-pattern-finder` | ×5 endings, ×2/×4/×6/×8 all even, ×9 digit sum, ×10 column | 3.OA.D.9 | 8–10 |
| 22 | Square numbers | `square-numbers` | table · `squares` | `square-knower` | the diagonal, `n × n`, n 2–12; array shown as a true square | 3.OA.C.7 | 8–10 |
| 23 | Every fact appears twice | `commutative-pairs` | table · `commutative_pairs` | `multiplicative-commutativity` | pair each shaded cell with its partner; a≠b | 3.OA.B.5 | 7–9 |
| 24 | Times four — double, then double again | `times-four` | facts · `double_double` | `double-doubler` | `4 × n`, n 2–12; helper card shows `2 × n` | 3.OA.B.5, 3.OA.C.7 | 7–9 |
| 25 | Times eight — double the fours | `times-eight` | facts · `triple_double` | `triple-doubler` | `8 × n`, n 2–12; helper chain `2 × n → 4 × n` shown | 3.OA.B.5, 3.OA.C.7 | 8–10 |
| 26 | Times three — double it, add one more group | `times-three` | facts · `add_a_group` | `group-adder` | `3 × n`, n 2–12; helper `2 × n`, add one `n` | 3.OA.B.5, 3.OA.C.7 | 7–9 |
| 27 | Times six — five groups, then one more | `times-six` | facts · `add_a_group` | `group-adder` | `6 × n`, n 2–12; helper `5 × n`, add one `n` | 3.OA.B.5, 3.OA.C.7 | 8–10 |
| 28 | Times nine — ten groups, take one away | `times-nine` | facts · `subtract_a_group` | `group-subtractor` | `9 × n`, n 2–12; helper `10 × n`, subtract one `n` | 3.OA.B.5, 3.OA.C.7 | 8–10 |
| 29 | Times seven — break it into five and two | `times-seven` | facts · `break_apart` | `fact-breaker` | `7 × n`, n 2–12; split shown as `5 × n` and `2 × n` | 3.OA.B.5, 3.OA.C.7 | 8–10 |
| 30 | Elevens and twelves — ten, and a bit more | `times-eleven-twelve` | facts · `break_apart` | `fact-breaker` | `11 × n` as `10n + n`; `12 × n` as `10n + 2n`; n 2–12 | 3.OA.B.5, 3.OA.C.7 | 8–10 |
| 31 | Near squares | `near-squares` | facts · `near_square` | `near-square-deriver` | `n × (n+1)`, n 3–11; helper `n × n`, add one `n` | 3.OA.B.5, 3.OA.C.7 | 8–10 |
| 32 | Use any known fact | `use-a-known-fact` | facts · `known_fact` | `known-fact-user` | target within 12×12; choose a helper from four offered, then answer | 3.OA.B.5, 3.OA.C.7 | 8–10 |
| 33 | Split the array | `split-the-array` | array · `split_array` | `distributor` | a×b, a 6–10; cut the array once, name both parts, add them | 3.OA.B.5 | 8–10 |
| 34 | Multiply three numbers | `multiply-three-numbers` | factors · `associative` | `associativity` | `a × b × c`, product ≤ 120; two groupings compared | 3.OA.B.5 | 8–10 |
| 35 | Halve one, double the other | `halve-and-double` | factors · `halve_double` | `halver-doubler` | one factor even, other ends in 5 or is awkward; e.g. `16 × 5 → 8 × 10` | 3.OA.B.5, 4.NBT.B.5 | 8–10 |
| 36 | Find the factor pairs | `factor-pairs` | factors · `factor_pairs` | `factor-finder` | n 12–100; every pair required, checked together | 4.OA.B.4 | 8–10 |
| 37 | Prime or composite | `prime-or-composite` | factors · `prime_composite` | `prime-identifier` | n 2–100; decided by trying factor pairs, not by recall | 4.OA.B.4 | 8–10 |
| 38 | Times ten and times a hundred | `times-ten-and-hundred` | chart · `times_ten_hundred` | `tens-scaler` | n 2–99; digits shown moving one or two places | 3.NBT.A.3, 4.NBT.B.5 | 8–10 |
| 39 | Multiply a multiple of ten | `multiples-of-ten` | chart · `multiples_of_ten` | `tens-multiple-multiplier` | `n × k0`, n 2–9, k 2–9; read as `n × k` tens | 3.NBT.A.3 | 8–10 |
| 40 | Tens times tens | `tens-times-tens` | chart · `tens_times_tens` | `place-value-scaler` | `a0 × b0`, a,b 2–9; the two zeros come from the places, not a rule | 4.NBT.B.5 | 9–10 |
| 41 | Multiplication is area | `area-of-a-rectangle` | area · `rect_area` | `area-finder` | sides 2–12, unit squares visible then hidden | 3.MD.C.7.A, 3.MD.C.7.B | 8–10 |
| 42 | Split a rectangle by place value | `area-model-2x1` | area · `area_2x1` | `area-modeler` | 1-digit × 2-digit, no split value zero; both parts labelled | 4.NBT.B.5, 3.MD.C.7.C | 8–10 |
| 43 | Record the partial products | `partial-products` | area · `partial_products` | `partial-products` | same numbers as 42, now written as a column of parts and totalled | 4.NBT.B.5 | 9–10 |
| 44 | Four parts — two digits by two digits | `area-model-2x2` | area · `area_2x2` | `two-digit-area-modeler` | 2-digit × 2-digit, all four partial products nonzero | 4.NBT.B.5, 5.NBT.B.5 | 9–10 |
| 45 | The written method, no carrying | `column-no-regroup` | column · `no_regroup` | `column-multiplier` | 2-digit × 1-digit, every digit product ≤ 9 | 4.NBT.B.5 | 9–10 |
| 46 | The written method, with carrying | `column-with-regroup` | column · `regroup` | `multiplication-regrouper` | 2–3-digit × 1-digit, at least one carry; the carry is recorded | 4.NBT.B.5 | 9–10 |
| 47 | Two digits by two digits | `two-digit-column` | column · `two_digit` | `two-digit-column-multiplier` | 2-digit × 2-digit; second row is `×` the tens, not "a zero" | 5.NBT.B.5 | 9–10 |
| 48 | Estimate by rounding | `estimate-by-rounding` | estimate · `round_estimate` | `rounding-estimator` | 2–3 digits × 1–2 digits; neither factor already round | 3.OA.D.8, 4.NBT.B.5 | 9–10 |
| 49 | Is the answer reasonable? | `is-it-reasonable` | estimate · `reasonable` | `reasonableness-checker` | true product plus a claim; wrong claims are place-value slips, not ±1 | 3.OA.D.8 | 9–10 |
| 50 | Equal groups, total unknown | `equal-groups-story` | story · `equal_groups_total` | `equal-groups-modeler` | groups 2–12, each 2–12 | 3.OA.A.3 | 7–9 |
| 51 | Equal groups, how many groups unknown | `how-many-groups-story` | story · `groups_unknown` | `group-count-modeler` | total and group size known; exact division only | 3.OA.A.4 | 8–10 |
| 52 | Equal groups, group size unknown | `group-size-story` | story · `size_unknown` | `group-size-modeler` | total and group count known; exact division only | 3.OA.A.4 | 8–10 |
| 53 | Times as many | `times-as-many` | story · `times_as_many` | `comparison-multiplier` | comparison bars; a matched "more than" distractor in every draw | 4.OA.A.1, 4.OA.A.2 | 8–10 |
| 54 | Rate problems | `rate-problems` | story · `rate` | `rate-reasoner` | per-unit rate 2–12, count 2–12; the rate is stated once, used twice | 3.OA.A.3, 4.OA.A.2 | 8–10 |
| 55 | Two-step problems | `multi-step-problems` | story · `multi_step` | `multiplicative-multi-step-solver` | one multiplication plus one add/subtract; every stage nonnegative | 3.OA.D.8, 4.OA.A.3 | 9–10 |
| 56 | Explain and compare strategies | `explain-and-compare` | strategy · `compare_paths` | `multiplication-strategy-chooser` | tagged pool; accept every genuinely fitting strategy | 3.OA.B.5, 4.NBT.B.5 | 9–10 |

`trajectoryLevel` values, from the published multiplying/dividing trajectory:
`beginning-grouper` (1–2), `grouper` (3–7), `concrete-modeler` (8–12, 41), `skip-counter`
(13–16), `parts-and-wholes` (20–23, 33–37), `deriver` (17–19, 24–32), `place-value`
(38–40, 42–44), `written-methods` (45–47), `estimation` (48–49), `problem-solver`
(50–55), `strategies` (56), `practice` (57–68).

### 3.1 Concept-key reuse

Reuse a key only when practice should update the same mastery record.

| Existing key | Reused at | Why it is the same concept |
|---|---|---|
| `skip-counter` (counting) | 13 | equal steps along the number sequence, unchanged |
| `doubles-knower` (addition, subtraction) | 17 | `2 × n` **is** the double; one record, not two |
| `known-fact-user` (addition, subtraction) | 32 | derive an unknown fact from a chosen known one |
| `place-value-builder` (counting, addition, subtraction) | 38 | digits keep their place-value meaning under scaling |
| `rounding-estimator` (addition, subtraction) | 48 | the same rounding competence |
| `reasonableness-checker` (addition, subtraction) | 49 | the same magnitude judgement |

Deliberate **non**-reuse, each of which would corrupt a record if taken:

| Tempting key | Why not | New key |
|---|---|---|
| `commutativity` (addition) | `a+b=b+a` and `a×b=b×a` look alike and are learned years apart from different evidence — one from a number line, one from a rotated array | `multiplicative-commutativity` |
| `partial-sums` (addition) | decomposing addends and decomposing factors are different moves; `20+3` splits a total, `20×4` splits a rectangle | `partial-products` |
| `standard-algorithm` (addition) | multiplication's algorithm adds shifted rows; a child fluent in one is not fluent in the other | `column-multiplier`, `multiplication-regrouper`, `two-digit-column-multiplier` |
| `unitiser-ten` (counting) | composing a ten and scaling by ten are related, not identical | `tens-scaler` |
| `part-whole-decomposer` | the parts of an array are equal groups, not free parts | `distributor` |

### 3.2 Manifest prerequisites

```json
[
  "counter", "skip-counter", "pattern-continuer", "count-on",
  "doubles-knower", "part-whole-decomposer", "place-value-builder",
  "unitiser-ten", "unitiser-hundred", "partial-sums", "rounding-estimator"
]
```

`partial-sums` is there because level 43 asks the child to add four partial products, and
level 47 to add two shifted rows — addition work this skill assumes rather than teaches.
A lesson's own `requires` names only one or two genuine prerequisites, from that list or
from a lower multiplication level. Do not paste every addition key in to satisfy a test.

The derived-fact ladder is where `requires` does real work:

```text
17 times-two ──┬─► 24 times-four ──► 25 times-eight
               └─► 26 times-three
19 times-five ──► 27 times-six          22 square-numbers ──► 31 near-squares
18 times-ten  ──┬─► 28 times-nine
                └─► 30 times-eleven-twelve
19 + 17 ────────► 29 times-seven ───────► 32 use-a-known-fact
```

A child cannot meet "×8 by doubling the fours" before `double-doubler` is recorded. That
chain is the whole benchmark finding from Bay-Williams & Kling, expressed as data.

### 3.3 Practice lesson order

| L | Lesson id | Engine | Modes cycled |
|---|---|---|---|
| 57 | `practice-groups` | groups | all seven |
| 58 | `practice-array` | array | build, read, commute, equations, missing side, split |
| 59 | `practice-numberline` | numberline | all four |
| 60 | `practice-facts` | facts | all ten, weighted to the derived five |
| 61 | `practice-table` | table | find cell, squares, commutative pairs |
| 62 | `practice-factors` | factors | all four |
| 63 | `practice-chart` | chart | all three |
| 64 | `practice-area` | area | rect area, 2×1, partial products, 2×2 |
| 65 | `practice-column` | column | all three |
| 66 | `practice-estimate` | estimate | both |
| 67 | `practice-story` | story | all six |
| 68 | `practice-strategy` | strategy | compare paths |

Each keeps a conceptKey already taught by that engine; none invents a `practice-*`
concept. Practice is `params.question.practice: true`, cycles modes with
`modeAt(setup, index, fallback)`, is silenced by `quietWhenPractising`, and offers no
hints, no intro speech and no read-aloud control.

---

## 4. Folder layout

```text
src/skills/multiplication/
  manifest.json
  lessons.json
  index.ts
  voice.json
  audio/manifest.json            {} until Phase 15
  activities/
    GroupTray.tsx      ArrayGrid.tsx     SkipTrack.tsx     FactDeck.tsx
    TableGrid.tsx      AreaModel.tsx     ColumnPad.tsx     PlaceValueDesk.tsx
    EstimateDial.tsx   StoryBoard.tsx    StrategyPicker.tsx FactorBoard.tsx
  internal/
    data/
      multiplicationNumbers.ts   the arithmetic contract (§5)
      multiplicationLayout.ts    every apparatus size, one place
      multiplicationPalette.ts   semantic colour roles (§6)
      multiplicationChrome.ts    step tags
      multiplicationAssets.ts    object art ids
      helperFacts.ts             the derived-fact ladder as data (§5.2)
      storyCast.ts               fixed names/objects for story templates
      strategyCards.ts           tagged strategies for level 56
    ui/
      NumberPad.tsx  useNudge.ts
  assets/                        FLAT. The glob does not match subdirectories.
    apple.svg  egg.svg  pencil.svg  sticker.svg  coin.svg  leaf.svg
  multiplication.test.ts             contract + smoke
  multiplication.activities.test.tsx one driver per engine, every mode
  multiplication.numbers.test.ts     independent answers, boundaries, impossible specs
  multiplication.hints.test.ts       live-state hints per engine
  multiplication.practice.test.tsx   silence and mode coverage across a round
  multiplication.features.test.tsx   every toggle changes observable behaviour
  multiplication.course.test.ts      placed once, ordered, hidden when disabled
  multiplication.figures.test.tsx    worksheet prompts, answers, figures
  multiplication.art.test.ts         referenced assets exist
  multiplication.manifest.test.ts    teaches ⊇ every lesson conceptKey
  multiplication.voice.test.ts       declared phrases are the spoken ones
```

---

## 5. `multiplicationNumbers.ts` — the arithmetic contract

Pure generators, declared constraints, bounded random search with a deterministic
fallback, and a thrown error for an impossible authoring spec. `withoutRepeat` with a
round-local `seen` set; on exhaustion, allow a repeat rather than hang.

### 5.1 Specs

| Spec | Fields | Guarantees |
|---|---|---|
| `ProductSpec` | `aRange`, `bRange`, `productMax`, `allowZero`, `allowOne`, `distinctFactors` | never returns a factor outside its range; excludes 0 and 1 unless the mode teaches them; `distinctFactors` for commutativity and array-equation modes, where `a=b` makes the task vacuous |
| `HelperSpec` | `target`, `helper`, `adjust` | `helper × adjust` reconstructs `target` exactly; helper is a foundational fact or an already-taught derived one — never an untaught one |
| `ArraySpec` | `rowRange`, `colRange`, `maxCells` | `maxCells` caps at what fits 360px (12×12); `missing_dimension` guarantees exact division |
| `MultipleSpec` | `step`, `max`, `nearMissDelta` | non-multiples land within `nearMissDelta` of a real multiple, so the task is not solvable by magnitude |
| `SplitSpec` | `factor`, `splitAt` | both parts ≥ 1; `splitAt` is a place-value boundary for area modes and a foundational fact for `split_array` |
| `PartialProductSpec` | `digitsA`, `digitsB`, `allPartsNonzero` | for `area_2x2`, all four parts nonzero — a zero part hides the structure the lesson exists to show |
| `ColumnSpec` | `digitsA`, `digitsB`, `carries` | `carries: 0` guarantees every digit product ≤ 9; `carries: ">=1"` guarantees at least one |
| `FactorSpec` | `range`, `kind: "prime" \| "composite" \| "either"`, `minPairs` | pairs enumerated independently of the generator's own claim |
| `EstimateSpec` | `digits`, `neitherRound` | rejects a factor already at its rounding target, which would make estimating identical to computing |
| `StorySpec` | `shape`, `unknown`, `exactDivision` | for `groups_unknown` / `size_unknown` the division is exact; multi-step stays nonnegative at every stage |

### 5.2 `helperFacts.ts`

The derived-fact ladder is **data, not branches**. One table maps a target fact to its
strategy, its helper fact, and the adjustment:

```ts
{ target: [8, 7], strategy: "triple_double", helpers: [[2, 7], [4, 7]], adjust: "double" }
{ target: [9, 6], strategy: "subtract_a_group", helpers: [[10, 6]], adjust: "minus one 6" }
{ target: [7, 8], strategy: "break_apart",     helpers: [[5, 8], [2, 8]], adjust: "add" }
```

`FactDeck` reads it; no mode hardcodes a table. This is what lets levels 24–32 ship as
JSON in one phase (§10, Phase 6) rather than as nine components.

### 5.3 Rules the generator must obey

1. Never emit a factor of 0 or 1 outside levels 6, 7 and their practice cycle.
2. Never emit `a = b` where the task is about the two factors differing (10, 11, 23).
3. A helper fact must already be taught at or below the current level.
4. Every array fits `maxCells`; a spec that cannot is a thrown authoring error.
5. Distractors are built from the *helper* fact's product, a factor swap, and a
   place-value slip — never from `product ± 1`, which is guessable (§12 trap 13).
6. Presentation — scale, tint, rotation — applies to the whole answer set or to none.

---

## 6. Engine behaviour

House rules from addition apply unchanged: tap source then destination, real labelled
buttons, a refused intermediate move explains itself without submitting an answer or
recording a hint, `themeSystem.field()` for inputs, `bg-surface` / `text-ink` /
`border-line` for surfaces, and every apparatus size centralised in
`multiplicationLayout.ts`.

Palette roles in `multiplicationPalette.ts` — **violet** for a group or a factor,
**sky** for the second factor and the array's columns, **emerald** for the product or
total, **rose** for the adjustment in a derived fact (the group added or taken away).
No amber, no yellow (§1.5).

### A. `GroupTray` — `groups`
Seven modes. A tray of bins; the child taps an object then a bin to place it.
`make_groups` refuses an unequal tray with "each group needs the same number" rather
than marking it wrong. `times_zero` draws `n` visibly **empty** bins — the property is
seen, not asserted. `factor_roles` shows one picture and asks which factor names the
bins and which names the contents; both must be right, checked together, once.

### B. `ArrayGrid` — `array`
Six modes. Rows and columns resize by dragging a handle or by the ± buttons beside each
labelled edge (the buttons are the keyboard path). `commute` rotates the *same* array
and keeps both edge labels attached through the rotation, so the child sees 4 baskets of
6 becoming 6 rows of 4 and can answer why the total held. `split_array` drops one cut
line; both parts are labelled with their own product and the child totals them.

### C. `SkipTrack` — `numberline`
Four modes. Equal hops are placed one at a time; `counting_badges` numbers each landing.
The final landing is the product, and the engine says so — a skip count that never names
its product teaches counting, not multiplying (§12 trap 7). `missing_hop` shows the
landing and one hop's length and asks how many hops.

### D. `FactDeck` — `facts`
Ten modes. Every derived mode shows a **helper card** — the known fact, its product, and
the adjustment — driven entirely by `helperFacts.ts`. `known_fact` offers four candidate
helpers, of which one is genuinely useful, and asks the child to pick before answering;
the other three are true facts that are neither helpers nor equal to the target product.

### E. `TableGrid` — `table`
Four modes on one 12×12 chart (10×10 when `tableCeiling` is 10). `find_cell` traces the
row and column as the child moves. `pattern_hunt` asks for every cell fitting a stated
rule and checks the whole selection once. `commutative_pairs` shades one cell and asks
for its partner. The chart scrolls inside its own container at 360px; the page does not.

### F. `AreaModel` — `area`
Four modes. A labelled rectangle the child cuts at a place-value boundary; each part
shows its own product; the parts are totalled. `rect_area` starts with visible unit
squares and hides them once the child answers from the side labels. The rectangle is
**not drawn to true scale** — 23 × 46 cannot be at 360px — but the partition proportions
are honest within each side, and every part is labelled (§12 trap 10).

### G. `ColumnPad` — `column`
Three modes, right to left, one digit at a time, carries recorded in their own boxes.
`two_digit` requires the second row to be entered as `× the tens`; the engine refuses a
bare "put a zero" and says why (§12 trap 12).

### H. `PlaceValueDesk` — `chart`
Three modes. Digits move between H/T/O columns; the zero appears because a column
emptied, never because a rule said to type one.

### I. `EstimateDial` — `estimate`
Two modes. Round each factor with a dial, multiply the rounded pair, then compare with
the true product. `reasonable` claims are wrong by a *place value*, not by one.

### J. `StoryBoard` — `story`
Six modes over a fixed cast in `storyCast.ts`. Equal-groups shapes build a bar of equal
segments; `times_as_many` builds two bars, one a whole number of copies of the other.
Every comparison draw includes an additive distractor ("4 **more** than") alongside the
multiplicative one, because that confusion is the point of the lesson (§12 trap 15).

### K. `StrategyPicker` — `strategy`
One mode, six questions: choose a route, then compare it with another. Accepts every
genuinely fitting strategy from the tagged pool — there is no single right answer, and
scoring one would teach the opposite of the lesson.

### L. `FactorBoard` — `factors`
Four modes. `associative` shows three factor tiles and two ways to bracket them.
`factor_pairs` requires **every** pair, checked together once. `prime_composite` is
decided by attempting pairs on the board, so a child who has never met the word can
still succeed.

---

## 7. Hints, feedback, and error kinds

Three rungs from live state via `composeHints`: the lesson's `kidTip`, then a contextual
nudge naming the current numbers, then worked guidance. `SkillRound` owns hint state and
reporting. For answer-choice tasks the third rung stops short of the choice; for
action tasks it explains the action fully. A refused move gets its own explanation and
is never filed as a hint or an answer.

Multiplication-specific nudges worth writing:

| Situation | Nudge |
|---|---|
| unequal groups built | "Each group needs the same number. Group 2 has one more." |
| skip count landed short | "You have made 3 hops of 5. You need 4." |
| derived fact answered with the helper's product | "That is 5 × 8. You need two more eights." |
| factors swapped in a story | "24 is right for the total, but this story has 4 boxes of 6, not 6 boxes of 4." |
| partial product in the wrong column | "20 × 40 is 8 hundreds, not 8 tens." |
| additive answer to a comparison | "Four **times** as many, not four more." |

---

## 8. Voice and art

Declare in `voice.json` only what is actually spoken. Numbers, praise and correction come
from the common pack — do not re-record them. Skill-owned lines are the multiplication
templates and phrases:

```text
templates: "{a} groups of {b}.", "{a} times {b}.", "How many altogether?",
           "Double {a} is {b}.", "{a} rows of {b}."
phrases:   "Make the groups equal.", "Now split the rectangle."
```

Lesson `audioPrompt` values are collected from `lessons.json` automatically — one line,
one home. Gate the skill's own `speech.say` on `audio_speech`; the kit covers only the
intro, hint and reaction lines. Dry-run with
`npm run voice:plan -- --skill multiplication` and require **0 missing** before publish.

Art: six flat SVGs in `assets/` for group objects, registered through the flat
`./assets/*.svg` glob — a nested folder is silently absent, not an error. Plus
`src/assets/svg/thumbnail/multiplication-quest.svg`, published to the shared Art
collection in the ship phase.

---

## 9. Worksheets

Register `worksheet` on every activity; return `null` for the modes that cannot print
honestly rather than substituting different arithmetic.

| Engine | Prints | Figure | Notes |
|---|---|---|---|
| groups | all seven | bins outline | `times_zero` prints empty bins |
| array | all but `commute` | dot grid | `commute` prints as "write both equations" |
| numberline | all four | number line with tick marks, blank hops | |
| facts | all ten | — | the helper card prints as a stated first line under `method` |
| table | `find_cell`, `squares`, `commutative_pairs` | partial chart | `pattern_hunt` returns `null` |
| area | all four | labelled rectangle, blank parts | the figure is essential; without it the task changes |
| column | all three | ruled column frame | carries blank |
| chart | all three | H/T/O frame | |
| estimate | both | — | |
| story | all six | bar model frame | |
| factors | all four | factor-pair table | |
| strategy | `compare_paths` | — | prints as "solve two ways, then say which was easier" |

Preserve the unknown's position; leave learner work blank; verify through the worksheet
path including mixed modes.

---

## 10. Build phases

An engine is implemented **once, with every mode in the master table**. The JSON-only
phases are architecture checks: if one of them needs a new component or a level branch,
the earlier engine was under-parameterised and that is the bug to fix.

| Phase | Teaching levels | New engines | Other deliverables |
|---|---|---|---|
| 0 ✅ | — | — | fresh baseline; `multiplicationNumbers.ts` + `helperFacts.ts` + tests; layout; palette; six flat SVGs |
| 1 ✅ | 1–7 | A `GroupTray` | scaffold, manifest, registry entry, voice groups, structural tests, first course units |
| 2 ✅ | 8–12 | B `ArrayGrid` | all six modes now, including `split_array` used at level 33 |
| 3 ✅ | 13–16 | C `SkipTrack` | all four modes |
| 4 ✅ | 17–19 | D `FactDeck` | **all ten modes**, driven by `helperFacts.ts` |
| 5 ✅ | 20–23 | E `TableGrid` | all four modes; `tableCeiling` reader |
| 6 ✅ | 24–33 | none | **ten JSON lessons.** The plan's main architecture check: nine derived facts and the array split with no new code |
| 7 ✅ | 34–37 | L `FactorBoard` | all four modes |
| 8 ✅ | 38–40 | H `PlaceValueDesk` | all three modes |
| 9 ✅ | 41–44 | F `AreaModel` | all four modes |
| 10 ✅ | 45–47 | G `ColumnPad` | all three modes |
| 11 ✅ | 48–49 | I `EstimateDial` | both modes |
| 12 ✅ | 50–55 | J `StoryBoard` | six modes, fixed cast, additive distractors |
| 13 ✅ | 56 | K `StrategyPicker` | tagged strategy metadata |
| 14 ✅ | 57–68 | none | twelve practice lessons, one per engine; practice tests |
| 15 ✅ | — | — | inventory complete; **97 clips recorded via OpenAI**; `voice:plan` reports 0 missing |
| 16 ✅ | — | — | features/settings, worksheet, art, manifest and course audit |
| 17 ✅ | — | — | 360px pass on all twelve engines with the breakpoints switched off; dark pass measured; worded buttons reshaped; **published** |

Every phase gate:

```bash
npm run lint
npm test
npm run build
```

Tests do not exercise StrictMode double-mount, viewport overflow, or thumb reach. Open
each new engine in the running app at 360px in light and dark before closing its phase —
subtraction's twelve defects were found that way, not by a green suite.

---

## 11. Manifest proposal

```jsonc
{
  "id": "multiplication",
  "name": "Multiplication",
  "version": "1.0.0",
  "description": "Fifty-six ways to multiply, from making equal groups to choosing the strategy the numbers deserve.",
  "category": "core",
  "author": "Koda Math Lab",
  "iconName": "Grid3x3",
  "tagline": "Equal groups, arrays, and facts you can work out.",
  "thumbnail": "multiplication-quest",
  "status": "draft",
  "audience": { "ages": [6, 10], "category": "operations" }
}
```

### Features

| Feature id | Observable effect |
|---|---|
| `audio_speech` | spoken prompts, counted hops, helper-fact lines and hints |
| `sound_chimes` | place/group/hop/success/error chimes |
| `haptic_feedback` | tactile place, hop, rotate and split feedback |
| `counting_badges` | numbers groups as they are made and hops as they land |
| `running_product_badge` | live running total on tray, line and array engines |
| `strategy_scaffold` | the helper-fact card, array split lines and partial-product rows |
| `times_table_chart` | a reference chart button in teaching fact lessons; **always off in practice** |
| `step_context_tags` | warm-up/guided/milestone labels from shared round chrome |
| `premium_lessons` | gates lessons after the configured free count |

`times_table_chart` is the one new feature and it needs a real test: on in a teaching
lesson it renders a reachable chart; off, or in any `practice: true` lesson, it must not.

### Settings

Mirror addition's `warmupLabel`, `activityLabel`, `guidedLabel`, `milestoneLabel`,
`speechRate`, `answerInput`, `freeLessons`, plus:

| Key | Type | Why |
|---|---|---|
| `tableCeiling` | choice, `10` or `12`, default `12` | The benchmark's clearest split: the UK curriculum requires 12 × 12 by end of Y4, the US Common Core stops at 10 × 10. One setting serves both. Read by `ProductSpec` and by `TableGrid`'s chart size. |

Do not add a setting without naming its reader and covering it in
`multiplication.features.test.tsx`.

---

## 12. Multiplication-specific error register

1. **Repeated addition as the definition.** It is one route to the answer. The meaning is
   equal groups; say "4 groups of 6", not "6 added 4 times", in the concept copy.
2. **Silent factor-order drift.** Fix one convention — `a × b` is *a groups of b* — and
   hold it in every prompt, story, array label and worksheet in the skill.
3. **Commutativity that erases the story.** 4 baskets of 6 and 6 baskets of 4 both total
   24 and are different situations. The rotated array keeps both edge labels.
4. **An array whose rows and columns are indistinguishable.** Label both edges; never
   convey the difference by colour alone.
5. **"Times ten means add a zero."** Show the digit moving a place. The rule is false the
   first time a decimal appears and this is the age it gets installed.
6. **Zero and one as tricks.** `6 × 0` is six empty bins, drawn.
7. **A skip count that never names its product.** The last landing is the answer; badge
   the hops and say it.
8. **Speed treated as fluency.** No timers, no countdowns, no speed badges. The practice
   log already excludes answers under 700ms; that is the only place time belongs.
9. **Fact drill before strategy.** A derived-fact lesson must not unlock before its
   helper fact is recorded. The `requires` chain in §3.2 is the mechanism.
10. **An area model drawn to a misleading scale.** Label every part; never let a `20 × 3`
    part render the same size as a `3 × 3` part.
11. **A partial product in the wrong place-value column.** `20 × 40` is 800. The engine
    must place the part, not just accept the number.
12. **The placeholder zero taught as a keystroke.** The second row is `× 40`, not `× 4`
    with a zero typed after it.
13. **Distractors made by ±1 on the product.** They let near-square, add-a-group and
    subtract-a-group be answered by arithmetic on the choices. Build distractors from the
    helper's product, a factor swap, and a place-value slip.
14. **Keyword story solving.** "Each", "times" and "altogether" do not determine the
    operation; the unknown's position does.
15. **Multiplicative comparison read additively.** "4 times as many" is not "4 more".
    Ship the additive distractor deliberately.
16. **An apparatus that overflows 360px.** Cap array and chart dimensions and scroll
    inside the apparatus's own container, never the page.

The twelve general traps in `ADDITION_BUILD_PLAN.md` §12 still apply: `expected` on every
question, one submit per attempt, theme tokens, speech ownership, accessible names, no XP
in skill code, no cross-folder activity imports.

---

## 13. Course placement

The course currently ends at **u47** (bottle-sort practice). Append; never insert.
Fourteen four-lesson teaching units, then three practice units.

| Unit | Title | Levels |
|---|---|---|
| u48 ✅ | Equal Groups | 1–4 |
| u49 ✅ | Factors, One, and Zero | 5–8 |
| u50 ✅ | Rows and Columns | 9–12 |
| u51 ✅ | Hops, Lines, and Multiples | 13–16 |
| u52 ✅ | Twos, Tens, Fives, and the Chart | 17–20 |
| u53 ✅ | Patterns, Squares, and Pairs | 21–24 |
| u54 ✅ | Doubling and Adding a Group | 25–28 |
| u55 ✅ | Breaking Facts Apart | 29–32 |
| u56 ✅ | Splitting and Regrouping Factors | 33–36 |
| u57 ✅ | Primes, Tens, and Hundreds | 37–40 |
| u58 ✅ | Area and Partial Products | 41–44 |
| u59 ✅ | The Written Method | 45–48 |
| u60 ✅ | Reasonable Answers and Equal-Group Stories | 49–52 |
| u61 ✅ | Comparison, Rate, and Strategy | 53–56 |
| u62 ✅ | Practice — Groups, Arrays, Lines, Facts | 57–60 |
| u63 ✅ | Practice — Tables, Factors, Places, Area | 61–64 |
| u64 ✅ | Practice — Columns, Estimation, Stories, Strategy | 65–68 |

Recheck the tail of `course.json` before Phase 1; if another skill lands first, append
with the then-next ids rather than renumbering.

---

## 14. Tests

Per the §11 validation matrix in `SKILL_DEVELOPMENT.md`. The shared structural suite is
required and insufficient: `describeActivitySmoke` opens only the first matching lesson
per engine.

| Check | This skill's evidence |
|---|---|
| Structure | `describeSkillContract` + `describeActivitySmoke` |
| Interaction | one driver per engine, **all 54 modes**, wrong→right retry, refused moves (unequal group, unsplit rectangle, bare placeholder zero), replay cleanup |
| Content | independent products — computed in the test, never read back from the generator — plus `helperFacts` reconstruction (`helper × adjust === target` for every row), boundary cases, and thrown errors for impossible specs |
| Hints | live numbers in the nudge; choice tasks never reveal the choice |
| Practice | silence across a whole round, mode coverage, no chart, normal completion |
| Configuration | every feature toggle observable; `times_table_chart` off in practice; `tableCeiling` changes generated factors **and** chart size |
| Course | 68 lessons placed once, ordered, teaching and practice units separate, hidden when the skill is disabled |
| Print/art | self-contained printed text and answers per supported mode; area and array figures present; every referenced asset exists |

Drive by accessible name. A behaviour driver may read telemetry to choose the correct UI
answer, but the known-answer check must be independent — trusting telemetry alone lets a
wrong answer key pass every test in the suite.

---

## 15. Decisions to settle before Phase 0

| # | Decision | Recommendation |
|---|---|---|
| 1 | Does this release include division? | **No.** Levels 12, 15, 51 and 52 cover *missing factor*, which is the multiplicative structure; sharing, fair shares, remainders and long division are a separate `division` skill that will require this one. |
| 2 | Ship 56 teaching + 12 practice now? | **Yes.** Practice is an established product contract. Cutting the derived-fact ladder to hit a smaller number would remove the benchmark's central finding. |
| 3 | One lesson per times table, or per strategy? | **Per strategy.** Levels 24–31 reach every table from 2 to 12 through five moves. A table-by-table release is eleven near-identical drill lessons and no transferable idea; `TableGrid` and `practice-facts` still give per-table repetition. |
| 4 | `a × b` convention | **`a` groups of `b`.** Written into every prompt, label and worksheet. Trap 2 exists because this drifts silently. |
| 5 | Include lattice multiplication? | **No.** It appears in the Maine progression but not in CCSS, and it is a notation dead end that does not connect to place value. Partial products via the area model does the same work and survives into algebra. |
| 6 | `tableCeiling` default | **12**, with 10 available. Matches the stricter of the two benchmark curricula; a family on the US standards loses nothing by turning it down. |
| 7 | Questions per round | Five for teaching; four for `area_2x2`, `two_digit` column and `multi_step` story if 360px testing shows fatigue. Practice rounds are 9–12 and cycle modes. |
| 8 | Publication state | Draft until Phase 17. Publishing is the last change, after the mobile, theme and offline pass. |

### Definition of done

- All 68 lessons open from Learn and from Skill Manager preview, in order and exactly once.
- Every engine has a behaviour driver covering all its modes, a worksheet adapter (or a
  documented `null`), live-state hints, and a practice lesson.
- `helperFacts.ts` is proved consistent: every row's helper reconstructs its target, and
  no helper is untaught at its level.
- Every feature toggle changes observable behaviour; `tableCeiling` has a reader and a test.
- Perfect and corrected rounds score through the shared kit; no activity awards XP.
- Light and dark at 360px on every engine, with no page-level horizontal scroll.
- `npm run voice:plan -- --skill multiplication` reports 0 missing.
- A full round completes offline, in the running app, after a reload.
- Disabling the skill removes all 68 lessons. Publish only after that pass.

---

## 16. Sources

- [Khan Academy — Intro to multiplication, Grade 3](https://www.khanacademy.org/math/cc-third-grade-math/intro-to-multiplication)
- [IXL — 3rd grade math skills](https://www.ixl.com/math/grade-3/skills) and [Learn multiplication](https://www.ixl.com/math/multiplication)
- [Maine Department of Education — Multiplication Strategies Progression](https://www.maine.gov/doe/pl/math/multiplication)
- [National curriculum in England: mathematics programmes of study](https://www.gov.uk/government/publications/national-curriculum-in-england-mathematics-programmes-of-study/national-curriculum-in-england-mathematics-programmes-of-study) · [NCETM National Curriculum Resource Tool](https://www.ncetm.org.uk/in-the-classroom/national-curriculum-resource-tool/)
- [Bay-Williams & Kling, *Math Fact Fluency* — sample chapters (ASCD)](http://files.ascd.org/pdfs/publications/books/Math-Facts-Fluency-Sample-Chapters.pdf) · [Kling & Bay-Williams, *Three Steps to Mastering Multiplication Facts*](https://www.academia.edu/18767576/Kling_Gina_and_Bay_Williams_Jennifer_M_Three_Steps_to_Mastering_Multiplication_Facts)
- [Clements & Sarama — Multiplying / Dividing learning trajectory](https://www.learningtrajectories.org/math/learning-trajectories/multiplying-dividing)
- [Polypad virtual manipulatives](https://polypad.amplify.com/) · [Didax virtual manipulatives](https://www.didax.com/apps/)
- [Teaching with a Mountain View — Complete Guide to Teaching Multiplication and Division](https://teachingwithamountainview.com/teaching-multiplication-and-division/)
