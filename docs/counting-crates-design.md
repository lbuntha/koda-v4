# Counting Crates — design for a counting game with a state space

**Proposal, not built code.** What it is, why this one and not another, and the file-by-file
plan to ship it the way Liquid Sort and Goods Sort were shipped.

Assumes [`curriculum-model.md`](curriculum-model.md), [`progression-design.md`](progression-design.md)
and [`sorting-games-flow.md`](sorting-games-flow.md); it does not restate them.

---

## 1. The gap

Counting is the best-covered area in the app. Ten techniques already touch it:

| Existing | Teaches |
|---|---|
| `ONE_TO_ONE`, `MOVE_AND_COUNT`, `COUNT_MAGNETS` | one-to-one correspondence |
| `LINE_UP_AND_COUNT` | ordinal counting, sequencing |
| `SUBITIZE` | instant recognition |
| `DIFFERENT_ARRANGEMENTS` | conservation of number |
| `COUNT_ON`, `COUNT_BACK` | counting on and back from a start |
| `GROUP_IN_TENS`, `PLACE_VALUE_LAB` | tens and ones, build/read/regroup |
| `NUMBER_PATH` | count to 120, ten more / ten less |

So the gap is **not a missing counting topic**. Every one of those is a *task*: do the
thing, produce one answer, get marked. What none of them is — and what Liquid Sort and
Goods Sort are — is a **puzzle with a state space**: many legal moves, an end state the
server can verify, a solver that can hint, and a ladder that gets harder along a dial.

That shape is what makes those two replayable, and it is what gives us:

- **a hint that teaches a sequence**, not an answer;
- **levels that are solvable by construction**, so no child is ever stranded;
- **a difficulty ladder** with something real to turn;
- **an end state worth grading**, rather than a number that can be guessed in 10 tries.

Counting has no game of that kind. That is the gap worth filling.

---

## 2. The mechanic

**Counting Crates** — a market stall packing orders.

```
  ORDER: 23                            crates in stock
  ┌──────────────────────┐             ┌────┐ ┌────┐ ┌────┐
  │   [10] [10] [1][1][1]│             │ 10 │ │  5 │ │  1 │
  │        = 23  ✓       │             │ x3 │ │ x2 │ │ x9 │
  └──────────────────────┘             └────┘ └────┘ └────┘
        the packing tray                   drag from here
```

**Rules, all of them:**

1. Drag a crate from stock into the tray, or back out. That is the only move.
2. The tray shows a running total, always. Counting is the feedback loop, not the quiz.
3. The order is filled when the tray totals **exactly** the order.
4. Some levels add one constraint: *fewest crates*, *exactly N crates*, or *at least one
   crate must be opened*.
5. **Opening a crate** is a move too: a 10 becomes ten 1s, a 5 becomes five 1s. It cannot
   be undone — the same one-way door that makes regrouping mean something.

Everything a child needs to reason about is on screen, and every move is reversible except
the one that is deliberately not.

### Why this teaches counting rather than arithmetic

The temptation is to read `10 + 10 + 3` and call it addition. What the child actually does
is **unitize**: a crate of ten *is* ten, counted as one thing, and the running total goes
10 → 20 → 21 → 22 → 23. That is counting on from a group, which is the bridge between
counting by ones and place value — the exact skill `COUNT_ON`, `GROUP_IN_TENS` and
`PLACE_VALUE_LAB` each teach one static slice of.

The constraints are where it becomes a puzzle rather than a drill:

- *Fewest crates* forces the child to prefer the biggest unit that fits — the reasoning
  behind place value, arrived at rather than told.
- *Limited stock* forces decomposition: the order needs 23, only two tens are left, so a
  ten has to be opened. That is regrouping as a **decision**, not a worksheet step.
- *Exactly N crates* forces trading between representations: 23 in exactly 5 crates is
  10+10+1+1+1, and in exactly 6 is 10+5+5+1+1+1.

### Standards it maps to

