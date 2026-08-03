# Component consolidation — 28 techniques down to a ladder each

**One component, one ladder of levels, the way Liquid Bottle Sort already works. Everything
that is a duplicate of that idea, or cannot carry a ladder, comes out first.**

> Assessed 2026-08-03 against the running database and the production build. Usage counts are
> real: authored questions in the studio deck, and questions inside published releases.

---

## 1. The principle this is measured against

Liquid Bottle Sort is the model: **one component, forty levels in a spec table, generated into
questions, verified before seeding**. A child meets one interaction and it deepens for forty
plays. That is what makes content dynamic without making the app heavier — the levels are data,
not code.

Measured against that, the studio today has the opposite shape: **28 components, most with one
or two hand-authored questions, several teaching the same thing at the same grain**. Every one
of them is a canvas chunk, a panel chunk, an AI schema, a picker entry, and a grader to keep
working.

So the target is not "fewer games". It is **fewer components, each with more levels**.

---

## 2. What is actually used

| Technique | In releases | In studio deck | Grader | Verdict |
|---|---|---|---|---|
| `LIQUID_SORT` | **410** | 41 | ✅ | **keep** — the model |
| `ADDITION_COLUMN` | 300 | 20 | ✅ | keep |
| `SUBTRACTION_COLUMN` | 292 | 6 | ✅ | keep |
| `MOVE_AND_COUNT` | 160 | 10 | ✅ | merge → Count |
| `SUBITIZE` | 156 | 11 | ✅ | keep |
| `GOODS_SORT` | 138 | 25 | ✅ | **keep** — live content |
| `GROUP_IN_TENS` | 130 | 11 | ✅ | keep |
| `COUNT_ON` | 130 | 11 | ✅ | merge → Count on/back |
| `ADDITION_COLUMN_MULTI` | 130 | 10 | ✅ | merge → `ADDITION_COLUMN` |
| `FLEXIBLE_CANVAS` | 17 | 13 | ✅ | keep — the fallback |
| `ONE_TO_ONE` | 10 | 0 | ✅ | merge → Count |
| `KODA_SUDOKU` | 6 | 1 | ✅ | park |
| `ADDITION_TUTOR` | 0 | 2 | ✅ | merge → Addition |
| `LINE_UP_AND_COUNT` | 0 | 1 | ✅ | merge → Count |
| `DIFFERENT_ARRANGEMENTS` | 0 | 1 | ✅ | merge → Subitize |
| `ADDITION_SANDBOX` | 0 | 1 | ✅ | merge → Addition |
| `SUBTRACTION_SANDBOX` | 0 | 1 | ✅ | merge → Subtraction |
| `MULTIPLICATION_ARRAY` | 0 | 1 | ✅ | park — not Grade 1 |
| `KODA_PATTERN` | 0 | 1 | ✅ | park |
| `COUNT_CRATES` | 0 | 1 | ✅ | merge → Count |
| `COUNT_BACK` | 0 | 0 | ✅ | merge → Count on/back |
| `COUNT_MAGNETS` | 0 | 0 | ✅ | merge → Count |
| `SUBTRACTION_COLUMN_MULTI` | 0 | 0 | ✅ | merge → `SUBTRACTION_COLUMN` |
| `MULTIPLICATION_COLUMN` | 0 | 0 | ✅ | park — not Grade 1 |
| `NUMBER_PATH` | 0 | 0 | ❌ | keep — needs a grader |
| `PLACE_VALUE_LAB` | 0 | 0 | ❌ | keep — needs a grader |
| `STORY_PROBLEM_MAT` | 0 | 0 | ❌ | keep — needs a grader |
| `HARVEST_SORT` | **0** | **0** | ❌ | **delete** |

**Delete outright: `HARVEST_SORT`.** Zero questions anywhere, no server grader (so nothing
authored on it could be published), no reference outside its own files and two enum entries —
and at **116 kB it is the single largest canvas chunk in the build**, larger than Liquid Sort
and Addition combined. It is a third sorting game next to two that are live.

"Park" means: remove from the studio picker and drop the eager schema, keep the canvas file.
Multiplication and sudoku are real content for later grades; they are just not Grade 1, and a
picker with 28 entries is its own tax on whoever authors.

