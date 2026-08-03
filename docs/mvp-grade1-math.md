# MVP — Grade 1 Mathematics, and the shape every subject after it copies

**One subject taken all the way to a child, built so subject two is a clone rather than a
rewrite.**

> Assessed 2026-08-03 against the running stack. Counts below were read from the database and
> the technique manifests, not from intentions.

---

## 1. Why Grade 1 Maths, and what is actually there today

| Curriculum | Units | Skills | Questions | State |
|---|---|---|---|---|
| Grade 1 Thinking & Logic | 2 | **61** | 61 | live, release 18, server-graded |
| **Grade 1 Mathematics** | **11** | **30** | **0** | **archived** |
| Koda Primary Mathematics | 2 | 3 | 0 | draft |
| Grade 1/2/3 Science | 4 each | 4 each | — | pilots |

Grade 1 Maths is the right MVP subject because the expensive half is already done. Its 11 units
and 30 skills are authored and standards-shaped — *Make a ten from ten ones*, *Find the unknown
number*, *Find 10 more or 10 less*. Nobody has to design the curriculum. It has zero questions,
which is the only reason it is archived.

## 2. The lesson the two curricula already teach

Thinking & Logic has 61 live skills. Maths has 30 archived ones. The difference is not effort or
importance — it is **how the content was made**.

```
Thinking & Logic   liquidSortLevels.ts  ──export──▶  liquid_sort_levels.json  ──seed──▶  61 skills live
Grade 1 Maths      authored by hand in the studio, one question at a time  ──────────▶  0 questions
```

Thirty skills at five questions each is 150 questions authored one at a time. That is where
Grade 1 Maths stopped, and it will stop there again unless the content is **generated from a
spec table** the way the sorting ladders are. `plan.md` §A3 says the same thing from the other
direction: authoring does not scale by hand.

**So the MVP is not "author Grade 1 Maths." It is "make Grade 1 Maths generated."**

---

## 3. Scope — 7 units, 21 skills, zero new canvases

Every skill below is playable with a technique that already exists and is already registered.

| Unit | Skills | Techniques that already play it |
|---|---|---|
| Counting & Number Sense to 120 | 3 | `oneToOne`, `countOn`, `subitize`, `arrangements`, `numberPath`, `lineUp`, `countCrates` |
| Addition & Subtraction Stories | 4 | `storyProblemMat` |
| How Addition & Subtraction Work | 2 | `additionTutor`, `flexibleCanvas` |
| Addition & Subtraction Within 20 | 3 | `addition`, `subtraction`, `moveAndCount`, `magnets` |
| Equations & Unknowns | 2 | `flexibleCanvas`, `additionTutor` |
| Tens, Ones & Two-Digit Numbers | 4 | `groupTens`, `placeValueLab`, `magnets` |
| Add & Subtract with Place Value | 3 | `columnAddition`, `columnSubtraction`, `placeValueLab` |
| **MVP total** | **21** | |

**Deliberately out of MVP** — these four units have no technique, and inventing four canvases is
a different project from shipping a subject:

| Unit | Skills | Needs |
|---|---|---|
| Length & Measurement | 2 | a comparison/ruler canvas |
| Time to the Hour & Half-Hour | 2 | a clock canvas |
| Organize & Interpret Data | 2 | a chart/tally canvas |
| Shapes & Equal Shares | 3 | a shape composition + partition canvas |

They stay in the tree, unpublished, as the backlog that tells the studio what to build next.
Twenty-one skills at three activities a session is roughly a term of work for a six-year-old —
enough to learn whether the loop holds.

---

## 4. How the content gets made

Copy the pattern that already works, once per technique family.

```
mathSpecs.ts                     one row per skill: technique, number ranges, item counts,
   │                             how many questions, difficulty ramp
   ├─ npm run export:math-questions   ──▶  backend/scripts/data/grade1_math_questions.json
   │                                       (generated, committed, verified)
   └─ python -m scripts.seed_grade1_math  ──▶  units + skills + questions + release + offering
```

Three properties this buys, all of which the sorting ladders already demonstrate:

- **A skill edit can never leave the seed describing a puzzle that no longer exists** — the JSON
  is generated from the same table the canvas reads.
