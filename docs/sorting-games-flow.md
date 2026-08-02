# Sorting games — the flow from a tap to a mastery level

**Concretely: what a child does, what each thing they touch is called in the curriculum
model, and what has to be true for a new sorting game or a new level to reach them.**

The two games in Grade 1 *Thinking & Logic* are Liquid Bottle Sort and Goods Shelf Sort.
This document is about the flow they share. It assumes [`curriculum-model.md`](curriculum-model.md)
(the five records) and [`progression-design.md`](progression-design.md) (frontier, mastery,
recommendation) and does not restate them.

---

## 1. One picture

```
 a level in the canvas   →  a question   →  a skill  →  a unit  →  a subject
 goodsSortLevels.ts         QuestionDeck    45 of      2 of        grade-1-thinking-logic
 level_7                    q-goods-…       these      these
                                 │
                                 └── released (immutable) ── assigned to a learner ── played
                                                                                        │
                              server grades the submitted board ── mastery ── frontier ──┘
```

**One level is one skill is one question.** These games are one board per play: there is no
second question to draw, so a skill with `minQuestions: 1` and a single question is the
honest shape. Everything else in the model follows from that.

---

## 2. What a child actually does

| # | What they see | What the system does |
|---|---|---|
| 1 | Signs in, lands on Home | `GET /learning/today` returns up to 3 recommended skills |
| 2 | A card: *"First Delivery — tap a compartment to pick up its front item"* | the skill's `presentation.title` and the level's `teaches` line |
| 3 | The shelf, with a goal rail above it: `0/2 sorted · 🥤1/3 · 🍟1/3` | nothing yet — the rail is computed from the board |
| 4 | Taps an item; it lifts and names itself (**Potato Chips**) | local state; matching and empty compartments light up |
| 5 | Taps a destination; item moves | `moveCount` climbs. A tap on a full compartment buzzes and is **not** logged as a wrong answer |
| 6 | Stalls for 15s → the best move lights up with a flight arc | the hint solver, unasked. Not logged as a hint request |
| 7 | Taps **Hint** deliberately | same solver, and this *is* logged (`hint_requested`) |
| 8 | Last item lands; confetti | canvas sends `onAttempt("correct", { selected: <the shelf> })` |
| 9 | — | server re-grades the submitted board against the release's private key, then mastery and the frontier move |
| 10 | Next card | the next `order` in the subject, which is the other game |

Step 8 is the one worth staring at. The client submits **the board**, never "I won". The
server checks the shelf still holds exactly the goods the level started with and that each
kind sits alone in one compartment. A client claiming success proves nothing.

---

## 3. The ladder, and why the two games alternate

Each game has 5 tiers. Within a tier the two games **alternate** (`_interleave_ladders` in
the seed), so the subject reads:

```
order 1  Goods · First Delivery      beginner    2 kinds, 4 spare
order 2  Liquid · First Pour         beginner    2 colours, 3 bottles
order 3  Goods · Three Aisles        beginner    3 kinds, 6 spare
order 4  Liquid · Dual Swap          beginner    …
…
order 56 Liquid · Sunset Tower         grandmaster 11 bottles, 8-slot tower
```

The goods ladder stops at *master* and liquid carries on into *grandmaster*, so the last
few rungs are liquid alone. That is the shape of §3.1, not an oversight.

Two reasons, and the first is a bug this fixed. Appending one ladder after the other made a
learner finish the **grandmaster liquid tower board — the hardest thing in the
subject — before being shown the two-kind goods shelf that is its gentlest.** The frontier
walks `order`, so `order` has to express difficulty across the whole subject rather than
within one game.

The second is pedagogical. The games teach the same planning from opposite directions:

|  | Liquid Bottle Sort | Goods Shelf Sort |
|---|---|---|
| Constraint | *where* a colour may be poured (onto its own colour, or an empty bottle) | none — anything may go anywhere there is room |
| Scarcity | pour targets | **space**: spare compartments are the difficulty dial |
| The lesson | read a chain of pours before starting | protect free space; finish what you start |