| Standard | Where it shows up |
|---|---|
| K.CC.B.4c — each successive number is one more | ones-only tiers, the running total |
| K.CC.B.5 — count out a given number of objects | every level: the order *is* the count |
| 1.NBT.B.2a — ten is a bundle of ten ones | crates of ten, and opening one |
| 1.NBT.B.2 — two-digit numbers as tens and ones | *fewest crates* tiers |
| 1.NBT.C.4 — add within 100, compose a ten | mixed-unit orders above 20 |
| 2.NBT.A.1 — hundreds, tens, ones | the 100-crate tier |
| 2.NBT.B.5 — fluently add within 100 | the top tiers, under a crate-count constraint |

One mechanic, K through Grade 2, with the ladder doing the work — the same property that
lets the sorting games span a whole subject.

---

## 3. The ladder

Five tiers, one dial turned at a time, ~24 levels. The dials:

| Dial | Range |
|---|---|
| Unit sizes in stock | `{1}` → `{1,5}` → `{1,5,10}` → `{1,10,100}` |
| Order size | ≤ 10 → ≤ 20 → ≤ 50 → ≤ 120 |
| Stock | unlimited → limited (forces opening a crate) |
| Constraint | none → fewest crates → exactly N crates |
| Orders per board | 1 → 2 → 3 (stock shared between them) |

| Tier | Looks like | The rung |
|---|---|---|
| beginner | ones only, orders ≤ 10, unlimited stock | count out a number, one at a time |
| apprentice | fives and ones, orders ≤ 20 | count on from a group instead of from one |
| advanced | tens, fives, ones, orders ≤ 50, *fewest crates* | reach for the biggest unit that fits |
| master | limited stock, orders ≤ 100, opening required | decompose a ten because you need to |
| grandmaster | hundreds, 2–3 orders sharing one stock, exact crate counts | plan across orders |

**Every level is solvable by construction.** A level is authored by choosing the solution
first — a multiset of crates — and setting the order to its sum and the stock to a superset
of it. Solvability is then a property of how the level was made, exactly as with the
sorting games' reverse-scramble, and for the same reason: a child must never meet a board
that cannot be finished.

---

## 4. Guidance, carried over

Everything the Goods Sort work found the hard way applies here, and should be built in from
the first commit rather than retrofitted:

| Affordance | Why |
|---|---|
| **Running total, always visible** | the goal rail's lesson: an invisible goal makes trial and error the only strategy |
| **Name the crate you are holding** ("ten apples") | a "10" tile and a "1" tile look alike at 20px on a phone |
| **Over-filling is not a wrong answer** | it buzzes and shows `25 — two too many`; logging exploration as failure sank mastery scores in Goods Sort |
| **Hint, in tiers** | ① a crate that completes the order → ② the next crate of a known-good solution → ③ "open a ten" when stock forces it |
| **Idle nudge at 15s** | a stuck six-year-old stops; they do not go looking for a Hint button |
| **Undo, and it takes the counter back with it** | except opening a crate, which is the one deliberate one-way door |
| **`prefers-reduced-motion` honoured** | `PlaceValueLabCanvas` already does this and the sorting canvases do **not** — this one should ship correct rather than inherit the debt |

Accessibility, stated up front because retrofitting it is what goes wrong: 44px minimum
targets, never colour alone to distinguish a unit (the number is on the crate), the running
total announced via `aria-live`, and full keyboard operation — arrow keys to pick a crate,
Enter to load it — since drag is the one interaction we have never been able to test
automatically.

---

## 5. Technical plan

Same structure as every other technique. Nine files, in dependency order:

| # | File | What it holds |
|---|---|---|
| 1 | `src/types.ts` | `COUNT_CRATES = "COUNT_CRATES"` on `CountingTechnique` |
| 2 | `src/components/canvases/countCratesModel.ts` | **pure logic**: level specs, the by-construction builder, `isOrderFilled`, `crateTotal`, the hint solver. No React — so it is unit-testable under `tsx --test`, like `placeValueModel.ts` |
| 3 | `src/components/canvases/CountCratesCanvas.tsx` | the board: stock, tray, running total, drag + tap + keyboard |
| 4 | `src/components/studio/panels/CountCratesPanel.tsx` | authoring: unit sizes, order size, stock, constraint |
| 5 | `src/components/studio/ai-generator/schemas/countCrates.schema.ts` | AI generator schema |
| 6 | `src/techniques/countCrates.tsx` | one-file registration — label, icon, canvas, panel, schema |
| 7 | `src/services/logSchema.ts` | taxonomy row: `subjectArea: "counting"`, tags `unitizing`, `compose_decompose`, `count_on` |
| 8 | `backend/app/features/content/grading.py` | `grade_count_crates` |
| 9 | `frontend/scripts/exportCountCratesLevels.ts` + seed unit | levels → JSON → one skill per level |