- **Every generated question is verified before it ships.** `exportLiquidSortLevels.ts` plays
  each board with the solver and refuses to seed the unsolvable ones. Maths needs the equivalent:
  an answer key computed by the generator, and a check that the question is well-formed for its
  canvas (no negative results in a Grade 1 subtraction, no sums past the unit's ceiling).
- **Regeneration is safe.** Re-running the seed upserts and cuts a new release only when content
  actually changed.

**Done when:** `seed_grade1_math` produces 21 skills with ≥5 questions each, every question
carries a generator-computed answer key, and the release is server-graded.

### Server grading is mostly already there

`content/grading.py` registers graders by *family*, not by canvas, and the maths families are
already covered: `COUNTING` (9 techniques — one-to-one, move-and-count, line-up, group-in-tens,
count-on, count-back, arrangements, magnets, subitize) and `ARITHMETIC` (9 — the addition,
subtraction and multiplication sandboxes and columns), plus `FLEXIBLE_CANVAS`, `KODA_PATTERN`,
`COUNT_CRATES`, `LIQUID_SORT` and `GOODS_SORT`.

**✱ Three MVP techniques have no grader:** `NUMBER_PATH`, `STORY_PROBLEM_MAT` and
`PLACE_VALUE_LAB`. A skill authored on those trusts the client for correctness.

**Grow it:** register them. Number path and place-value lab are numeric answers and should fold
into the existing `ARITHMETIC` shape; story problem mat needs its own, because the answer is a
composed number sentence rather than a value.

**Done when:** `supported_techniques()` covers every technique the 21 MVP skills use, and the
seed reports `notGraded: []` — the same check `seed_grade1_thinking_logic` already prints.

---

## 5. What the engine needs for the MVP

Small list. The recommendation engine, mastery ladder, releases and XP already work.

| # | Change | Why it is in the MVP |
|---|---|---|
| 1 | **`conceptId` on skills** | A stable cross-curriculum id (`number.place-value.make-a-ten`). Without it, Grade 2 cannot review Grade 1 material and every grade is an island. Cheap now, painful after 60 curricula are published. |
| 2 | **Draft-vs-release drift warning** | Already cost a day's confusion (a level table at 40, a release at 24, nothing said so). `plan.md` §A1. |
| 3 | **Graders for `NUMBER_PATH`, `STORY_PROBLEM_MAT`, `PLACE_VALUE_LAB`** | Every other MVP technique is already graded server-side; these three are the gap. |
| 4 | **Daily goal** | The retention loop. Everything else about motivation is decoration on top of it. |

Everything else on the wishlist — bulk assignment, classroom fan-out, grade rollover — is
**operations**, and one subject for a handful of families does not need it yet. It becomes
blocking the moment a second grade exists.

---

## 6. XP and motivation for the MVP

Keep the economy exactly as it is: 4 correct / +2 first-try / 12 completion / 120 per level,
replayed from events rather than stored. It reconciles against live data and it can be retuned
retroactively.

Add one thing, and only one: **a daily goal the child commits to and can close.**

```
Today          ●●●○○     3 of 5 activities        streak 4 days
```

Three notes on the economy as subjects multiply:

- **Make levels per subject, not global.** "Level 12 in Maths" stays meaningful across twelve
  years; one global number does not, and it silently rewards whichever subject has more skills.
- **Scale XP by difficulty tier, not by grade.** The tiers already exist on questions.
- **No hearts, no leagues.** Hearts monetise failure and leagues aim competitive pressure at
  six-year-olds. Streak *protection* — badges already use the longest streak, not the current
  one — is the humane version of the same pull.

---

## 7. UI for the MVP

The `kid` band already exists and is where a Grade 1 learner lands. Two additions:

- **Unit checkpoints.** Seven units is seven moments worth celebrating; the boundaries are
  already in the tree and are currently invisible. This is the strongest motivational beat the
  product does not yet have.
- **A unit-level map** rather than a flat A→Z list. Twenty-one skills is where a flat path stops
  being readable, and the shape has to survive the 30-skill version.

Not in the MVP: the teen band, leaderboards, an avatar economy.

---

## 8. What makes subject two a clone

The MVP is finished when adding Grade 1 Reading is a copy of five things, not a redesign:

1. A spec table for its skills.
2. An export script that verifies and emits JSON.
3. A seed module built from the same helpers as `seed_grade1_thinking_logic`.
4. Techniques that already exist, or a note in the backlog saying which are missing.
5. Graders reused from `content/grading.py` — a new subject should add techniques, not grading
   concepts.

If any of those five turns out to need bespoke work, that is the thing to generalise before
starting subject three.

---

## 9. Phases

| Phase | Work | Done when |
|---|---|---|
| 1 | `conceptId` on the skill schema; drift warning in Curriculum Health | Editing a published curriculum without republishing warns, naming what drifted |
| 2 | `mathSpecs.ts` + export for the 4 counting/number-sense skills of unit 1 | 4 skills, ≥5 verified questions each, seeded, playable end to end by a real learner |
| 3 | The other 6 units in scope (17 skills) | 21 skills live in one release, offering points at it |
| 4 | Graders for the three ungraded techniques | The seed prints `notGraded: []` for Grade 1 Maths |
| 5 | Daily goal + unit checkpoints | A child can see today's goal, close it, and cross a unit boundary with a moment |

Phase 2 is deliberately one unit. It answers "does the generator produce questions a
six-year-old can actually play?" before 17 more skills are built on the answer.

---

## 10. What this plan does not do

- It does not build the four missing canvases. It names them so the studio has a queue.
- It does not add classrooms, bulk assignment or grade rollover — operations for a second grade,
  not for a first subject.
- It does not touch the recommendation engine. It is already the most finished part of the
  system, and one subject will not stress it.