A child who can finish both ladders has learned to sort. A child who can finish one may
have memorised one game's trick.

### 3.1 What Grade 1 gets, and why it is not the whole ladder

Thirty goods levels exist; **twenty-one are seeded for Grade 1.** The cut is measured, not
felt — a board is Grade 1 material when it fits inside the liquid ladder's envelope:

```
items ≤ 40   and   compartments ≤ 12          (GRADE1_MAX_ITEMS / GRADE1_MAX_SHELVES)
```

| | Liquid, hardest board | Goods, hardest board | Goods, hardest at Grade 1 |
|---|---|---|---|
| containers | 11 bottles | 20 compartments | 12 compartments |
| objects | 36 units | 72 items | 40 items |
| moves to finish | ~39 | 200+ | ~21 floor |

Liquid's hardest board is the most this subject asks of a Grade 1 learner anywhere. The
goods ladder runs a long way past it — more than twice the objects, drawn at about 20px
each on a 4×5 grid, over a solve several times longer. Interleaving two ladders by tier
only aligns them if the tiers mean comparable things, and above 40 items they stop doing so.

The nine excluded boards are **not deleted**. They keep their ids, stay playable in the
studio and the preview, and a Grade 2/3 subject seeds them unchanged by raising those two
numbers. `load_goods_levels` prints each one it holds back, with the reason.

### What each tier is for

| Tier | Goods Sort | Liquid Sort | The rung |
|---|---|---|---|
| beginner | 2–5 kinds, 3-slot, ≥3 spare | 2–3 colours, spare bottle | learn the move |
| apprentice | 5–8 kinds, 2–3 spare | more colours | keep a compartment clear |
| advanced | 8–13 kinds, 1–2 spare | 5–6 bottles | plan several moves ahead |
| master | 4-slot compartments | 7–8 bottles | the same skills, longer sets |
| grandmaster | *(beyond Grade 1 — held back)* | 10–11 bottles, hidden layers and tower | everything at once |

Every level carries a one-line `teaches` string. It is the **coach line shown while they
play**, not the question's instruction: the instruction says what to do ("Move the goods
between compartments until each compartment holds just one kind"), because a six-year-old
opening an activity needs the goal, not advice on it. `estimatedMinutes` is sized from each
board's own move floor rather than a flat per-tier number.

---

## 4. Guidance, and what each piece is there to do

| Affordance | Exists because |
|---|---|
| **Goal rail** (`3/8 sorted`, `🍩 2/4`, ✓ when gathered) | the goal was invisible. Chips are ordered closest-to-done, so the rail *is* the advice: finish the donuts, they're one away |
| **Name on pick-up** | at 20px a gem and a ring read alike; and it teaches the word alongside the sort |
| **Drop-target highlights** | green = a compartment already holding this kind, dashed = empty. Shows the two kinds of move before committing |
| **Hint** | four tiers: finish a set → follow the cached plan → search a new plan → strategy move. It never suggests the reverse of its last move, so repeated taps teach a sequence rather than a twitch |
| **Idle nudge (15s)** | a six-year-old who is stuck does not go looking for a Hint button — they stop. Not logged as a hint request: they did not ask |
| **Undo** | makes planning safe to try. Takes the move counter back with it |
| **Shuffle** | re-deals with random *legal* moves, so it can never strand a child, and it goes on the undo stack |
| **A full compartment buzzes but is not "wrong"** | exploring a board is play. Logging it as a wrong answer sank the mastery score of anyone who explored |

Two invariants behind all of it:

1. **No board is ever unsolvable.** Levels are built from the finished shelf and scrambled
   with legal moves, every move is reversible, so a solution always exists — and *a child
   cannot make the board unwinnable by playing badly* either.
2. **The board is never frozen.** The set-complete flourish plays over whatever the child
   does next.