### Grading: derived, not an answer key

`grading.py` already splits techniques into *answer-key* and *derived-answer*. This is
firmly the second kind — everything needed to grade is public:

```python
@register("COUNT_CRATES")
def grade_count_crates(entry, selection):
    """`selection` is the crates in the tray, e.g. [10, 10, 1, 1, 1]."""
    cfg = _config(entry)
    if sum(selection) != _to_int(cfg["orderTotal"]):
        return "incorrect"
    # constraint: none | fewest | exactly-N
    ...
```

So **no `GRADING_KEY_FIELDS` change** and no secret travelling with the release. A client
cannot fake a solve because the tray it submits is re-added server-side — and the sum of a
multiset is not something a wrong board accidentally satisfies.

### Tests, mirroring what Goods Sort now has

| Test | Proves |
|---|---|
| `countCratesModel.test.ts` | every level is solvable, orders are reachable from stock, the ladder ramps within a tier, the hint finishes every board without cycling |
| `CountCratesCanvas.test.tsx` | renders, a tap loads a crate, the total updates, filling reports the **tray** (not "I won"), over-filling is not logged as wrong |
| `test_grading.py` | sum, each constraint, malformed selections |
| `test_count_crates_end_to_end.py` | filled order → real `/events` → the XP a child is shown |
| `test_thinking_logic_seed.py` equivalent | the seeded subject's shape |

---

## 6. Where it goes in the curriculum

It is a counting game, so **not** Thinking & Logic. Its home is `grade-1-math` as its own
unit, and the same interleaving rule applies: `order` must express difficulty across the
whole subject, or a learner meets the 120-order board before the count-to-10 one.

The beginner tier (ones only, orders ≤ 10) is genuinely Kindergarten material and the
grandmaster tier is Grade 2 — so the honest placement is **one unit seeded per grade from
the same ladder**, filtered by an envelope the way Goods Sort now is for Grade 1:

| Grade | Tiers | Envelope |
|---|---|---|
| K | beginner | orders ≤ 10, ones only |
| 1 | apprentice + advanced | orders ≤ 50, units ≤ 10 |
| 2 | master + grandmaster | orders ≤ 120, hundreds, multi-order |

One authored ladder, three subjects, no duplicated content.

---

## 7. Build phases

| Phase | Deliverable | Rough size |
|---|---|---|
| 1 | `countCratesModel.ts` + its unit tests — rules, builder, solver, ladder | half a day |
| 2 | The canvas: stock, tray, total, tap + drag + keyboard, guidance | a day |
| 3 | Panel + AI schema + registration; playable in the studio | half a day |
| 4 | Grader + export + seed unit + end-to-end test | half a day |
| 5 | Browser pass at phone and desktop widths; reduced-motion check | a couple of hours |

Phase 1 is deliberately first and standalone: if the model, the solvability guarantee and
the solver are wrong, nothing built on top is worth reviewing. That ordering is what the
Goods Sort work would have benefited from.

---

## 8. What I need from you

1. **Is this the right game?** Two I considered and rejected: a *number line jump* puzzle
   (too close to `NUMBER_PATH`) and a *balance scale* (teaches equality, not counting, and
   the arithmetic canvases have equality covered).
2. **Name and theme.** "Counting Crates" at a market stall keeps it distinct from Goods
   Sort's warehouse, but the theme is one file's worth of art and copy either way.
3. **Grade spread** — the K/1/2 split above, or Grade 1 only to start?
4. **Keyboard support**: I have proposed it because drag is the one interaction neither the
   tests nor I can verify, and it is an accessibility win. It is also the largest single
   piece of Phase 2. Worth it?
