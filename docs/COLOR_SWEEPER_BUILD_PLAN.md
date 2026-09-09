# Color Sweeper — proposed build plan

**Skill id:** `color-sweeper` · **Proposed ages:** 6–14 · **Category:** `logic` ·
**30 teaching lessons + 10 practice lessons on 3 activity engines, across 6 kinds of clue.**

**Status: all ten phases complete and gated. 40 lessons, three engines, six clue kinds. Voice recorded (31 clips, OpenAI) and the skill published by the operator on 9 September 2026. Plan revised September 9, 2026 against a
technique benchmark (§0). Phases 2–10 are not authorized. No voice generation is included.**

This plan follows `docs/SKILL_DEVELOPMENT.md` and `docs/SKILL_BUILD_TEMPLATE.md`.
Its section structure and incremental build phases follow `docs/MULTIPLICATION_BUILD_PLAN.md`.
The standard skill guide controls implementation; the multiplication plan is an example,
not a requirement to copy its engine or lesson count.

The user’s screenshot is a visual reference. It does not establish the original game’s
rules. The user authorized Phase 0 on September 9, 2026 using this plan’s proposed
Koda rules: same-color neighbors, diagonals included, clue cell excluded. This is not
a claim that the original pictured game uses those rules.

## Status — Phase 0 delivery record

**Scope authorized:** Phases 0–10, September 9, 2026. Phase 0 is foundations only;
Phase 1 adds one engine and the five reading levels. No publication or voice recording.

**Plan revised September 9, 2026** after benchmarking the technique inventory against
Minesweeper pattern guides, Hexcells and Tametsi (§0). The teaching progression grew from
18 + 8 lessons over five techniques to 30 + 10 over thirteen, and §18 was rebuilt around a
single rule. What this costs the Phase 0 code is stated below; no implementation was started.

| Delivered | Where / evidence |
|---|---|
| Fresh baseline | Lint passed; **2,158 tests in 144 files** passed; production build passed |
| Public board contract | `internal/board.ts`: visible givens/clues, geometry, authoring validation, canonical answer/selection keys |
| Human deduction rules | `internal/deduction.ts`: zero, full, remaining matches and subset overlap; candidate changes and causal-depth proof trace |
| Independent checker | `internal/validation.ts`: separate geometry and exhaustive search; distinguishes none, unique, multiple and budget-exhausted |
| Bounded generation | `internal/puzzles.ts`: the six original board modes; strict mode/size/palette/anchor constraints; seeded variants; checked fallback catalog |
| Layout and palette | `internal/layout.ts`, `internal/palette.ts`: 44px minimum tiles, internal-scroll fallback, orange/navy/cyan with permanent symbols |
| Animation foundations | Shared-kit transition names, reduced-motion/practice policy, timing targets; no new component animation implemented yet |
| Focused evidence | **68 tests**; 19 specifications × 32 seeds = **608 generated cases**, plus forced fallback checks for every specification |
| Final phase gate | **Passed September 9, 2026**: lint clean; **2,226 tests in 145 files**; production build clean |

All paths in the table are under `src/skills/color-sweeper/` unless stated otherwise.

**What the revision costs this code.** The Phase 0 foundations hold, but three files are now
incomplete against the revised plan, and this is a real cost, not a formality:

- `internal/board.ts` — `clues` is a flat list of neighbourhood clues with one colour. It needs
  the tagged union in §5 and an explicit `countedColor` separate from the tile's own colour.
- `internal/deduction.ts` — implements zero, full, remaining and subset overlap. The revised
  table adds complement, board total, line, region and run rules, and every one of them must
  produce the same causal proof trace or the certificate in §5 cannot be built.
- `internal/puzzles.ts` — six modes; the revision needs thirteen, plus the clue-removal
  necessity check in §5 rule 6, which no current generator performs.

The 68 tests and 608 generated cases remain valid for what they cover. They do not cover any
clue kind introduced by this revision.

## Status — Phase 1 delivery record

**Gate passed September 9, 2026:** lint clean; **2,317 tests in 150 files**; production build
clean; opened in the running app at `localhost:3001`.

| Delivered | Where / evidence |
|---|---|
| Skill scaffold | `manifest.json` (5 features, 5 settings), `lessons.json`, `index.ts`, `voice.json`, empty `audio/manifest.json` |
| Engine A | `activities/NeighborLens.tsx`: all four modes — `select_neighbors`, `count_same`, `read_clue`, `complement` |
| Apparatus | `internal/BoardGrid.tsx`: permanent symbol *and* letter on every tile, 44px floor, internal scroll fallback, one accessible name per tile |
| Reading questions | `internal/lenses.ts`: seeded generation for all four modes, with the constraint checks refusing rather than relaxing |
| Levels 1–5 | Five lessons, all JSON on the one engine |
| Registration | `registry.ts`, `color-sweeper-quest` thumbnail, course unit 65 appended |
| Tests | **163** across six files: contract, audit, content, round drivers, features, course, motion |
| Real app | Draft visible to a developer only; five lessons listed with resolved icons; a full round played; light and dark checked |

### What Phase 1 caught

- **Five questions that were one question.** Level 1 anchored to the centre of a 3×3 board,
  and a 3×3 board has exactly one centre cell — so every question outlined the same tile and
  only the decorative colours moved. Every assertion passed, because each question was
  individually valid. Found by the user, watching it run. Levels 1–3 now draw a board size as
  well as a position, and two tests hold the line: one requires a lesson's round to be
  distinct boards, the other requires the outlined tile itself to move.
- **A `seen` set that deduplicated the painting rather than the question.** The cause of the
  above. `lensKey` included the colours, so re-colouring the same target counted as a new
  question — the code did not do what its own comment said. It now keys on what determines
  the answer and nothing else.
- **A prompt that gave away the answer.** "Tap every tile that touches the outlined one.
  There are 8." states the thing being worked out. The count moved to rung three of the hint
  ladder, and a test forbids a digit in that prompt.
- **A board that animated up from invisible.** Measured in an automation tab whose compositor
  produced **one frame in 27 seconds**: the board never appeared. §18's rule is that animation
  completion is never required for correctness, and `opacity: 0` breaks it on any device that
  drops those frames. The entrance now starts at a readable 0.55.
- **A spring used for a fade.** `SPRING.enter` is underdamped, so the board sat visibly washed
  out while a child was already reading it. Opacity has no momentum; it is a 180ms tween now,
  inside the declared feedback budget.
- **One colour meaning two things.** The outlined tile and the child's own selections were
  both violet — "the tile we are asking about" and "a tile I picked" looked alike. The board
  marks its own tile in ink, the child's choices in violet, and they never swap.
- **A multiplication audit that assumed it was last.** `multiplication.audit.test.ts` asserted
  everything from its first lesson to the end of the course was multiplication, which held only
  while it was the final skill. Appending unit 65 failed it with multiplication untouched and
  still contiguous. Rewritten to assert what it meant: one unbroken block.

### What Phase 1 does not establish

No deduction. Nothing here asks a child to work out a tile's colour — that is engine B, and
levels 6 onward. Reduced motion is exercised by every unit test (the suite runs with it on)
but has not been seen on a real device. The 360px pass was made by measurement rather than by
eye: the automation tab is pinned at 1440 CSS px, tiles measured 64px against a 44px floor and
a 3×3 board occupies 232px, but no phone has run it.

## Status — Phase 2 delivery record

**Gate passed September 9, 2026:** lint clean; **2,342 tests in 150 files**; production build
clean; levels 6–8 played in the running app.

| Delivered | Where / evidence |
|---|---|
| Engine B | `activities/SweeperBoard.tsx`: palette, paint, erase, undo, check |
| Renderer | `BoardGrid` gained a `paint` mode: a fixed tile renders as an image, not a button, so a clue cannot be pressed at all |
| Grading | `isSolution` recounts the clues from the visible board; the question type carries no `solution` field, so an answer cannot reach the renderer |
| Hints | Read off the board as it stands via `deduce`, one rung naming the clue and one working the step |
| Levels 6–8 | Three lessons; all six generated techniques ship with the engine so levels 9–14 can be JSON |
| Course | Unit 66 appended |
| Tests | **184** across seven files; board answers derived from `enumerateSolutions`, never from the engine's own key |

### What Phase 2 caught

- **Painted tiles outliving their board.** The assignment was held on its own, so for one render
  after a new question arrived it was the previous puzzle's colours against the new puzzle's
  clues. Hints are computed during render, `deduce` validates strictly, and the round died with
  "Fixed tiles cannot be changed or erased" — mid-lesson, not in a test. State is now keyed to
  the board it belongs to, so a stale assignment is unusable rather than merely wrong. This is
  the stale-snapshot trap the Phase 3 gate was written to look for, arriving a phase early.
- **A refusal for a case a child cannot reach.** The engine explained that a clue tile cannot be
  repainted; the renderer had already made fixed tiles non-interactive, so the branch was dead
  code pretending to handle something. The plan's rule is that fixed clues are noninteractive,
  and the test now asserts the clue is not a button rather than that pressing it says no.
- **Too few boards for a three-question round.** The zero and full generators build 3×3 boards
  only, so a lesson pinned to one anchor repeated itself by question three. Lessons now cycle
  the clue's position, which keeps the technique identical and the board new.

### What Phase 2 does not establish

No overlap, chain or three-colour lesson, though the engine generates all of them. The worksheet
adapter is written and unit-tested but no sheet has been printed. 360px remains measurement
rather than a device.

## Status — Phase 3 delivery record

**Gate passed September 9, 2026:** lint clean; **2,351 tests in 150 files**; production build
clean; level 12's hint ladder walked in the running app.

Four lessons, no new code. Levels 9–11 are the three remaining-match cases — count met, one
short, all the rest — and level 12 is the first board that cannot be finished in one move.
Course unit 67. Tests: **193**.

### What Phase 3 caught

- **Level 11 could generate level 8's board.** A corner clue touches three tiles, so a clue
  needing three of them is not "the spaces left equal the matches left" — it is "every
  neighbour matches", which is level 8. The solver classifies it as `full`, and the board is
  valid, unique and scores correctly; only its *technique* is the wrong one. Corners are now
  excluded from level 11, and the test that caught it reads the proof rather than the board.

  This is §5 rule 6 arriving early and in a form the plan did not anticipate. Rule 6 asks
  whether a board can be solved *without* its technique. This board could not — it simply had
  a different technique than the lesson claimed. Both checks are needed, and the second is the
  cheaper one: compare the proof against the lesson's name.

### What Phase 3 does not establish

The hint ladder was walked by hand on one chain board. No overlap, pattern or three-colour
lesson exists yet. The worksheet adapter is still unprinted.

## Status — Phase 4 delivery record

**Gate passed September 9, 2026:** lint clean; **2,365 tests in 150 files**; production build
clean; the 1-2-1 wall opened in the running app. Tests: **207**.

Levels 13–16, plus three pieces of engine work the content turned out to require.

| Delivered | Where / evidence |
|---|---|
| Cross-colour clues | `Clue.countedColor` and a `counted()` accessor in `board.ts`, honoured by `deduction.ts`, `validation.ts` and the renderer |
| `pattern` generator | `puzzles.ts`: `121`, `1221` and `121-lookalike` walls, all verified unique before being written |
| §5 rule 6 | `certify` re-solves every overlap and pattern board with subset reduction switched off and rejects it if it still finishes |
| Partial answers | A question may ask for the tiles a reduction settles, with the rest required to stay blank |
| Levels 13–16 | Course unit 68 |

### Three things the content forced

- **A clue could only count its own colour**, and a 1-2-1 wall needs three clues counting the
  tiles above them without being that colour. Built with same-colour clues the wall prints as
  **2-4-2** — arithmetically the same deduction, and not the pattern the lesson is named after.
  So `countedColor` was pulled forward from Phase 5. This is one piece of that phase's tagged
  union, not the whole thing: line, region, run and total clues are still to come.
- **Levels 13 and 14 would have been the same board.** The overlap generator always produces
  overlap-then-local, and a search over the template family found no board where the order
  reverses. §17 already said what the distinction is: 13 asks what the clues settle, 14
  completes the same board. That needs an answer that is *partly blank*, which the engine could
  not express — Check demanded a full board. Now a partial question grades the settled tiles and
  requires the rest to stay blank, so "we need another clue" is the correct answer rather than a
  failure to finish. Colouring every tile correctly is **wrong** in level 13, and says why.
- **A cross-colour clue drew two symbols and the bigger one was the wrong one.** Its own colour
  and its counted colour both appeared, with the own-colour mark larger. The tile's colour is
  already carried by its fill and letter; what it counts is the entire clue. The symbol slot now
  shows the counted colour alone.

### What Phase 4 does not establish

No three-colour or capstone board. The look-alike wall is checked by test — its answer is not
the memorised outcome — but no child has met it. The worksheet adapter is still unprinted, and
360px is still measurement.

## Status — Phase 5 delivery record

**Gate passed September 9, 2026:** lint clean; **2,381 tests in 150 files**; production build
clean; the region and run boards opened in the running app. Tests: **224**. Course units 69–70.

The plan's biggest phase, and the one where the shape turned out simpler than written.

| Delivered | Where |
|---|---|
| `ClueScope` union | `board.ts`: neighbourhood, line, region, board — plus `governed()`, the one question each kind answers differently |
| Complement rule | `deduction.ts`: on a two-colour board every clue also yields its other-colour reading, marked `derived` in the proof |
| Run rule | `deduction.ts`: enumerate the arrangements the line still allows, keep what they agree on |
| Five generators | `complement`, `global`, `line`, `region`, `run_together`, `run_apart` |
| Rendering | A chip strip above the board for clues with no tile; region cells outlined in rose |
| Levels 17–22 | Six lessons, six concept keys |

### What the phase actually needed