---

## 5. Placement, frontier and mastery

Nothing here is game-specific — see [`progression-design.md`](progression-design.md) §13 —
but two decisions are, and both are easy to get wrong:

**Each ladder's opening board is a `placementCheckpoint`, and nothing else is.** A quiz
therefore samples both games. Because both checkpoints sit at `order` 1 and 2, passing one
can only mark the other's opener eligible. An earlier version put a checkpoint on each tier,
and placement wrote eligibility deep in the ladder and skipped a learner past most of it.

**No `prerequisiteSkillIds`, anywhere.** The recommendation engine counts a prerequisite as
met only once the earlier skill reaches *developing* — score ≥ 0.6 over at least 6 plays. A
level here is a single puzzle, so a chain would mean replaying one board six times before
the next could be offered. In practice nothing qualified as `new`, the engine fell through
to its stretch fallback, and that serves the *last* skill — handing a Grade 1 learner the
grandmaster tower board straight after level 1. Order is carried by the frontier
instead: it advances past any skill with mastery, so finishing level N makes N+1 the next
`new` item.

**Mastery from a one-board skill is thin by construction.** One play is one attempt, so a
skill reaches *developing* only through replays. That is a real limit of one-board-per-skill,
not a bug — but it means these subjects lean on the frontier for sequencing far more than on
proficiency levels.

---

## 6. Adding a level, or a whole new sorting game

The levels live in TypeScript because the canvas builds and renders them; the seed needs the
same data to author skills and grading keys. Copying them into Python by hand drifts the
first time a level is edited, so the JSON is generated.

**A new level:**

1. Add a spec to `LEVEL_SPECS` in `goodsSortLevels.ts` (or the liquid equivalent).
2. `npm run test:unit` — the level must be solvable, unfinished at the start, correctly
   balanced, and must not step backwards inside its tier.
3. `npm run export:goods-sort-levels` — regenerates `backend/scripts/data/…json`, replaying
   every board with the solver and marking any it cannot finish. **Commit the JSON.**
4. Re-run the seed. Unsolvable levels are skipped with a printed reason rather than seeded.

**A new sorting game** additionally needs:

| Step | Where | Why |
|---|---|---|
| A technique enum + registration | `types.ts`, `techniques/*.tsx` | picker, canvas, panel, AI schema |
| A **server-side grader** | `grading.py` | `validate_gradeable` refuses to publish a question no grader covers — an ungraded activity can never be completed |
| Its answer key in `GRADING_KEY_FIELDS` | `release.py` | otherwise the key ships to the client inside the playable snapshot |
| A taxonomy row | `logSchema.ts` | subject area + skill tags for reporting |
| An export script + seed unit | `frontend/scripts/`, `backend/scripts/` | one skill per level, interleaved into the subject by tier |

The grader is the step that looks optional and is not. Without it the child finishes the
board, the attempt is stored unverified, progression and XP both skip unverified events, and
they are told their work could not be saved.

---

## 7. Reviewing it without signing in

`/?preview=goods-sort` renders the real canvas with all thirty levels and prev/next;
`&level=30` jumps to a rung. Development-only — `import.meta.env.DEV` is statically false in
a production build, so the branch and the module are dropped rather than hidden.

---

## 8. Known gaps

| Gap | Consequence |
|---|---|
| One question per skill | mastery needs replays to pass *developing*; the frontier does the sequencing |
| Drag-and-drop is verified only by hand | tap-to-move is covered by tests; the drag path is not |
| The shared canvas toolbar now shrinks and wraps | fixed buttons being unreachable on a narrow card, but `SharedCanvasLayout` is used by every canvas — worth a look at the others on a phone width |
| Levels are authored, not generated per learner | two children on the same rung play the identical board; good for support, but it can be shared |
| Goods stops at *master* for Grade 1 | the top of the subject is liquid-only; a Grade 2/3 subject is where the remaining nine boards belong |