---

## 3. The merges, and why they are merges rather than deletions

Nine components teach *count these objects* with different staging:

```
ONE_TO_ONE  MOVE_AND_COUNT  LINE_UP_AND_COUNT  DIFFERENT_ARRANGEMENTS
COUNT_MAGNETS  COUNT_CRATES  SUBITIZE  COUNT_ON  COUNT_BACK
```

Under the ladder model these are not nine components. They are **levels of two or three**:

| Component | Absorbs | Ladder runs from |
|---|---|---|
| **Count** | one-to-one, move & count, line up, magnets, crates | tap 3 in a row → arrange 12 scattered → move between containers |
| **Count on / back** | count on, count back | on from 5 → on from 47 → back from 20 |
| **Subitize** | subitize, arrangements | flash 3 → flash 8 in a ten-frame → compare two arrangements |
| **Addition** | sandbox, tutor, column, column-multi | join two groups → tutor with regrouping → column, 2 then 3 addends |
| **Subtraction** | sandbox, column, column-multi | take away → column → column with borrowing |

The staging that used to be a separate component becomes a **level parameter** — which is
exactly what `liquidSortLevels.ts` does with bottle count, colour count and hidden layers.

**Nothing is thrown away.** A merge keeps the canvas that renders best and folds the others'
distinct behaviour into level config. That is a real code change per family, not a rename, and
it is why this is sequenced before Phase 2 rather than during it.

### Released content pins two of them

`MOVE_AND_COUNT` (160), `COUNT_ON` (130) and `ONE_TO_ONE` (10) are inside published, immutable
releases that learners are assigned to. **Their technique ids must keep resolving forever** —
a merge changes what the studio offers, never what an old release means. Keep the enum entries
and their graders; retire them from the picker only.

---

## 4. The bug: questions growing on every component click

**Not reproduced yet, and the obvious suspect is ruled out.** Driving the real studio: opened
Interactive Studio with the 16-card default deck, opened the Components tab, clicked the same
component three times. The deck stayed at **16 of 16 cards** after every click, in the UI and in
storage. `updateActiveQuestion` maps over the deck and replaces the active card; it never
appends.

So the growth comes from a different path. The candidates worth instrumenting, in order:

1. **`addNewQuestion` via `onAddQuestion`** — the "Add card" button *is* meant to append. If a
   component tile is wired to it anywhere (the AI drawer, the skill deck panel, the add-question
   drawer), each visit adds a card by design and reads as a bug.
2. **`useQuestionDeck` hydration** — the effect depends on `defaultQuestions`; if that array is
   ever rebuilt per render rather than being a module constant, the effect re-runs and can
   re-save. Worth pinning with a test regardless.
3. **A second studio surface** — Curriculum Studio's add-question drawer appends per click too.

**Needed to finish this:** which screen, and which click. One sentence settles it.

---

## 5. Sequence

| # | Work | Done when |
|---|---|---|
| 1 | Reproduce and fix the growing deck | A named repro is a failing test, then passes |
| 2 | Delete `HARVEST_SORT`; park sudoku, pattern, multiplication ×2 | Picker shows ~22; build drops ~116 kB+ |
| 3 | Graders for `NUMBER_PATH`, `PLACE_VALUE_LAB`, `STORY_PROBLEM_MAT` | `supported_techniques()` covers every picker entry |
| 4 | Merge the counting family → Count, Count on/back, Subitize | Picker shows ~12; old ids still resolve in released content |
| 5 | Merge the arithmetic family → Addition, Subtraction | Same |
| 6 | A level spec table per surviving component | Each component has ≥10 levels generated and verified, as Liquid Sort does |

Step 6 is where this rejoins the MVP plan: once a component owns a ladder, Grade 1 Maths units
are assembled from ladders instead of hand-authored one-offs.

---

## 6. What this does not do

- It does not touch Liquid Sort or Goods Sort. They are the model and they are live.
- It does not delete anything referenced by a published release. Immutability means an old
  release must keep playing exactly as it was published.
- It does not add the four missing Grade 1 canvases (measurement, time, data, shapes). Those are
  a build queue, not a cleanup.