**Three of the five "new clue kinds" were one change.** A neighbourhood, a row, an outlined
region and the whole board are all *a set of cells*. Once a clue can name its own set, zero,
full, remaining-match and subset reduction work over every one of them unchanged — no rule per
kind. §2 reads as five separate features; it is one abstraction and two genuinely new rules.

**The complement is a reading, not a rule.** Rather than a `complement` deduction, every clue
on a two-colour board now yields a second constraint in the other colour. The existing rules
then compare an orange clue with a navy one, which they previously skipped outright — the
board stalled with the answer in plain sight.

### What it caught

- **A violated clue was named twice.** A clue now produces two constraints, and a broken clue
  breaks both. Caught by a Phase 0 test, which is what that test was for.
- **The independent validator did not know about runs.** The solver got the right answer and
  `enumerateSolutions` called every run board "multiple", so certification rejected all of them.
  The fix is a *second* implementation of the condition inside the checker — deliberately not
  shared with the solver, because a checker that borrowed the solver's idea of "together" would
  agree with it including when both were wrong.
- **The region outline was violet.** Violet already means "a tile I chose"; a region drawn in
  it says the board arrived with five tiles pre-selected. This is the same collision as the
  target ring in Phase 1, reintroduced in a new place, so there is now a test for the rule
  rather than for the instance.

### Deviation from §2

§2 puts a line clue in a gutter at the end of its row. It is a chip strip above the board
instead, naming the row in words. A gutter needs the grid and the chip to share a layout, and
"Row 2: 1 orange" is unambiguous in a screen reader, in print and at 360px, which a gutter
would have to earn separately in all three. §2 should be updated or the gutter built; it is
recorded here rather than quietly left as a mismatch.

### What Phase 5 does not establish

No printed sheet has been produced for any new clue kind, and the printed form was part of this
phase's exit evidence — the adapter handles them, but on paper it is untested. Reduced motion
is exercised by the suite, not by a device. 360px is still measurement.

## Status — Phase 6 delivery record

**Gate passed September 9, 2026:** lint clean; **2,390 tests in 151 files**; production build
clean; the capstone opened in the running app. Tests: **232**. Course unit 71.

| Delivered | Where |
|---|---|
| Complement past two colours | `deduction.ts`: over any set of open cells, counts for all but one colour give the last |
| `cross_color` | Clues counting different colours over the same tiles; partly open by design |
| `totals` | One board-scope clue per colour |
| `mixed` | A board drawn at random and kept only if it certifies: three clue kinds present, two used in the proof |
| Levels 23–26 | Course unit 71 |

### The complement was two-colour by accident, not by nature

Phase 5 derived a clue's other-colour reading only when the palette had two colours, on the
grounds that with three "not orange" is a pair rather than a count. That was the wrong reason.
The identity is that the counts over a set of cells add up to the size of the set, so knowing
*all but one* gives the last — with two colours that is one clue, with three it is two. Level
24 is exactly that case: a cyan count and a navy count over the same three tiles say how much
orange there is, and only then can the two orange clues be compared.

The grouping is by the cells still **open**, not by the cells a clue governs. Those differ: a
centre clue governs eight tiles while three are open, and a row clue over exactly those three
is talking about the same tiles in a different colour. Grouping by what a clue governs missed
every such pair, which is most of them.

### What it caught

- **A derived constraint that changed nothing.** It was stated over cells that could not take
  the derived colour, so applying it left every domain as it was and the solver span until it
  hit its pass bound and threw. The identity holds over all the cells; only some of them are
  places the colour could go.
- **`counts: "other"` is meaningless with three colours.** It picks whichever colour comes
  first, so all three of level 24's clues silently counted the same one and the board would not
  generate. A template clue can now name the palette colour outright.
- **An edit that landed in two functions.** The template block was inserted into `certify` as
  well, where `rand` does not exist — caught by the compiler, which is where that belongs.

### What Phase 6 does not establish

The printed form is still untested on paper, now three phases old and part of Phase 5's stated
exit evidence. Reduced motion is exercised by the suite, not a device. 360px is measurement.
The capstone is generated by random search with a 64-attempt budget; it has never failed to
find a board in testing, but a fallback catalogue for it does not exist.

## Status — Phase 7 delivery record

**Gate passed September 9, 2026:** lint clean; **2,408 tests in 152 files**; production build
clean; levels 28 and 29 opened in the running app. Tests: **250**. Course unit 72.

Engine C, the first new engine since Phase 2, and the MP3 block — the four levels where a child
judges reasoning rather than producing it.

| Delivered | Where |
|---|---|
| `ClueLab` | `activities/ClueLab.tsx`: `compare_clues`, `choose_reason`, `find_error` |
| Question generation | `internal/reasons.ts`, including `forces()` — the sufficiency check |
| Levels 27–30 | The first lessons in this skill carrying a published standard: `CCSS.MATH.PRACTICE.MP3` |

### Nothing here is marked against a key

Each of the three modes re-does the work instead of comparing with a stored answer:

- **Sufficiency** is a re-solve. A chosen set of clues is put on a board by itself and the
  solver asked whether the tile still comes out. A child who names a set nobody anticipated is
  right if their set works, and a distractor that happened to be sufficient is marked correct
  rather than punished — the option's own flag is computed the same way, so the two can never
  disagree.
- **A reason** has two accepted wordings of the same rule, because a child who says it their
  own way has not made a different move. The plan asked for that; the test presses both.
- **A broken clue** is found by recounting the painted board. One wrong tile can break more
  than one clue, and every one of them is accepted.

### What it caught

- **Two tests hard-coded the engine list.** Phase 3's "adds no engine" assertion compared the
  skill's whole activity map against two names, so a third engine failed a test about Phase 3.
  It now states what it meant: these four lessons run on an engine that already existed.
- **A test that drove the wrong board.** It mounted a fresh activity — always question one —
  and pressed labels taken from questions two, three and four. It failed loudly, which is the
  good case; a version that had passed would have been asserting nothing.
- **Reason sentences began in lowercase**, because a clue's name leads the sentence and reads
  "the orange 2 at row 2, column 2 still needs…". Caught by eye in the running app.

### What Phase 7 does not establish

The printed form is still untested on paper — now four phases old, and part of Phase 5's stated
exit evidence. `find_error` boards are restricted to clues that sit on tiles, because a child
taps the clue and an off-board chip is not tappable; auditing a board total or a region clue is
therefore not yet possible and is not claimed anywhere.

## Status — Phase 8 delivery record

**Gate passed September 9, 2026:** lint clean; **2,454 tests in 153 files**; production build
clean; practice level 36 opened in the running app. Tests: **296**. Course units 73–75.

Ten practice lessons, and **all 40 lessons are now live**.

### The bug this phase existed to find

**Every practice round would have thrown on question one.** `modeAt` counts from one, as a round
does; `buildQuestion` counts from zero. All three engines passed the raw index, so the first
question asked for `modes[-1]` — undefined, and a throw naming a mode nobody wrote. No teaching
lesson sets `modes`, so eight phases of tests could not have caught it, and the first child to
open practice would have met a crash. It is the same off-by-one that hit five multiplication
engines at once, in the one place this skill had left for it to hide.

### Two more the practice lessons forced

- **A lesson's options reached modes that refuse them.** Practice 34 cycles `remaining` and
  `chain`, and passes anchors; `chain` takes no anchor and the generator throws rather than
  ignoring it — correctly. The fix belongs in the engine, not in each lesson: a lesson says
  "cycle these modes, and use these anchors where anchors apply", and working out where they
  apply is the engine's job. Getting it wrong throws mid-round, not at build time.
- **Partial and complete boards could not share a round.** Whether a question asks for the whole
  board or only what the clues settle was a lesson-level flag, so a round mixing a complement
  board with a region board would have graded one of them by the wrong rule. It now follows the
  board: if the rules cannot settle every tile, the question asks for the ones they can. Level
  13 keeps its explicit narrowing, because that is a choice about a board that *could* be
  finished.

### Two tests that were wrong rather than the code

Practice lessons carry no `kidTip` and no `audioPrompt`, which the audit test read as missing
data — it now requires them to be empty, because a hint button with nothing behind it teaches a
child that the app's controls are decorative. And a nine-question round exhausts some board
pools; §5 rule 8 allows repetition once a small space runs out, so the variety test now holds
teaching rounds to full distinctness and practice rounds to what the space allows.

### Attribution

Levels 31 and 36 each exercise several techniques and each review under a single concept key,
with the host's practice flag keeping both out of the recommendation catalogue. A test holds
that no two practice lessons share a key, so an aggregate score can never be read as evidence
for a technique it merely touched.

### What Phase 8 does not establish

The printed form is still untested on paper — five phases old now. Practice resume is wired
through `resumable` and exercised by the kit's own tests, but no round has been abandoned and
reopened in the app.

## Status — Phases 9 and 10 delivery record

**Final gate, September 9, 2026:** lint clean; **2,583 tests in 155 files**; production build
clean. Color Sweeper's own tests: **425**.

### Phase 9 — the audit, and the debt it was carrying

The printed form had been named as Phase 5's exit evidence and carried unpaid through three
phases. It is paid: **90 worksheet tests**, every lesson building a full sheet, and every clue
kind checked on paper.

| Checked | Result |
|---|---|
| All 40 lessons print | Every one fills a sheet and carries a method |
| Off-board clues on paper | "Whole board", "Row 3", "Outlined area" printed in words — the chip layout does not survive, so the words do |
| Run conditions | "together" / "not together" spelled out; braces and dashes alone would print as punctuation |
| Cross-colour clues | The counted colour is on the tile's own label, because colour cannot carry it in print |
| Colour independence | Every tile prints its symbol *and* its letter |
| Answer keys | Tile-by-tile for the colouring lessons; "Any of:" where several answers are right |
| §17 coverage | All 40 blocks present, each with the six headings §18's coverage rule requires |
| Standards | MP3 on levels 27–30 exactly, and on nothing else |

Two of the first tests written were wrong rather than the code, and both for the same reason —
they assumed one engine's shape across three. The printed *line* in this skill is generic and
the *board* is the question, so distinctness has to be measured on figures, not sentences. And
a reading board is fully coloured on purpose: the child circles tiles rather than filling them,
so "there must be a blank" holds only for the colouring lessons.

### Phase 10 — the real app

| Checked | Result |
|---|---|
| 360px | Tiles 64px against a 44px floor; the round's own scroll width stays 360 with no horizontal overflow |
| Dark | Checked on the region and mixed boards; the ink target ring and rose region outline both hold on a dark ground |
| Keyboard | Every control this skill owns is reachable and shows a focus ring |
| Offline | A full round produces **no network requests** after load |
| Round | Level 20 played to completion, three of three correct |
| Access | Draft: developers only, and disabling the skill empties it from the course |

### Two findings that are not this skill's

- **Two shared chrome controls have no visible focus ring**: "Leave this round" and "More
  options" in `SkillRoundTopBar`. Every skill inherits them. Not fixed here — it is shared code
  and outside this phase's scope — but it is a real keyboard-accessibility gap in six skills.
- **Navigating away from an open round leaves the previous activity mounted.** Clicking through
  to another lesson without pressing Close gives the new lesson's header above the old lesson's
  board, with the old board's paint still on it. Closing first behaves correctly. Host
  navigation, not the skill.

### Limits on the accessibility claim

The 360px pass is a measurement, not a phone. The automation tab is pinned at 1440 CSS px, so
the app's `sm:` breakpoints never switch: the round overlay was clamped to 360 and its contents
measured. That is sound for this skill's apparatus, which uses no breakpoint classes at all, and
it says nothing about the shared chrome, whose desktop-only clusters stay visible in the
simulation. Reduced motion is exercised by every unit test — the suite runs with it on — and has
not been seen on a device. The service worker is registered but an offline reload was not
performed; what is verified is that a round in progress makes no network calls.

### Release note, draft

Color Sweeper: 40 lessons on three engines, teaching deduction from colour clues. Six kinds of
clue — neighbourhood, complement, board total, line, region and run — with every board certified
solvable by the rules the lessons teach, and no board solvable by guessing.

**Voice:** 31 clips recorded through OpenAI — the thirty teaching prompts and one refusal line.
The ten practice lessons are silent by design and record nothing.

**Release:** the manifest ships `draft`; the operator published it on 9 September 2026. Those
are allowed to differ — seeding never overwrites a publication choice, so the manifest is the
shipped default and the server registry is the operator's. Published means it reaches the whole
audience band, ages 6–14, rather than developers only.

### Decisions resolved in Phase 0

- The solver receives a `Board` containing visible evidence only. The hidden `solution` remains on the separate grading object; a test makes any hidden-answer access throw.
- Generation uses technique-directed templates with seeded positions, unrelated fixed tiles, reflections, rotations and color permutations. It is a finite question space, not an infinite random-board claim. More template families can be added without weakening acceptance checks.
- An overlap board must stall with local rules alone. A chain must contain a causal sequence of at least two deductions. A three-color board must preserve two candidates after its first exclusion and later determine the last color.
- Exhausting a search budget never establishes uniqueness. The independent validator reports `budget-exhausted`, and certification rejects it.
- Every fallback passes the same specification, proof and independent solution checks. Impossible specifications throw instead of quietly changing the lesson.
- Round memory is owned by the future activity and passed as a `seen` set. Tiny exhausted spaces can repeat; clearing that set starts fresh round memory.
- `src/skills/catalog.ts` excludes all practice lessons from concept recommendations using the standard practice flag; there is no special mixed-practice flag to invent. Lesson 31 will use `color-clue-reader` as its existing foundation-review label and must not be presented as separate evidence of mastery for each of its component techniques.

### What this phase does not establish yet

No interaction is mounted in Phase 0. Actual 360px light/dark rendering, keyboard focus,
requested hint animation, rapid tapping, practice silence and offline app reload require
the later playable engines. The layout and policy tests establish numerical and logical
constraints, not a browser or device pass.

## The design in one sentence

Teach the learner to read a colored number clue, determine which neighboring tiles can
match it, combine clues, and complete a color grid with reasons for every placement.

### How to play — a plain-language proposal

1. Your job is to color the empty tiles. Choose a color, then touch a blank tile.
2. A numbered tile is fixed. Its number counts neighboring tiles of the **same color**.
3. The eight touching positions count, including diagonals. The numbered tile itself does not.
4. At an edge or corner, only the positions inside the board count.
5. You win when all empty tiles are filled and every numbered clue is true.
6. You may change your mind using Erase or Undo. Press Check to submit an answer.

**First example:** use only orange and navy. Put an orange **0** in the center of a
3×3 board. All eight surrounding tiles must be navy: zero of them may be orange.

**Next example:** an orange **2** has one known orange neighbor and just one unknown
neighbor; its other neighbors are known navy. That unknown must be orange, because the
clue needs exactly one more orange tile.

With three colors, “not orange” leaves **two** possibilities. Do not teach that every
excluded color automatically determines the answer.

**Clues that are not about neighbors.** Later boards carry four more kinds, because a
neighborhood count is not the only thing a puzzle can tell you — a chip at the end of a row
counts along that row, a dashed outline counts inside its own shape, a strip above the board
counts a color across the whole grid, and a clue written `{3}` or `-3-` says whether the tiles
it counts sit together. Each one looks different on the board, so a child can see which kind
they are reading before they read it.

**The other color is a clue too.** Because every tile here gets a color — unlike a mine, which
is either there or not — an orange **3** in the middle of the board also says five neighbors
are navy. That second number is free, and from level 5 the child is taught to read it.

## 0. Benchmark — what other puzzles establish and what Koda takes

Desk research September 8–9, 2026. These are documented feature comparisons, not play-tested
ratings or claims about competitors' learning effectiveness.

### Sources

| Reference | What the source establishes | Decision for this skill |
|---|---|---|
| [Simon Tatham's author guide](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/devel/writing.html) | Fair puzzles must support deduction from available information; describes solver-assisted generation. | Require a deduction certificate for each accepted board. A hidden answer existing is insufficient. |
| [Minesweeper pattern guides](https://minesweepergame.com/strategy/patterns.php) | 1-2-1 and 1-2-2-1 are the canonical composite patterns; both are shorthand for **subset reduction** — subtracting one clue's accounted-for cells from an overlapping clue. | Teach the reduction rule, then teach the two named patterns as the shapes it produces. Composite patterns are their own technique family, not a harder version of overlap. |
| [Hexcells clue notation](https://steamcommunity.com/sharedfiles/filedetails/?id=1277866465) | Three clue kinds beyond a plain count: `{n}` the marked cells are consecutive, `-n-` they are not all consecutive, and clues attached to a whole column rather than a neighbourhood. | Adopt all three as a distinct clue-kind family. They change what a clue *is*, not merely how hard it is. |
| [Tametsi](https://store.steampowered.com/app/709920/Tametsi/) | Clues count a **defined region** of any shape, not only the eight touching cells; global information gives the total per colour. | Adopt region clues and a per-colour board total. Both unlock reasoning the neighbourhood rule cannot express. |
| [Nonogram instructions](https://puzzlygame.com/pages/how_to_play_nonograms/) | Row and column run-length clues; explicit filled and empty states. | Keep run-length out. A *count* along a line is adopted; a *run* is a different puzzle. |
| [Mosaic instructions](https://www.puzzler.com/media/puzzles/instructions/Mosaic.pdf) | A number counts filled cells around it **and includes its own cell**. | Explicitly teach our difference: the clue cell is excluded. Verify before building. |

### Technique coverage against the field

The row that matters. A blank in the Koda column was a gap in the first draft.

| Technique | Minesweeper | Hexcells | Tametsi | Koda (revised) |
|---|---|---|---|---|
| Zero excludes the neighbourhood | ✅ | ✅ | ✅ | 6, 7 |
| Count met — exclude the rest | ✅ | ✅ | ✅ | 9 |
| Count equals spaces — fill the rest | ✅ | ✅ | ✅ | 8, 10, 11 |
| Chained forced moves | ✅ | ✅ | ✅ | 12 |
| Subset overlap / reduction | ✅ | ✅ | ✅ | 13, 14 |
| **Named composite patterns (1-2-1, 1-2-2-1)** | ✅ | — | — | **15, 16** |
| **Complement — what the other colour must be** | n/a (one hidden kind) | n/a | partial | **5, 17** |
| **Global count for the whole board** | ✅ (mine counter) | ✅ | ✅ per colour | **18, 25** |
| **Line clue — a count along a row or column** | — | ✅ | ✅ | **19** |
| **Region clue — an arbitrary marked area** | — | — | ✅ | **20** |
| **Consecutive `{n}` / non-consecutive `-n-`** | — | ✅ | — | **21, 22** |
| **Contradiction as a solving move** | informal | informal | informal | **29, 30** |
| Three or more target colours | — | — | ✅ (colour totals) | 23, 24, 25 |
| Guess-free guarantee | ✗ (50/50s exist) | ✅ | ✅ | ✅ — certificate required, §5 |

Two observations worth carrying into the design.

**Our rule is doubly-constraining and the first draft never used it.** Every other game hides
one kind of thing: a mine, or a blue cell. Ours colours *every* tile, so an orange `3` in a
full neighbourhood says three are orange **and five are navy**. That complement is the single
richest property of the chosen rule and it appeared nowhere in the eighteen-level draft.

**Variety of clue kind is what keeps a grid interesting.** Hexcells and Tametsi both run far
past eight neighbours' worth of content, and neither does it by making the neighbourhood
arithmetic harder — they add new *kinds* of clue. That is also the answer to the presentation
problem in §2: a line clue, a region outline and a `{3}` look different on the board, so the
picture changes as the skill progresses rather than staying one grid for every lesson.

Koda-specific requirements come from the repository: concept prerequisites, shared round
scoring, separate practice, live-state hints, accessibility, offline operation and worksheets.
Do not infer that competitors lack a feature merely because these sources do not mention it.

## 1. Pre-flight

### Standard and reference files

- `docs/SKILL_DEVELOPMENT.md`: implementation rules and validation matrix.
- `docs/SKILL_BUILD_TEMPLATE.md`: release scope, lesson map, engine decisions and delivery.
- `src/skills/kit/example/ExampleActivity.tsx`: minimal activity contract.
- `src/skills/counting/index.ts`: registration, assets and voice declarations.
- `docs/THEME.md`, `docs/VOICE.md`, `docs/PLUGINS.md`: read the relevant sections during implementation.

### Baseline and boundaries

At the start of implementation, record fresh lint, test and build results. Preserve existing
work, including multiplication. Add only the new skill’s registry entry, appended course units,
and required thumbnail outside its folder. Regenerate seed files through the existing scripts;
do not maintain generated seeds manually.

Use contiguous local `params.level` values 1–26. Let the host own global course numbers,
learner-facing lesson numbers, and XP. Start with `status: "draft"`.

## 2. Architecture — three interactions

| Engine / activity | What the learner does | Modes | Teaching levels |
|---|---|---|---|
| A · `NeighborLens` / `neighbors` | Select a neighbourhood, count matching colours, read a clue, name the other colour | `select_neighbors`, `count_same`, `read_clue`, `complement` | 1–5 |
| B · `SweeperBoard` / `board` | Select a palette colour and paint editable cells | `zero`, `full`, `remaining`, `chain`, `overlap`, `pattern`, `complement`, `global`, `line`, `region`, `run`, `three_color`, `mixed` | 6–26 |
| C · `ClueLab` / `reason` | Compare clue evidence, choose a justification, or locate an error | `compare_clues`, `choose_reason`, `find_error` | 27–30 |

The activity owns the interaction. Lessons choose modes and constraints, never level branches.
A and C use a shared board renderer from this skill's `internal/` folder; they do not import B's
activity component. Shared Koda chrome stays in `kit/`.

**B has thirteen modes and one interaction.** Every mode paints a cell; what differs is the
*clue kind rendered on the board* and the constraint the generator must satisfy. This is the
answer to the first draft's flatness — the mode does not change what the learner's hands do, it
changes what the board looks like and what can be deduced from it:

| Clue kind | Where it is drawn | Reads as |
|---|---|---|
| Neighbourhood count | Inside a fixed cell | "3 orange touch me" |
| Complement | Inside a fixed cell, second line | "3 orange · so 5 navy" |
| Board total | A header strip above the grid | "12 orange on this board" |
| Line clue | A gutter chip at the end of a row or column | "4 orange in this row" |
| Region clue | A chip on a dashed outline enclosing arbitrary cells | "2 orange inside this shape" |
| Run clue | A fixed cell, count wrapped in braces or dashes | `{3}` together · `-3-` not all together |

Six visibly different boards across the progression, not one grid for thirty lessons. Each kind
needs its own renderer test in §14 and its own reduced-motion static form in §18.

Search the live registry for a compatible existing engine before creating each one. Counting,
observation and bottle-sort provide adjacent concepts, but their current interactions do not
establish a reusable neighbour-constraint puzzle engine.

## 3. Master teaching table

Every lesson below has a worked board, reasoning, answer, common mistake, hint direction and
animation specification in §17. The cross-lesson animation contract and phase gates are in §18.

External prerequisite: existing `counter`. The following concept keys are proposed; check
for equivalent keys again before implementation. Reuse a key when the assessed capability is
unchanged. All lessons reference the activity under `color-sweeper/`.

**Foundations — what a neighbourhood and a clue are (1–5)**

| Level / lesson id | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint strategy | Practice |
|---|---|---|---|---|---|---|
| 1 / touching-tiles | Identify all touching positions / `neighbor-identifier` | `counter` | A / `select_neighbors` | 3×3; centre target; 8 neighbours | Touching positions, then diagonals | 31 |
| 2 / edges-and-corners | Identify clipped neighbourhoods / `neighbor-identifier` | `neighbor-identifier` | A / `select_neighbors` | 3×3; edge or corner; 5 or 3 neighbours | Stay inside the board | 31 |
| 3 / matching-colors | Count matching neighbours / `color-neighbor-counter` | `neighbor-identifier` | A / `count_same` | 3×3; 2 colours; centre, edge and corner cases | Count matching symbols once | 31 |
| 4 / what-a-clue-says | Interpret a clue's colour and count / `color-clue-reader` | `color-neighbor-counter` | A / `read_clue` | Choose a meaning; include self-count and wrong-colour distractors | Name colour, then counted positions | 31 |
| 5 / the-other-color | State what the clue says about the other colour / `color-complement-reader` | `color-clue-reader` | A / `complement` | 2 colours; clue plus neighbourhood size given; answer is the other count | Neighbourhood size minus the clue | 31 |

**Single-clue deduction (6–12)**

| Level / lesson id | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint strategy | Practice |
|---|---|---|---|---|---|---|
| 6 / zero-means-none | Exclude a colour with zero / `zero-color-eliminator` | `color-clue-reader` | B / `zero` | 3×3; 2 colours; centre zero | No neighbour matches | 32 |
| 7 / zero-at-an-edge | Apply zero to clipped neighbourhoods / `zero-color-eliminator` | `zero-color-eliminator` | B / `zero` | Corner/edge clue; all other unknowns constrained | Outline actual neighbours | 32 |
| 8 / every-neighbor-matches | Fill a full neighbourhood / `full-color-deducer` | `color-clue-reader` | B / `full` | 3×3; clue equals 8, 5 or 3 by position | Every available position matches | 33 |
| 9 / matches-already-found | Exclude a colour after its count is met / `remaining-color-deducer` | `zero-color-eliminator`, `full-color-deducer` | B / `remaining` | Known matches equal clue; unknown neighbours remain | Count known matches first | 34 |
| 10 / one-more-match | Deduce the last required match / `remaining-color-deducer` | `remaining-color-deducer` | B / `remaining` | One unresolved position and one missing match | Clue minus known matches | 34 |
| 11 / all-remaining-match | Fill all remaining candidates / `remaining-color-deducer` | `remaining-color-deducer` | B / `remaining` | Missing matches equal unresolved candidates | Compare spaces with missing matches | 34 |
| 12 / follow-the-clues | Chain forced deductions / `remaining-color-deducer` | `remaining-color-deducer` | B / `chain` | 3×3–4×4; at least 2 linked deductions | Use a newly solved tile in the next clue | 34 |

**Two clues at once — reduction and its named shapes (13–16)**

Benchmark note: minesweepergame.com presents 1-2-1 and 1-2-2-1 as patterns to memorise. We
teach the reduction *rule* first (13, 14), then show that the two famous patterns are what the
rule produces on a wall (15, 16). A child who learns only the shapes cannot solve a board that
does not contain one.

| Level / lesson id | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint strategy | Practice |
|---|---|---|---|---|---|---|
| 13 / shared-neighbors | Compare overlapping clues / `overlapping-color-deducer` | `remaining-color-deducer` | B / `overlap` | 4×4; 2 colours; a strict subset deduction required | Separate shared and unshared positions | 35 |
| 14 / overlap-chains | Complete a board with overlap deductions / `overlapping-color-deducer` | `overlapping-color-deducer` | B / `overlap` | 4×4; overlap plus local deductions | Subtract shared evidence, then continue | 35 |
| 15 / the-one-two-one | Solve the 1-2-1 wall / `clue-pattern-solver` | `overlapping-color-deducer` | B / `pattern` | Three collinear clues 1,2,1 against a straight unknown wall; solvable by reduction alone | Reduce the middle clue against each 1 | 35 |
| 16 / the-one-two-two-one | Solve the 1-2-2-1 wall / `clue-pattern-solver` | `clue-pattern-solver` | B / `pattern` | Four collinear clues 1,2,2,1; at least one non-pattern distractor wall present | The same subtraction, one step further along | 35 |

**Information the neighbourhood cannot give (17–22)**

Benchmark note: this block is where Hexcells and Tametsi get their length, and where the first
draft stopped. Each level introduces a new *kind* of clue rather than a harder count.

| Level / lesson id | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint strategy | Practice |
|---|---|---|---|---|---|---|
| 17 / count-the-other-color | Deduce from the complement / `color-complement-deducer` | `color-complement-reader`, `remaining-color-deducer` | B / `complement` | The orange count alone is insufficient; the navy complement forces the cell | How many spaces, how many orange, so how many navy? | 36 |
| 18 / how-many-are-left | Use the board total / `board-total-deducer` | `remaining-color-deducer` | B / `global` | Header total required; no neighbourhood clue resolves the last cells | Count what is already painted, subtract from the total | 37 |
| 19 / a-whole-row | Use a line clue / `line-clue-deducer` | `remaining-color-deducer` | B / `line` | 4×4–5×5; at least one deduction needs a row or column chip | A line is a neighbourhood too — count along it | 36 |
| 20 / a-marked-area | Use a region clue / `region-clue-deducer` | `line-clue-deducer` | B / `region` | Dashed region of 4–7 cells, not a rectangle; region clue required | The clue counts what the outline holds, nothing else | 36 |
| 21 / all-in-a-run | Use a consecutive `{n}` clue / `run-clue-deducer` | `line-clue-deducer` | B / `run` | `{n}` on a line of 5–6; count alone leaves ≥2 arrangements | They sit together — which starts are possible? | 36 |
| 22 / a-gap-somewhere | Use a non-consecutive `-n-` clue / `run-clue-deducer` | `run-clue-deducer` | B / `run` | `-n-` where the count alone would allow the run to be together | At least one gap. Which arrangement is ruled out? | 36 |

**Three colours (23–25)**

| Level / lesson id | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint strategy | Practice |
|---|---|---|---|---|---|---|
| 23 / three-color-choices | Eliminate across three colours / `three-color-deducer` | `overlapping-color-deducer` | B / `three_color` | 4×4; 3 colours; at least one cell needs two exclusions | Keep both remaining candidates after one exclusion | 38 |
| 24 / three-colors-and-overlap | Reduce overlapping clues of different colours / `three-color-deducer` | `three-color-deducer` | B / `three_color` | Two clues of *different* colours over shared cells | Subtract only within one colour at a time | 38 |
| 25 / three-color-totals | Use per-colour board totals / `board-total-deducer` | `three-color-deducer`, `board-total-deducer` | B / `global` | 3 colours; three header totals; last region resolved by total only | Which colour has none of its total left? | 38 |

**Putting it together, and proving it (26–30)**

| Level / lesson id | Objective / conceptKey | Requires | Engine / mode | Question constraints | Hint strategy | Practice |
|---|---|---|---|---|---|---|
| 26 / every-kind-of-clue | Solve a board mixing clue kinds / `mixed-clue-solver` | `region-clue-deducer`, `run-clue-deducer`, `board-total-deducer` | B / `mixed` | 5×5; ≥3 clue kinds; certificate must use at least two of them | Which clue kind can still say something new? | 36 |
| 27 / which-clues-help | Select evidence for a forced placement / `color-proof-checker` | `mixed-clue-solver` | C / `compare_clues` | A specified target; judge sufficient evidence sets | What is shared and what remains? | 39 |
| 28 / explain-the-move | Choose a correct justification / `color-proof-checker` | `color-proof-checker` | C / `choose_reason` | One proposed forced move; all valid reasons accepted | Link colour, count and neighbourhood | 39 |
| 29 / spot-a-contradiction | Locate a violated clue / `color-contradiction-checker` | `remaining-color-deducer` | C / `find_error` | Deliberately incorrect paint; accept any actually violated clue | Compare actual count with clue | 40 |
| 30 / check-a-three-color-board | Audit a three-colour placement / `color-contradiction-checker` | `three-color-deducer`, `color-contradiction-checker` | C / `find_error` | 3 colours; actual violated clue required; ≥1 board mixes clue kinds | Count the specific clue colour only | 40 |

### Practice lesson order

All use `params.question.practice: true`, concept `Practice Without Help`, nine questions,
no teaching intro, hints, exploration help or activity speech. Teaching and practice course
units are separate. Mixed practice must use the host's mixed-practice exclusion from concept
recommendations; it must not imply a new mastery concept.

| Level / lesson id | Title | Engine / modes | Concept attribution / prerequisite |
|---|---|---|---|
| 31 / practice-neighbors | Practice: Neighbours and Clues | A / all four modes | Mixed foundation review labelled `color-clue-reader`; requires that key; standard practice flag excludes it from recommendations |
| 32 / practice-zero | Practice: Zero Clues | B / `zero` | `zero-color-eliminator` |
| 33 / practice-full | Practice: Full Clues | B / `full` | `full-color-deducer` |
| 34 / practice-remaining | Practice: Remaining Matches | B / `remaining`, `chain` | `remaining-color-deducer` |
| 35 / practice-overlap | Practice: Overlapping Clues | B / `overlap`, `pattern` | `overlapping-color-deducer`, `clue-pattern-solver` |
| 36 / practice-clue-kinds | Practice: Every Kind of Clue | B / `complement`, `line`, `region`, `run`, `mixed` | `mixed-clue-solver` |
| 37 / practice-totals | Practice: Board Totals | B / `global` | `board-total-deducer` |
| 38 / practice-three-colors | Practice: Three Colours | B / `three_color` | `three-color-deducer` |
| 39 / practice-reasons | Practice: Give a Reason | C / `compare_clues`, `choose_reason` | `color-proof-checker` |
| 40 / practice-checking | Practice: Check the Clues | C / `find_error` | `color-contradiction-checker` |

Phase 0 confirmed the host excludes all practice from the recommendation catalog. Do not
report level 31's aggregate accuracy as separate mastery of all four foundation concepts, and
do not report 36's as mastery of the four separate clue-kind keys it exercises. If per-concept
practice measurement is later required, split those two reviews before Phase 6.

### Age bands

The first draft gave nearly every lesson "6–14", which is not a band — it is the absence of
one, and it would put a contradiction audit in front of a six-year-old. Banded by what the
level actually asks:

| Levels | Band | Why |
|---|---|---|
| 1–8 | 6–9 | Counting to eight and reading one clue |
| 9–12 | 7–11 | Subtraction within a clue, and holding a chain of two or three steps |
| 13–22 | 8–13 | Two clues compared; a clue kind that is not the neighbourhood |
| 23–26 | 9–14 | Three colours, or several clue kinds in one board |
| 27–30 | 9–14 | Judging evidence and auditing someone else's work |

### Standards

The first draft used empty `standards` arrays on the grounds that no content standard fits.
That is right about content and wrong about practice: the CCSS Standards for Mathematical
Practice describe exactly what this skill trains, and they are a published framework we can
cite honestly.

| Standard | Levels | Basis |
|---|---|---|
| `CCSS.MATH.PRACTICE.MP1` — make sense of problems and persevere | 12, 14, 26 | Multi-step boards where the first move is not given |
| `CCSS.MATH.PRACTICE.MP3` — construct viable arguments and critique the reasoning of others | 27–30 exactly | 27–28 construct the argument; 29–30 critique a board someone else painted |
| `CCSS.MATH.PRACTICE.MP7` — look for and make use of structure | 15, 16, 21, 22 | Named patterns and run structure |

No content standard (`CCSS.MATH.CONTENT.*`) is claimed. Levels not listed keep an empty array.
Trajectory labels remain explicitly internal puzzle-progression labels.

## 4. Folder layout

```text
src/skills/color-sweeper/
  manifest.json
  lessons.json
  index.ts
  voice.json                 declarations only; no generated clips in this request
  audio/manifest.json        empty until a separately requested recording task
  activities/
    NeighborLens.tsx
    SweeperBoard.tsx
    ClueLab.tsx
  internal/
    puzzles.ts              board schema, seeded generation, validation
    deduction.ts            candidate sets, rule steps, proof trace
    reasons.ts              evidence and misconception options
    BoardGrid.tsx            shared apparatus, no host chrome
    layout.ts
    palette.ts
  assets/                   flat skill-owned SVGs only
  color-sweeper.test.ts
  color-sweeper.puzzles.test.ts
  color-sweeper.activities.test.tsx
  color-sweeper.hints.test.ts
  color-sweeper.practice.test.tsx
  color-sweeper.features.test.tsx
  color-sweeper.course.test.ts
  color-sweeper.worksheets.test.tsx
```

Create a helper only when its first consumer needs it. Names are proposed, not files delivered.

## 5. Puzzle data — the content contract

### Board specification

| Field | Contract |
|---|---|
| `size` | 3, 4 or 5; integer dimensions. Run and line lessons may use a single strip (1×n) |
| `palette` | 2 or 3 semantic color IDs, each with a distinct permanent symbol |
| `solution` | Exactly one color per cell; private answer data, never used to style choices |
| `givens` | Fixed colored cells; fixed clue colors cannot change |
| `clues` | A tagged union — `neighborhood` (position, counted color, number), `line` (row or column index, counted color, number), `region` (explicit cell list, counted color, number), `run` (line, counted color, number, `consecutive: true \| false`), `total` (counted color, number). Every kind carries the counted color explicitly, which may differ from its own tile's color |
| `mode` | An approved interaction mode; invalid authoring values fail clearly |
| `regions` | Named cell lists a `region` clue may reference; drawn as permanent board furniture, never as a hint overlay |
| `seed` | Deterministic board identity and reproducible failures |
| `proof` | Rule, input clue IDs, affected cells, candidate changes; difficulty evidence |
| `expected` | Count, canonical selected set, canonical full board, or accepted reasoning response |

### Rules the generator must obey

1. A neighborhood clue counts one named color among the tiles it touches; include diagonals
   and exclude its own tile consistently. From level 15 the counted color may differ from the
   clue tile's own color, so no code may assume they are equal.
2. Generate locally with bounded search; use a validated fallback satisfying the **same** constraints.
3. An impossible specification throws; a timeout never silently changes the requested technique.
4. Board completion must be unique, independently checked. A single stored answer proves nothing.
5. The supported human deduction rules must solve every unknown without hidden-answer access.
6. Every lesson's board must **need** its technique. The certificate is checked twice: once
   with the full clue set, and once with the lesson's characteristic clue kind removed. If the
   second run still solves the board, the board is rejected — an overlap lesson solvable
   cell-by-cell, a region lesson solvable from neighborhoods alone, or a run lesson solvable
   from the bare count teaches nothing it claims to. Three-color lessons must require genuine
   candidate elimination by the same test.
7. Difficulty depends on deductions, clue density, chain depth and the number of clue *kinds*
   in play, not merely board size.
7a. A `run` clue's `consecutive` flag must change the answer. Generate `{n}` boards where the
   count alone leaves at least two placements, and `-n-` boards where the count alone would
   permit the block to sit together.
8. Deduplicate within the round with bounded retries; allow repetition when a small space is exhausted.
9. All choices receive the same presentation. Never reveal correctness through tint, label or focus.
10. Candidate deductions are computed from visible givens and committed evidence. Solver code does not peek at unknown solution colors.
11. Canonicalize unordered answers before judging; accept every valid sufficient proof and violated clue.
12. Restart clears board, notes, history and round-local memory. Practice resume uses the host contract.

## 6. Engine behavior

### A. NeighborLens

`select_neighbors`: tap all touching positions, then check the selected set once. Include
diagonals and permit incorrect selections; never auto-select the answer.
`count_same`: show colors and the target; keep the target’s numeric answer hidden.
`read_clue`: choose what a clue means from misconception-based statements.
`complement`: given a clue and its neighborhood size, state the count for the other color.
Two-color boards only — the complement of one count is a single number only when two colors
are in play, and the mode must refuse a three-color board rather than compute a wrong answer.
Five teaching questions per round. Real buttons, distinct row/column labels, no color-only state.

### B. SweeperBoard

Paint, Erase, Undo and Check are the core controls. Fixed clues are noninteractive.
Incomplete Check shows an explanation but records no answer. A complete wrong board is an
answer attempt and remains available for correction. One whole board is one verdict; paint
moves do not award XP or produce independent answer records.
Three teaching boards per round. All thirteen modes use the same renderer and the same
interaction; what varies is which clue kinds the board carries and which constraint the
generator must satisfy. Each clue kind has its own renderer and its own renderer test — a
mode is not implemented until its clue kind is visibly distinguishable from the others on a
360px screen, in dark mode, and in the printed worksheet.
Optional candidate marks belong to the three-color mode only if their value is established
in the first usability pass; they are not required to complete the proposed release.

### C. ClueLab

A board and a specific claim or target appear together. Choose a reason, sufficient evidence,
or an actually violated clue. Judge submitted reasoning, not arbitrary wording. If two answers
are defensible, accept both or rewrite the question before shipping. Do not reveal a hidden
solution to manufacture an “error” that visible clues cannot establish.
Five teaching questions per round. Keep text short enough for the proposed age band.

All engines use `useSkillRound` and `SkillRound`, with host access only through `koda`.
No direct storage, network, audio constructor, custom XP or cross-skill internal imports.

## 7. Hints, feedback and error kinds

| Situation | Contextual response | Recording |
|---|---|---|
| Counts the clue itself | “Count around the outlined tile. Leave the tile itself out.” | Wrong submitted answer only |
| Misses diagonals | “The corner-touching tiles count too.” | Requested hint or answer feedback |
| Paints beside an orange zero | “This zero allows no orange neighbors.” | Do not auto-correct the paint |
| Confuses exclusion with a unique answer | “Not orange still leaves navy or the third color.” | Requested hint |
| Overlapping clues stall | Name the two clues and distinguish shared/unshared positions | Contextual then worked hint |
| Checks an incomplete board | “Fill the empty tiles before checking.” | Refused setup action; no answer or hint |
| Proof selects an insufficient clue | Explain which uncertainty remains | Wrong proof attempt |
| Compares two clues of different colors | "These count different colors. Say them both in one color first." | Requested hint |
| Reads a line or region clue as a neighborhood | Redraw the row or outline and name what it holds | Requested hint |
| Ignores `{n}` or `-n-` | "The braces say they sit together." / "The dashes say they do not." | Requested hint |
| Stalls with no neighborhood clue left | Name the *kind* of clue still unused, not the tile | Contextual hint only |
| Sums totals across colors | "Each color has its own total." | Requested hint |

Three hint rungs: lesson `kidTip`, contextual evidence from the live board, then a worked step.
Choice tasks stop short of revealing the answer. Action tasks may explain a placement fully.
Use the kit’s support reporting, and suppress all instructional support in practice.

## 8. Voice and art

**No voice generation in this request or these build phases.** If implemented later, inventory
only lines actually spoken, reuse common phrases, gate activity speech on `audio_speech`, and
use `quietWhenPractising`. Recording is a separate explicitly requested task.

The screenshot suggests rounded orange/navy/gold tiles and a warm background. Preserve the
recognizable grid while using Koda’s theme tokens and shared chrome. `docs/THEME.md` prohibits
new yellow UI accents: propose orange, navy and cyan for live play, with ●, ◆ and ▲ symbols.
Keep gold only in the supplied-reference illustration unless the design requirement is
explicitly changed. Verify contrast in both themes; do not make the playable grid tilted.

Use code-native flat SVG for the thumbnail and simple board art. No raster generation is needed.

## 9. Worksheets

| Engine | Supported modes | Printed figure and answer |
|---|---|---|
| A | All | Grid with target, letter/symbol color labels; blank count or selection space |
| B | All | Fixed clues, blank unknowns, complete rule and palette legend; teacher solution separately |
| C | All if self-contained | Visible evidence, proposed claim and response options; accepted explanations in key |

Register `build`, `prompt`, `printed`, `method` and `figure` as appropriate. Reuse generation.
A paper puzzle must not require color printing, hover feedback or hidden UI state. Return
`null` for any mode whose task cannot be preserved, and document that limitation.

## 10. Build phases

Phase 0 is in final validation; **Phases 1–10 have not started**. The delivery record above
contains actual evidence; the remaining phase rows remain future work.
Each engine is built with its declared modes before later JSON-only lessons depend on them.

The expanded clue-kind work is Phase 5, and it is deliberately placed after the reduction
lessons rather than folded into Phase 2: a new clue kind needs its own generator constraint,
its own renderer, its own printed form and its own reduced-motion form, and burying that in
the engine phase is how a clue kind ends up looking like every other one.

| Phase | Teaching/practice levels | New engine | Deliverables | Exit evidence |
|---|---|---|---|---|
| 0 · **done** | — | — | Fresh baseline; puzzle schema; neighbor rules; independent validator; rule solver; bounded generation; layout/palette decisions | **Passed**: hand-checked corner/edge/centre examples, unique solutions, rule certificates and impossible-input tests; motion vocabulary agreed (§18) |
| 1 · **done** | 1–5 | A · NeighborLens | Skill scaffold, all four A modes, first lessons, draft registration, first appended teaching unit | **Passed**: contract/smoke plus every-mode round driver; wrong→right; complement refuses a three-colour board; light/dark checked in the running app; reduced motion exercised by the suite |
| 2 · **done** | 6–8 | B · SweeperBoard | Painting/erase/undo/check; the neighbourhood clue renderer; zero and full lessons; worksheet adapter | **Passed**: complete and corrected boards; incomplete checks refused and unscored; fixed clues are not buttons; all six generated techniques solvable with a unique answer. Cross-colour clues (`NO1`) are Phase 5 and untouched |
| 3 · **done** | 9–12 | None | Four JSON lessons for remaining-match and chain reasoning | **Passed**: no new activity, no level branch; each lesson's boards checked against the solver's proof for the rule the lesson is named after |
| 4 · **done** | 13–16 | Cross-colour clues; `pattern` generator; partial answers | Overlap lessons; the two named patterns; the clue-removal necessity test from §5 rule 6 | **Passed**: every board re-solved with subset reduction switched off, and fails; each pattern lesson draws a look-alike wall whose answer is not the memorised one |
| 5 · **done** | 17–22 | None (new clue kinds in B) | Complement, board total, line, region and run clue kinds — schema, generator constraint, renderer, printed form, reduced-motion form | **Passed**: each kind is the only thing that solves its board; `{n}` and `-n-` boards re-checked with the condition stripped and left genuinely open; region outlines are drawn with the board. Line clues are a chip strip, not a gutter — see below |
| 6 · **done** | 23–26 | Complement generalised past two colours | Three-colour lessons, per-colour totals, and the mixed capstone | **Passed**: the first narrowing on a three-colour board leaves two candidates standing; three separate totals, never one; the capstone carries at least three clue kinds and its proof uses at least two |
| 7 · **done** | 27–30 | C · ClueLab | All C modes; evidence/justification data; misconception feedback | **Passed**: both wordings of a reason accepted; every clue the painted board actually breaks accepted; sufficiency judged by re-solving, not by a stored key |
| 8 · **done** | 31–40 | None | Ten practice lessons and separate course units | **Passed**: nine questions each; every named mode actually reached; no hint or read-aloud control rendered at all; 31 and 36 review under one key apiece |
| 9 · **done** | — | None | Feature, hint, worksheet, art, manifest and course audit | **Passed**: all 40 lessons print a full sheet; every clue kind carries itself on paper in words; §17 covers all 40 with its six required headings; MP3 claimed on levels 27–30 and nowhere else |
| 10 · **done** | — | None | Integration, accessibility pass in the real app, final review package and draft release notes | **Passed with stated limits**: 64px tiles and no overflow at 360; light and dark checked; every control this skill owns takes focus and shows a ring; a full round played end to end with no network traffic. See the limits below |

For each implementation phase, run focused checks while working. Before closing a phase,
run `npm run lint`, `npm test`, and `npm run build`, and open its new/changed interaction in
the running app. Record actual results and any defects caught under that phase, following
the multiplication plan’s delivery log. Do not pre-fill green statuses.

Publication is a separate action after the completed draft is reviewed. It is not part of
this planning request. Daily challenges, larger grids, user levels and sharing are deferred.

## 11. Manifest proposal

```json
{
  "id": "color-sweeper",
  "name": "Color Sweeper",
  "version": "1.0.0",
  "description": "Read color clues, combine neighboring evidence, and solve a grid through deduction.",
  "category": "core",
  "author": "Koda Math Lab",
  "iconName": "Grid3X3",
  "tagline": "Every tile has a reason.",
  "thumbnail": "color-sweeper-quest",
  "status": "draft",
  "audience": { "ages": [6, 14], "category": "logic" },
  "requires": ["counter"]
}
```

Populate `teaches` with the unique confirmed concept keys in §3 — fourteen of them under the
revised table, up from eight. Do not infer prerequisites from lesson IDs. Verify category and
icon support before finalizing the manifest. The manifest `ages` span stays 6–14 because it
describes the skill; the per-level bands in §3 are what gate an individual lesson.

| Proposed feature | Observable effect / reader |
|---|---|
| `audio_speech` | Teaching intro, requested read-aloud and hints; engine-owned calls gated explicitly; no recording task |
| `sound_chimes` | Checked-answer sounds in each engine |
| `haptic_feedback` | Checked-answer tactile feedback in each engine |

Keep symbols permanent, never an accessibility toggle. Do not declare premium gating,
animations, candidate marks or helper switches before their behavior exists. Use engine
question constraints for difficulty; no user-facing difficulty setting is required initially.

## 12. Color Sweeper error register

| Trap | Prevention / evidence |
|---|---|
| Reproducing unverified screenshot rules | Settle the rule sheet before Phase 0 |
| Counting the clue itself | Explicit convention; independent hand-worked tests |
| Forgetting diagonals or wrapping edges | Exact corner/edge/center neighbor-set fixtures |
| Reading 0 as an empty or safe tile | Teach zero as a count of a specific color |
| “Not orange” treated as “navy” with three colors | Candidate-domain tests and dedicated lesson |
| A unique answer that requires guessing | Supported-rule proof trace must finish |
| A hidden solution used to generate hints | Hints derived from visible evidence and candidates |
| Overlap lesson solved by an unrelated easy clue | Technique-required certificate, not title-only difficulty |
| A clue kind that is only cosmetic | §5 rule 6: re-solve with that kind removed; the board must fail |
| A named pattern taught as a picture | Every pattern lesson ships a look-alike wall that does not reduce |
| `{n}` or `-n-` solvable from the bare count | §5 rule 7a: the flag must change the answer |
| Assuming a clue's tile colour is the colour it counts | Cross-colour clues from level 15; typed `countedColor` on every clue kind |
| A region clue drawn only when a hint is requested | Region outlines are board furniture, drawn with the board (§18) |
| Totals summed across colours | Per-colour totals kept separate in data, render and hint |
| Twenty-six lessons that all look like one grid | Six clue kinds with six renderers, each with its own renderer test (§2) |
| A three-colour board sent to `complement` mode | Mode refuses rather than computing a two-colour complement |
| A fallback violates the lesson constraints | Validate fallback with the same spec |
| Wrong paint rejected before the child can reason | Allow editable hypotheses; score submitted boards |
| Multiple valid reasons but only one accepted | Enumerate valid evidence and justification responses |
| Score every paint tap as an answer | One canonical complete-board submission |
| State from a 3×3 board leaks into 4×4 | Mode-transition and replay tests |
| A quiet practice round still exposes hints | Whole-round silence and absence-of-help tests |
| Small tiles or illegible symbols on phones | 44px target floor and real 360px review |
| Reusing the screenshot’s gold as general UI theme | Follow theme tokens and document palette choice |
| Draft registered but unreachable | Preview, audience and disabled-visibility tests |

## 13. Course placement

Append after the then-current course tail; do not hard-code unit IDs while multiplication
is still being developed. Proposed grouping:

| Unit purpose | Local levels | Kind |
|---|---|---|
| Neighbours and Clues | 1–5 | Teaching |
| Zero, Full and Remaining | 6–12 | Teaching |
| Two Clues at Once | 13–16 | Teaching |
| Clues of Other Kinds | 17–22 | Teaching |
| Three Colours and Everything Together | 23–26 | Teaching |
| Give a Reason, Check the Board | 27–30 | Teaching |
| Practice: Reading and Local Clues | 31–34 | Practice |
| Practice: Combining Evidence | 35–38 | Practice |
| Practice: Reasoning and Checking | 39–40 | Practice |

Every lesson appears exactly once, in order. Registration and course placement are both
required. Disabling the skill must remove its learner access; developer preview follows host rules.

## 14. Tests and acceptance evidence

| Check from the standard | Required Color Sweeper evidence |
|---|---|
| Structure | `describeSkillContract` and `describeActivitySmoke` for all three engines |
| Clue kinds | One renderer test per kind (neighbourhood, cross-colour, line, region, total, run) asserting a visibly distinct, labelled rendering at 360px in light and dark, a static reduced-motion form, and a printed form that survives without colour |
| Worked examples | Every §17 board with a multi-step answer enumerated exhaustively; solution count matches the stated answer, including the boards that deliberately leave tiles undecided |
| Necessity | Every generated board re-solved with its characteristic clue kind removed; the solve must fail (§5 rule 6) |
| Interaction | Accessible-name driver per engine, every mode, full rounds, wrong→right, incomplete/refused moves, rapid submissions and replay |
| Content | Independent enumerator; known-answer examples; valid clue bounds; unique solutions; rule proof; impossible and exhausted generation |
| Hints | Live cell/clue references, contradiction handling, proper reveal depth, no hidden answer lookup |
| Practice | Whole-round silence, mode coverage, no helper controls, host resume, normal completion and accurate attribution |
| Configuration | Every declared feature changes observable behavior in each applicable engine |
| Course | Every lesson once, correct ordering, separate practice, prerequisite validity, draft/disabled visibility |
| Print/art | Self-contained figures, correct teacher keys, blank learner work, accessible color labels and valid assets |
| Real app | Actual Learn and preview entry, perfect/corrected rounds, learning/XP evidence, 360×640 light/dark, keyboard and offline reload |

Behavior drivers may read telemetry to choose a UI answer. Independent content tests may not
trust that same answer key. Browser or offline checks not performed must remain marked untested.

## 15. Decisions to settle before Phase 0

| Decision | Recommendation | Status |
|---|---|---|
| Exact replica or Koda interpretation? | Koda interpretation unless the original game rules are supplied and verified | Proposed |
| What does a number count? | Same-color adjacent cells, diagonals included, self excluded | Proposed |
| Correctness model | Editable paint; explicit Check; no lives or countdown | Proposed |
| Learning scope | 30 teaching + 10 practice lessons across six clue kinds; revised September 9, 2026 after benchmarking against Hexcells, Tametsi and Minesweeper pattern guides — the earlier 18+8 covered five techniques and produced twenty-six visually identical grids | Revised |
| Engines | Three distinct interactions; one internal grid renderer with a renderer per clue kind | Revised |
| Palette | Orange/navy/cyan for play under current theme rules; reference gold remains illustrative. No yellow or amber anywhere | Proposed |
| Board size | 3×3 foundations, 4×4 advanced, 5×5 for the mixed capstone; 1×n strips for line and run clues | Revised |
| Question counts | A/C teaching 5; B teaching 3; practice 9 | Proposed |
| Voice generation | None | User instruction |
| Build authorization | Phases 0 and 1 authorized and delivered September 9, 2026. **Phases 2–10 are not authorized.** | User instruction |

### Definition of done — the original planning request

A Markdown build plan following the standard skill guide and multiplication’s structure,
plus an accessible HTML rendering with the benchmark, lesson tables, Phase 0 onward,
deliverables, gates, decisions and a plain-language explanation. **No game implementation.**

### Definition of done — the full implementation

All confirmed lessons open from the app and preview. Every engine and mode completes and
retries correctly; generators and hints are independently justified; practice is silent;
worksheets preserve the task; toggles work; course placement is correct; mobile and offline
checks are recorded; lint/test/build are green. The skill remains a reviewed draft until
publication is explicitly requested. Voice recording remains outside scope.

## 16. Sources

- Standard: `docs/SKILL_DEVELOPMENT.md`.
- Plan template: `docs/SKILL_BUILD_TEMPLATE.md`.
- Structural model: `docs/MULTIPLICATION_BUILD_PLAN.md`.
- [Simon Tatham — How to write a new puzzle](https://www.chiark.greenend.org.uk/~sgtatham/puzzles/devel/writing.html).
- [Hexcells Infinite — developer listing](https://store.steampowered.com/app/304410/Hexcells_Infinite/).
- [Hexcells clue notation reference](https://steamcommunity.com/sharedfiles/filedetails/?id=1277866465) — `{n}` consecutive, `-n-` non-consecutive, column clues.
- [Minesweeper pattern guide](https://minesweepergame.com/strategy/patterns.php) — 1-2-1 and 1-2-2-1 as consequences of subset reduction.
- [Tametsi](https://store.steampowered.com/app/709920/Tametsi/) — arbitrary region clues, per-colour global totals, guaranteed guess-free boards.
- [Puzzly Game — How to play Nonograms](https://puzzlygame.com/pages/how_to_play_nonograms/).
- [Puzzler — Mosaic instructions](https://www.puzzler.com/media/puzzles/instructions/Mosaic.pdf).

## 17. Worked examples — every proposed lesson

These are planning illustrations, not a playable implementation. Each teaching technique and
each practice lesson has a concrete task below. The worked answers belong in the plan or
a requested teaching hint, not on an unanswered practice screen.

**Board legend.** Tiles: `O` = orange circle; `N` = navy diamond; `C` = cyan triangle. `?A`
is an unknown tile named A. `O*` or `N*` is the outlined target of a counting task; its count
is hidden. `!` marks a learner-painted tile being audited. Plain colored tiles are fixed givens.
Rows and columns are counted from the top-left. Diagonals count; a clue never counts its own tile.

Clues, one row per kind:

| Written | Kind | Reads as |
|---|---|---|
| `O2` | Neighborhood | An orange tile; exactly two of the tiles it touches are orange |
| `NO1` | Neighborhood, cross-color | A navy tile; exactly one of the tiles it touches is **orange** |
| `\| O1` after a row | Line | Exactly one orange in that row (a footer line gives column clues) |
| `region 1 counts orange: 2` | Region | Exactly two orange among the listed tiles, drawn on the board as a solid thin outline |
| `total: O=3` | Board total | Exactly three orange on the whole board, drawn as a header strip |
| `O{3}` | Run, consecutive | Three orange along the line, in one unbroken block |
| `O-2-` | Run, non-consecutive | Two orange along the line, and they do not all touch |

The two-letter form (`NO1`) exists because a clue's tile color and the color it counts are
independent from lesson 15 onward; `O2` remains shorthand for a clue counting its own color.

The HTML displays these tokens as colored, symbol-labeled tiles. The letter notation keeps
the Markdown and printed versions understandable without color. Lesson 13 asks for a partial
deduction; lesson 14 completes the same board. Lessons 29, 30 and 40 intentionally show
incorrect learner paint, not broken generated puzzles. Several boards resolve only some of
their blanks; where a lesson leaves tiles undecided the worked answer says so, because
"this clue cannot decide yet" is itself part of the technique.

**Verified, not asserted.** Every board here whose answer takes more than one step was checked
by brute force on September 9, 2026 — all colourings enumerated, the clue set applied, and the
solution count compared against the stated answer. Lessons 15, 16, 25 and 26 have exactly one
solution; lessons 17 and 24 have two, which is what those two lessons claim (they name one tile
and leave the others open). A worked example that reads plausibly and resolves wrongly is the
defect this document is most likely to ship, so the check runs again whenever a board changes.

**Teaching flow:** show the puzzle and task → let the child act → offer the hint ladder only
when requested → Check → explain the verdict. **Practice flow:** show puzzle and task →
independent answer → Check. Practice explanations below are reviewer answer keys only.


### Lesson 01 — Touching tiles

**Child’s task:** Select every tile touching the outlined orange tile.

```board
N N N
N O* N
N N N
```

**Worked reasoning:**

1. Look immediately above, below, left and right: four positions.
2. Add the four diagonal positions. Do not select the center.

**Answer / successful action:** Select all eight surrounding tiles.

**Common mistake:** Selecting the middle tile, or selecting only four side neighbors.

**Hint direction:** First find side neighbors; then check the corners.

**Animation:** Each tile gets a selection outline when tapped. On a requested worked hint, outline sides and then diagonals; record this as support.


### Lesson 02 — Edges and corners

**Child’s task:** Select the neighbors of the top-left tile.

```board
O* N N
N N N
N N N
```

**Worked reasoning:**

1. Only positions inside the board exist.
2. The tile on its right, the tile below it, and the diagonal below-right touch it.

**Answer / successful action:** Select row 1 column 2, row 2 column 1, and row 2 column 2: three neighbors.

**Common mistake:** Wrapping to the opposite edge or assuming every tile has eight neighbors.

**Hint direction:** Trace the board boundary before counting.

**Animation:** A requested hint outlines the local corner neighborhood. Never draw phantom tiles outside the board.


### Lesson 03 — Matching colors

**Child’s task:** How many neighbors match the outlined orange tile?

```board
O N O
N O* N
N O N
```

**Worked reasoning:**

1. Count the orange tile at the top-left.
2. Count the orange tile at the top-right and the orange tile below the target.
3. Leave the outlined orange tile itself out.

**Answer / successful action:** 3 orange neighbors.

**Common mistake:** Counting all eight neighbors regardless of color, or answering 4 by including the center.

**Hint direction:** Count only orange circles around the outline.

**Animation:** Optional counting taps add neutral marks to the tiles the learner touches. No automatic numbering of correct matches before an answer.


### Lesson 04 — What a clue says

**Child’s task:** Choose what the navy 3 means.

```board
N O N
O N3 O
O N O
```

**Worked reasoning:**

1. Its color tells us what to count: navy.
2. Its number tells us how many: three.
3. The top-left, top-right and bottom-middle neighbors are navy.

**Answer / successful action:** Choose “Exactly three neighboring tiles are navy.”

**Common mistake:** Choosing “three orange tiles” or “three navy tiles including the center.”

**Hint direction:** Read the color first, then the number, then where to count.

**Animation:** After Check, link the navy symbol and the number to the chosen statement. Before Check, all statement options have equal visual emphasis.


### Lesson 05 — The other color

**Child's task:** The clue counts orange. How many of the tiles it touches are navy?

```board
?A ?B ?C
?D O3 ?E
?F ?G ?H
```

**Worked reasoning:**

1. The clue sits in the middle, so it touches eight tiles.
2. Three of those eight are orange.
3. Orange and navy are the only colors in play, so the rest are navy: 8 − 3 = 5.

**Answer / successful action:** 5 navy.

**Common mistake:** Answering 3, the printed number, or counting the clue's own tile as a ninth.

**Hint direction:** How many spaces does the clue touch? How many are already spoken for?

**Animation:** On request, draw the eight spaces as a bar, fill three with orange, and label the remaining five navy. Both numbers stay on screen together — the pair is the point.


### Lesson 06 — Zero means none

**Child’s task:** Use orange and navy. Color all eight blanks.

```board
?A ?B ?C
?D O0 ?E
?F ?G ?H
```

**Worked reasoning:**

1. The orange 0 permits no orange neighbors.
2. Every blank touches the clue.
3. Only navy remains available for each blank.

**Answer / successful action:** A–H are all navy.

**Common mistake:** Treating 0 as permission to use either color.

**Hint direction:** Zero means none of this clue’s color.

**Animation:** Painting changes the chosen tile’s fill and symbol. On a worked hint, show an orange exclusion mark before showing navy as the remaining option.


### Lesson 07 — Zero at an edge

**Child’s task:** Color the three blanks beside the corner clue.

```board
O0 ?A N
?B ?C N
N N N
```

**Worked reasoning:**

1. The corner clue touches only A, B and C.
2. Its orange 0 excludes orange from those three tiles.
3. With two colors, all three must be navy.

**Answer / successful action:** A, B and C are navy.

**Common mistake:** Counting five or eight positions around a corner, or changing fixed tiles elsewhere.

**Hint direction:** Name the three positions actually touching the corner.

**Animation:** A requested hint outlines A, B and C only. Leave unrelated fixed tiles visually unchanged.


### Lesson 08 — Every neighbor matches

**Child’s task:** Use orange and navy. Fill the board.

```board
?A ?B ?C
?D O8 ?E
?F ?G ?H
```

**Worked reasoning:**

1. A center tile has eight neighbors.
2. The orange clue requires eight orange neighbors.
3. All eight available positions must match.

**Answer / successful action:** A–H are all orange.

**Common mistake:** Counting the center as one of the eight and leaving a blank navy.

**Hint direction:** Compare the number of available spaces with the clue.

**Animation:** A requested worked hint pairs eight spaces with the count 8. Do not automatically paint them as part of an unrequested animation.


### Lesson 09 — Matches already found

**Child’s task:** Color A and B using orange and navy.

```board
O N O
?A O2 ?B
N N N
```

**Worked reasoning:**

1. The two top corners already provide two orange matches.
2. The clue needs 2 minus 2 = 0 more orange neighbors.
3. Neither A nor B may be orange.

**Answer / successful action:** A and B are navy.

**Common mistake:** Continuing to add orange after the count has already been met.

**Hint direction:** Count the orange matches already present before touching a blank.

**Animation:** On a requested hint, briefly outline the two known matches, then display “2 − 2 = 0 more.” No automatic correctness glow while painting.


### Lesson 10 — One more match

**Child’s task:** What color must A be?

```board
N O N
N O2 ?A
N N N
```

**Worked reasoning:**

1. There is one known orange neighbor above the clue.
2. The clue needs 2 minus 1 = 1 more orange neighbor.
3. A is the only unknown position.

**Answer / successful action:** A must be orange.

**Common mistake:** Using the number 2 as an instruction to paint two new tiles.

**Hint direction:** The clue gives the total, including matches already there.

**Animation:** On a worked hint, connect the known orange neighbor to “1 found,” then the blank to “1 still needed.”


### Lesson 11 — All remaining match

**Child’s task:** Color A and B.

```board
O N N
?A O3 ?B
N N N
```

**Worked reasoning:**

1. One orange neighbor is already known.
2. The clue needs 3 minus 1 = 2 more orange neighbors.
3. There are exactly two blanks, so both must match.

**Answer / successful action:** A and B are orange.

**Common mistake:** Thinking either blank can be navy even though both are needed.

**Hint direction:** Compare two missing matches with two available spaces.

**Animation:** A requested hint pairs two blank outlines with “2 more needed.” Each learner placement uses the same short fill transition.


### Lesson 12 — Follow the clues

**Child’s task:** Solve A, then use that result to solve B.

```board
O1 N N
?A N N
O2 ?B N
```

**Worked reasoning:**

1. The top-left orange 1 has A as its only possible orange neighbor, so A is orange.
2. Now read the bottom-left orange 2: its neighbors are A, a fixed navy tile, and B.
3. A supplies one match; B must provide the second.

**Answer / successful action:** A and B are orange, found in that order.

**Common mistake:** Treating each clue as isolated and forgetting a newly established match.

**Hint direction:** After solving A, find another clue that touches it.

**Animation:** During a requested worked explanation, outline the first clue, then A, then the second clue. Keep that sequence tied to actual deductions.


### Lesson 13 — Shared neighbors

**Child’s task:** Use the two orange clues to determine B and D. A and C can wait.

```board
N O ?A O2
N ?B O4 ?C
O ?D N4 O
O O N N
```

**Worked reasoning:**

1. The top-right orange 2 already touches the fixed orange 4. Therefore exactly one of A and C is orange.
2. The orange 4 already has three fixed orange neighbors. Therefore exactly one of A, B, C and D is orange.
3. A and C already account for that one orange. B and D cannot be orange.

**Answer / successful action:** B and D are navy. These two orange clues alone do not tell us which of A and C is orange.

**Common mistake:** Subtracting the printed numbers 4 − 2 without first accounting for known neighbors.

**Hint direction:** Write the remaining sets: A+C need 1 orange; A+B+C+D need 1 orange.

**Animation:** A requested hint outlines A/C as the shared positions with one line style, and B/D as the extra positions with another. Fade shared evidence in the explanation, never remove tiles.


### Lesson 14 — Overlap chains

**Child’s task:** Finish all four unknown tiles.

```board
N O ?A O2
N ?B O4 ?C
O ?D N4 O
O O N N
```

**Worked reasoning:**

1. Use the two orange clues as in the previous lesson: B and D are navy.
2. The navy 4 has two fixed navy neighbors on the bottom row. B and D provide the other two, so C cannot be navy: C is orange.
3. The orange 2 already has the fixed orange 4 and now C as its two matches. Therefore A is navy.

**Answer / successful action:** A = navy, B = navy, C = orange, D = navy. Every numbered clue now fits.

**Common mistake:** Continuing to treat B and D as unknown after they have been deduced.

**Hint direction:** Return to the navy 4 after establishing B and D.

**Animation:** On a requested worked explanation, move the focus from the orange pair to the navy clue and finally to the orange 2. Use a short focus transition, not a sweeping animation over the answer.


### Lesson 15 — The 1-2-1 wall

**Child's task:** The three clues count navy. Color A, B and C.

```board
?A  ?B  ?C
ON1 ON2 ON1
O   O   O
```

**Worked reasoning:**

1. Every tile these clues touch is either orange or one of A, B, C — so each clue is a statement about those three alone.
2. The left clue touches A and B: exactly one of them is navy.
3. The right clue touches B and C: exactly one of them is navy.
4. The middle clue touches all three: exactly two are navy.
5. One from A-and-B, one from B-and-C, two altogether. If B were navy it would be counted by both outer clues, leaving A and C orange — that is only one navy, not two. So B is orange.
6. That forces A navy (left clue) and C navy (right clue).

**Answer / successful action:** A and C are navy; B is orange.

**Common mistake:** Learning the shape "1-2-1 means the ends" and applying it to a wall that is not one. The rule is the subtraction, not the picture.

**Hint direction:** Write each clue as the set of tiles it still needs: A+B = 1, B+C = 1, A+B+C = 2.

**Animation:** On request, step through the three clues one tap at a time, outlining the tiles each still governs and writing its remaining count beside it. Never light the finished pattern all at once — that shows the shape and hides the reasoning.


### Lesson 16 — The 1-2-2-1 wall

**Child's task:** The four clues count navy. Color A, B, C and D.

```board
?A  ?B  ?C  ?D
ON1 ON2 ON2 ON1
O   O   O   O
```

**Worked reasoning:**

1. Left clue: A + B = 1. Second clue: A + B + C = 2. Subtracting, C is navy.
2. Right clue: C + D = 1. C is already navy, so D is orange.
3. Third clue: B + C + D = 2. C is navy and D is orange, so B is navy.
4. Left clue: A + B = 1 and B is navy, so A is orange.

**Answer / successful action:** B and C are navy; A and D are orange.

**Common mistake:** Assuming any run of clues reading 1-2-2-1 behaves this way regardless of what sits behind it. Each generated board includes a wall that looks similar and does not reduce, so the shape alone is never sufficient.

**Hint direction:** The same subtraction as the last lesson, carried one step further along the wall.

**Animation:** The reduction walks left to right, one clue per tap, carrying the result forward. Each step names the two clues being subtracted in text.


### Lesson 17 — Count the other color

**Child's task:** One clue counts orange and one counts navy. What color is C?

```board
?A  ?B  ?C
NO1 NN6 N
N   N   N
```

**Worked reasoning:**

1. `NO1` counts orange and touches only A and B among the unknowns: exactly one of A and B is orange.
2. `NN6` counts navy. It touches eight tiles, five of which are already navy, so exactly one of A, B and C is navy.
3. Only two colors are in play. One navy among three tiles means **two of A, B and C are orange**.
4. At most one of those two oranges can be A or B. So the other one is C.

**Answer / successful action:** C is orange. A and B stay undecided — one of each.

**Common mistake:** Comparing 1 and 6 directly. Two clues can only be compared once they count the same color.

**Hint direction:** Say both clues in the same color before you compare them.

**Animation:** On request, the navy 6 converts in place — the bar shows eight spaces, six navy, two orange — and only then do the overlap outlines appear. The conversion and the comparison are separate taps.


### Lesson 18 — How many are left

**Child's task:** The strip above the board counts orange for the whole board. Color A, B and C.

```board
total: O=3
O ?A ?B
N O  ?C
O N  N
```

**Worked reasoning:**

1. The header says the whole board holds three orange tiles.
2. Three orange are already painted: top-left, middle, bottom-left.
3. Orange is finished. Every tile still blank must be navy.

**Answer / successful action:** A, B and C are navy.

**Common mistake:** Counting only the orange near the blanks, or reading the total as a neighborhood clue belonging to the nearest tile.

**Hint direction:** Count every orange on the board, not the ones nearby.

**Animation:** On request, each already-orange tile ticks once as it is counted, and the header shows total, counted and remainder as one line. The tally is text as well as motion.


### Lesson 19 — A whole row

**Child's task:** The chip at the end of the row counts orange in that row. Color A, B and C.

```board
O ?A ?B ?C | O1
N N  N  N
N N  N  N
```

**Worked reasoning:**

1. The chip counts orange along its own row and nothing else.
2. One orange already sits at the left end of that row.
3. The row's single orange is accounted for, so A, B and C are navy.

**Answer / successful action:** A, B and C are navy.

**Common mistake:** Treating the chip as a neighborhood clue and counting the tiles below the row as well.

**Hint direction:** A row clue counts along the row. Trace the row with a finger before counting.

**Animation:** On request, the row's own tiles light and the rest of the board dims slightly. Dim, never hide — a hidden tile changes the puzzle.


### Lesson 20 — A marked area

**Child's task:** The dashed outline holds the tiles the clue counts. Color A, B, C and D.

```board
region 1 counts orange: 1  →  A, B, C, D and the orange tile
?A ?B N
?C O  N
?D N  N
```

**Worked reasoning:**

1. The outline marks five tiles. The clue counts orange inside it and nowhere else.
2. One of those five is already orange.
3. The region's single orange is accounted for, so A, B, C and D are navy.

**Answer / successful action:** A, B, C and D are navy.

**Common mistake:** Counting an orange tile that sits just outside the outline, or treating the outline as a neighborhood around the clue.

**Hint direction:** Trace the outline first. Then count only what is inside it.

**Animation:** The outline is permanent board furniture, drawn with the board, not a hint overlay — it is part of the puzzle, so it may never appear only on request. A requested hint lights the tiles inside it and dims the rest.


### Lesson 21 — All in a run

**Child's task:** `{3}` means three orange, and they sit side by side. Color A to E.

```board
row clue: O{3}
O ?A ?B ?C ?D ?E
```

**Worked reasoning:**

1. Three orange in this row, in one unbroken block.
2. The first tile is already orange, so the block starts there.
3. The block is tiles 1, 2 and 3: A and B are orange.
4. No orange remains, so C, D and E are navy.

**Answer / successful action:** A and B are orange; C, D and E are navy.

**Common mistake:** Reading `{3}` as a plain "three orange somewhere in the row" and leaving the placement open.

**Hint direction:** Where could a block of three sit if the leftmost tile is already orange?

**Animation:** On request, a three-wide window slides along the row, one position per tap, stopping at each placement the clue still allows. Show possibilities; never slide it straight to the true placement.


### Lesson 22 — A gap somewhere

**Child's task:** `-2-` means two orange, and they do not touch. Color A and B.

```board
row clue: O-2-
O ?A ?B
```

**Worked reasoning:**

1. Two orange in this row, with at least one gap between them.
2. The first tile is orange, so the second orange is A or B.
3. If it were A the two would sit side by side, and the dashes say they do not.
4. B is orange, and A is navy.

**Answer / successful action:** B is orange; A is navy.

**Common mistake:** Treating `-2-` as identical to a plain 2 — the count is the same, so the board looks solvable without ever reading the dashes.

**Hint direction:** Say the clue out loud: two orange, and they must not touch.

**Animation:** On request, place the second orange at A, mark the pair as touching, and withdraw it; then place it at B. Rejecting a placement is the lesson, so the rejected one must be shown.


### Lesson 23 — Three-color choices

**Child’s task:** Use orange, navy and cyan. What color is X?

```board
O0 N0 C C
C ?X C C
C C C C
C C C C
```

**Worked reasoning:**

1. X touches the orange 0, so X cannot be orange.
2. X also touches the navy 0, so X cannot be navy.
3. The only remaining palette color is cyan.

**Answer / successful action:** X is cyan.

**Common mistake:** Deciding “not orange means navy,” which only works in a two-color puzzle.

**Hint direction:** Keep track of all three options and cross out only what each clue excludes.

**Animation:** During a requested hint, show O/N/C candidate symbols, cross out O and then N, leaving C. Candidate elimination must have a text equivalent.


### Lesson 24 — Three colors and overlap

**Child's task:** Three colors. One clue counts orange, one counts navy, and the row chip counts cyan. What color is B?

```board
?A  ?B  ?C  | C1
CO1 CN1 CO1
C   C   C
```

**Worked reasoning:**

1. The row chip: exactly one of A, B, C is cyan. The navy clue in the middle: exactly one of A, B, C is navy.
2. Three tiles, one cyan and one navy — so exactly one of A, B, C is orange.
3. The left clue says one of A and B is orange. The right clue says one of B and C is orange.
4. There is only one orange among the three. If it were A, the right clue would have none. If it were C, the left clue would have none. Only B is counted by both.

**Answer / successful action:** B is orange. A and C are one navy and one cyan, not yet decided.

**Common mistake:** Adding the two orange 1s to get two oranges. Overlapping clues share a tile; their counts are not additive.

**Hint direction:** How many oranges are there among A, B and C altogether? Let the other two colors tell you first.

**Animation:** On request, the cyan and navy claims are marked off first and the remaining count is written, then the two orange clues outline their tiles — shared solid, unshared dashed. Candidate symbols stay visible on every unknown throughout.


### Lesson 25 — Three-color totals

**Child's task:** The strip counts each color across the whole board. Color A and B.

```board
totals: O=2  N=2  C=5
O   N   C
C   O   C
CN0 ?A  ?B
```

**Worked reasoning:**

1. Orange's total is 2 and two orange are already painted. Orange is finished, so neither A nor B is orange.
2. One navy and one cyan are still unplaced, and there are exactly two blanks. So A and B are one of each.
3. The bottom-left clue counts navy and says none touch it. A touches it.
4. A is cyan, and B is navy.

**Answer / successful action:** A is cyan; B is navy.

**Common mistake:** Adding the three totals into a single number, or forgetting that a clue tile's own color counts toward its color's total.

**Hint direction:** Take one color at a time. Which total is already used up?

**Animation:** Each color's total is stepped through separately — its painted tiles tick, its remainder is written — and the three lines never merge. Per-color totals stay visually separate; nothing ever sums across colors.


### Lesson 26 — Every kind of clue

**Child's task:** This board mixes clue kinds. Color every blank.

```board
total: O=2
region 1 counts orange: 0  →  C, D
O  ?A ?B ?C ?D | O-2-
?E N  N  N  N
N  N  N  N  N
```

**Worked reasoning:**

1. The row chip says two orange in the top row, and they do not touch. The first tile is already orange, so A cannot be — the two would be side by side.
2. The dashed region holds no orange, so C and D are navy.
3. B is the only tile left that could carry the row's second orange. B is orange.
4. The board total is two orange, and both are now on the board. Nothing else can be orange — so E, which no neighborhood clue touches, is navy.

**Answer / successful action:** B is orange; A, C, D and E are navy.

**Common mistake:** Finishing the top row and stopping, leaving E blank because no clue appears to reach it. E is only decided by the board total.

**Hint direction:** When the clues around a tile run out, ask which other kind of clue still has something to say about it.

**Animation:** The hint ladder here names the *kind* of clue to look at next before showing anything — row chip, then region outline, then header total — because choosing which clue to read is the skill this lesson teaches.


### Lesson 27 — Which clues help

**Child’s task:** Which two numbered clues are enough to prove B and D are navy?

```board
N O ?A O2
N ?B O4 ?C
O ?D N4 O
O O N N
```

**Worked reasoning:**

1. The orange 2 constrains A+C to one remaining orange.
2. The orange 4 constrains A+B+C+D to one remaining orange.
3. Comparing those two constraints rules orange out of B and D.

**Answer / successful action:** Select the orange 2 and orange 4 as the minimal sufficient pair. The navy 4 is not needed for this claim.

**Common mistake:** Selecting a nearby clue without explaining what it proves.

**Hint direction:** Look for two clues with the same remaining match count and nested unknown sets.

**Animation:** Selecting a clue outlines only its neighborhood. Reveal the shared-set comparison after checking or requesting help, not on hover.


### Lesson 28 — Explain the move

**Child’s task:** A player proposes orange for A. Choose the reason that proves it.

```board
N O N
N O2 ?A
N N N
```

**Worked reasoning:**

1. The clue asks for two orange neighbors in total.
2. One is already visible, and A is the only unknown.
3. Two minus one leaves one required orange tile.

**Answer / successful action:** Choose “One orange match is still needed, and A is the only blank.”

**Common mistake:** Choosing “orange looks right” or “the number 2 means paint two blanks.”

**Hint direction:** A valid reason must use the clue and the known neighbors.

**Animation:** After Check, underline the matching evidence and chosen reason together. Accept equivalent valid wording; do not animate only one preselected phrasing as correct.


### Lesson 29 — Spot a contradiction

**Child’s task:** The tile marked ! was painted orange. Which clue is violated?

```board
O N O
N O2 O!
N N N
```

**Worked reasoning:**

1. Count orange neighbors of the orange 2: top-left, top-right and the marked tile.
2. There are three matches, but the clue permits only two.
3. Changing the marked tile to navy restores the required count.

**Answer / successful action:** The orange 2 is violated: actual 3, required 2. The marked tile should be navy.

**Common mistake:** Counting just the two original orange tiles and ignoring new paint.

**Hint direction:** Recount all matching neighbors, including the newly painted tile.

**Animation:** After Check or a requested hint, outline the three matches and show “3 found / 2 needed.” Use an icon and text, not a red shake.


### Lesson 30 — Check a three-color board

**Child’s task:** The marked tile was painted navy. Check both numbered clues.

```board
N O C C
C N2 O C4
N C N! C
C C C C
```

**Worked reasoning:**

1. The navy 2 currently has three navy neighbors: top-left, bottom-left, and the marked tile.
2. The cyan 4 currently has only three cyan neighbors; the marked tile is the missing fourth.
3. Change the marked tile to cyan. The navy count drops to two and the cyan count rises to four.

**Answer / successful action:** Both clues expose the error. The marked tile must change from navy to cyan.

**Common mistake:** Counting cyan as navy because both look blue, or fixing one clue without rechecking the other.

**Hint direction:** Count diamond symbols for navy and triangle symbols for cyan separately.

**Animation:** After Check, show both count mismatches. On a worked correction, update the two count labels together as the example tile changes.


### Lesson 31 — Practice: Neighbors and Clues

**Child’s task:** Count the neighbors matching the outlined navy tile.

```board
N O O
O N* N
O O O
```

**Worked reasoning:**

1. Top-left and middle-right are navy.
2. The center is excluded.

**Answer / successful action:** 2.

**Common mistake:** Including the center.

**Hint direction:** Reference only: identify the counted neighborhood first. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.


### Lesson 32 — Practice: Zero Clues

**Child’s task:** Fill the blanks using orange and navy.

```board
?A O0 ?B
?C ?D ?E
N N N
```

**Worked reasoning:**

1. All five blanks touch the edge orange 0.
2. None may be orange.

**Answer / successful action:** A–E are navy.

**Common mistake:** Assuming an edge has only three neighbors.

**Hint direction:** Reference only: an edge has five neighbors. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.


### Lesson 33 — Practice: Full Clues

**Child’s task:** Fill the blanks using orange and navy.

```board
O3 ?A N
?B ?C N
N N N
```

**Worked reasoning:**

1. The corner orange 3 has exactly three neighbors.
2. A, B and C must all be orange.

**Answer / successful action:** A, B and C are orange.

**Common mistake:** Counting the clue itself.

**Hint direction:** Reference only: count available positions. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.


### Lesson 34 — Practice: Remaining Matches

**Child’s task:** Fill A and B.

```board
N O O
?A N3 ?B
O O O
```

**Worked reasoning:**

1. The navy 3 already has one navy match.
2. It needs two more, and exactly two blanks remain.

**Answer / successful action:** A and B are navy.

**Common mistake:** Painting the clue color only once.

**Hint direction:** Reference only: 3 minus 1 leaves 2. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.


### Lesson 35 — Practice: Overlapping Clues

**Child’s task:** Solve the rotated board.

```board
N N O O
O N4 ?D O
?C O4 ?B N
O2 ?A O N
```

**Worked reasoning:**

1. The orange 2 leaves one orange among A/C. The orange 4 leaves one among A/B/C/D, so B/D are navy.
2. The navy 4 then excludes navy from C.
3. C is orange; A is navy.

**Answer / successful action:** A = navy, B = navy, C = orange, D = navy.

**Common mistake:** Memorizing coordinates from the teaching board rather than reading the clues.

**Hint direction:** Reference only: compare residual sets. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.


### Lesson 36 — Practice: Every Kind of Clue

**Child's task:** Color the blanks. Boards draw from the line, region, run, complement and mixed clue kinds.

```board
region 1 counts orange: 1  →  A, B and the orange tile
?A ?B N
O  N  N
```

**Worked reasoning:**

1. The region holds three tiles and one orange, which is already painted.
2. A and B are navy.

**Answer / successful action:** A and B are navy.

**Common mistake:** Counting an orange outside the outline.

**Hint direction:** Reference only: identify the clue kind before counting. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Standard feedback after Check. No clue tracing, dimming, run sliding, counting or worked hints during practice — the region outline is board furniture and stays drawn.


### Lesson 37 — Practice: Board Totals

**Child's task:** Use the totals strip. Color the blanks.

```board
total: O=2
O ?A ?B
N O  ?C
```

**Worked reasoning:**

1. Two orange are painted and the total is two.
2. A, B and C are navy.

**Answer / successful action:** A, B and C are navy.

**Common mistake:** Counting only the orange next to the blanks.

**Hint direction:** Reference only: count the whole board. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback and standard checked-answer feedback. The totals strip is static; no counting sequence plays during practice.


### Lesson 38 — Practice: Three Colors

**Child’s task:** Find X using all three colors.

```board
C C C C
C C C C
C C ?X C
C C N0 O0
```

**Worked reasoning:**

1. The orange 0 excludes orange from X.
2. The navy 0 excludes navy from X.

**Answer / successful action:** X is cyan.

**Common mistake:** Stopping after the first exclusion.

**Hint direction:** Reference only: keep all candidates until excluded. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.


### Lesson 39 — Practice: Give a Reason

**Child’s task:** Choose why A must be navy.

```board
O N O
O N2 ?A
O O O
```

**Worked reasoning:**

1. The navy 2 needs two matches.
2. One is already present, and A is the only blank.

**Answer / successful action:** “One more navy match is needed, and only A is unknown.”

**Common mistake:** Choosing a reason that describes the picture but does not prove the move.

**Hint direction:** Reference only: use total minus known matches. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.


### Lesson 40 — Practice: Check the Clues

**Child’s task:** Identify the violated clues and the marked tile’s correct color.

```board
C C C C
C N! C N
C4 O N2 C
C C O N
```

**Worked reasoning:**

1. The navy 2 has three matches. The cyan 4 has only three.
2. Changing the marked navy tile to cyan satisfies both.

**Answer / successful action:** Both the navy 2 and cyan 4 are violated; the marked tile should be cyan.

**Common mistake:** Fixing the visible mismatch without checking neighboring clues.

**Hint direction:** Reference only: check both affected counts. No hints are offered to the child in this practice lesson.

**Animation:** Only learner-input feedback: selection outline or a short paint transition. Show standard feedback after Check. No animated clue tracing, counting, candidate elimination or worked hints during practice.

### A boundary example — when this technique cannot decide yet

```board
O N N
?A O2 ?B
N N N
```

One orange is known. Exactly one of A/B must be orange, but this single clue cannot tell
which one. There are two valid completions. The correct explanation is “we need another
clue,” not a guess. This is a deliberate teaching counterexample, **not** an acceptable
standalone generated board for a completion lesson. Never animate one of the two as the answer.

## 18. Animation and presentation contract

Animation is part of the future skill specification, not work to start during this planning
request. Each lesson's exact purpose is described in §17. Reuse `kit/motion.ts`, `SPRING`,
`useMotionOK` and existing shared transitions; do not introduce custom physics per lesson.

### The rule the rest of this section follows

**Motion carries information or it does not happen.**

Every animation below answers one question: *what did the learner just learn that they did not
know a moment ago?* If a movement has no answer to that, it is decoration and it is cut. This
is the standard the benchmark games meet — Minesweeper's flood-fill is the clearest example in
the genre: the cascade is not a flourish, it is the game showing you every square that zero
just proved safe, in the order the proof runs. Nothing in Koda's board should move for any
weaker reason.

Three consequences, applied throughout:

1. **One motion, one meaning.** A given movement means the same thing in every lesson. A
   dashed outline is always "evidence I am pointing at", never also "a region clue's border" —
   the region border is solid-thin, precisely so those two never collide.
2. **The learner moves first.** No teaching sequence plays before a hint is requested or an
   answer is checked. Motion that arrives unasked reveals the board's structure and takes the
   deduction away from the child.
3. **Motion is never the only carrier.** Everything a sequence shows is simultaneously present
   as text, symbol or outline style, because reduced motion, screen readers and a printed
   worksheet all have to convey the same evidence.

### Benchmark — what other puzzles do with motion, and our decision

| Source | Observed behaviour | Decision here |
|---|---|---|
| Minesweeper flood-fill | Zero cascades open outward, showing the extent of the proof | Adopt the principle, not the cascade: level 6–7 hint outlines the whole neighbourhood zero excludes, in one gesture |
| Minesweeper loss state | Board reveals every mine; the run is over | Reject entirely. A wrong answer never reveals the board and never ends anything (§7) |
| Hexcells clue highlight | Hovering a clue lights exactly the cells it governs | Adopt as the requested-hint form for line, region and run clues — the clue's own cells light, nothing else |
| Hexcells / Tametsi mistake feedback | Immediate, quiet, and the board stays as it is | Adopt. Shared correction message plus an error icon; no shake, no red flash, no life lost |
| Tametsi region clue | The region's border is drawn permanently, as part of the board | Adopt. A region outline is board furniture, always visible, not a hint overlay |
| Puzzle-hint design literature | Progressive hints that narrow the field without giving the answer | Adopt as the three-step hint ladder in §7; motion escalates with it and stops short of the answer |

### Shared motion vocabulary

Two things move on this board: **the learner's own actions**, which respond immediately, and
**requested evidence**, which appears only after a hint or a check.

**Learner actions — always available, 120–200ms, never blocking**

| Event | Visible behaviour | Boundary |
|---|---|---|
| Board enters | One brief fade for the complete board; colours, clues, symbols and region outlines together | No stagger that spotlights answer cells or delays the first meaningful action |
| Palette selection | Selection outline and pressed state move to the chosen colour | Colour name and permanent symbol stay visible; never hue alone |
| Paint a tile | Short fill transition to the selected colour, symbol updated in the same frame | Accept the next input immediately; never wait for the animation |
| Erase / undo | The same transition, reversed | Restore state exactly; award nothing, record nothing |
| Select evidence (engine C) | Focus outline on the chosen clue or neighbour | Describes selection, not correctness; keyboard focus stays visible |
| Next question / replay | Old board replaced cleanly; every transient overlay cleared | No leftover highlight, candidate mark or outline from the previous puzzle |

**Requested evidence — only after a hint request or a check, up to 800ms, always skippable**

| Hint | Visible behaviour | Boundary |
|---|---|---|
| Counting (levels 1–8) | Counted positions outline in sequence, with a running tally | Marked assisted through the kit |
| Complement (5, 17) | Neighbourhood size shown as a bar; the clue's share fills; the remainder is labelled with the other colour | Both numbers stay on screen together — the point is the pair |
| Overlap / reduction (13, 14) | Shared cells solid outline, unshared dashed, each labelled in text | Never hue alone; never remove cells from the board |
| Pattern (15, 16) | The reduction runs clue by clue along the wall, one step per tap | Must show it as repeated subtraction, not as a memorised shape lighting up at once |
| Candidate exclusion (23–25) | Cross out one excluded symbol, other candidates preserved | A first exclusion in a three-colour puzzle must leave two candidates |
| Board total (18, 25) | Header total, painted count and remainder shown as one line of arithmetic | Per-colour totals stay separate; never sum across colours |
| Line / region (19, 20, 26) | The clue's own cells light; the rest of the board dims slightly | Dim, never hide — a hidden cell changes the puzzle |
| Run `{n}` / `-n-` (21, 22) | Possible placements of the run slide along the line, one per tap | Show possibilities, never the single true placement |
| Wrong checked answer | Shared correction message and an error icon | No shake, flash, life loss or automatic reveal |
| Correct checked answer | Koda's existing success feedback and completion transition | No custom score sequence; the kit advances and awards XP |

**Timing:** learner-action feedback finishes in roughly 120–200ms; a requested sequence takes up
to about 800ms and must be skippable or instantly revealable. These are review targets, not new
hard-coded spring constants. Shared round feedback timing belongs to the kit. Animation
completion is never required for correctness.

### Teaching versus practice

Teaching may animate a deduction only after the learner asks for the relevant hint or after an
answer is checked. Before that, animation can reflect the learner's own actions and explain
controls, but it cannot identify matching cells, eliminate candidates or paint the solution.
Practice has only immediate input feedback and ordinary checked-answer feedback. It does not
trace clues, count matches, preview candidates, or replay a worked solution during the round.

### Reduced motion, mobile and offline

Reduced motion is not a degraded mode. Each sequence above has a named static equivalent that
carries the same information, and the table in §14 requires both forms to be tested:

- Sequences become numbered static steps; state changes apply immediately.
- The same evidence stays in text, symbols and outline style; turning motion off must not change the puzzle or its answer.
- 44px or larger touch targets, upright board, movement inside the apparatus, no layout shift or page-width change.
- No looping effects, flashes, parallax or decorative floating tiles during play. The learner's place and keyboard focus are preserved.
- Pending sequences pause or cancel on question change, replay, exit and unmount; StrictMode double-mount covered.
- Bundled SVG/CSS/React only. No downloaded animation asset, voice clip or network call.

### Motion acceptance evidence by phase

| Phase | Evidence required before closing the phase |
|---|---|
| 0 | Agree the vocabulary, reduced-motion behaviour, timing targets and palette; identify which existing kit helpers to reuse |
| 1 | NeighborLens selections stay responsive; help sequences are explicitly requested; all four modes work with reduced motion |
| 2 | Painting, erase and undo stay accurate under rapid repeated input; no animation locks; no fixed clue changes |
| 3 | Remaining-match and chain hints refer to the current board, not a stale snapshot |
| 4 | Overlap and pattern hints show reduction step by step; three-colour hints preserve every candidate |
| 5 | Each new clue kind renders distinctly and dims rather than hides; run hints show possibilities, never the answer |
| 6 | Selecting evidence does not highlight a correct reason before submission; valid alternative reasons receive equal feedback |
| 7 | Every practice lesson contains no instructional animation, including after retries or resume |
| 8 | Every lesson has the example, mistake, hint direction and motion specification in §17; printable output contains no interaction-dependent information |
| 9 | Real-app 360px light/dark and reduced-motion passes; keyboard focus survives transitions; offline round works; exit cancels pending effects |
| 10 | Record actual motion/accessibility findings alongside lint, test and build evidence; do not infer a browser pass from unit tests |

### Coverage rule for implementation

The example for each of the 40 lessons is a minimum content fixture, not its whole question
bank. Generation must vary positions and colours while preserving the stated technique. A
lesson is incomplete if it has a title and board but lacks an appropriate question constraint,
worked example, wrong-answer behaviour, hint policy, motion specification, and practice coverage.
Examples with deliberately insufficient information must be clearly labelled and must never be
mixed into a full-board completion lesson's valid generated pool.
