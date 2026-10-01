# Koda Trace — build plan

A tracing module for children: pre-writing lines, letters, numerals, words and drawings (a
cat, a house, a character), each broken into numbered strokes a child writes one at a
time, graded through **writing steps** until the app can say, with evidence, that the child
**can write** it. An admin makes each item in **Trace Studio** and publishes items into
collections.

References the author supplied (2026-09-30): a stroke editor (Adjust & Drag, Add Points,
Freehand Pen, Magic Snap, Auto-Connect, Bend Up/Down, Straighten, waypoints), a practice
screen (numbered badges, START ring, Watch Stroke Order, Check Accuracy with
Relaxed/Balanced/Strict), the MoEYS Grade 1 book as inspiration only (lines before letters; a 4×3
grid with numbered, arrowed strokes; "board → air → slate" procedure).

## The decision this plan rests on

**Koda Trace is its own module with its own Studio — separate from Library Studio and from
any course tool.** It owns items, strokes, the player, scoring and the *can write* record.
Other features (Library, Learn Khmer lessons, skills) **connect to it** through a small
contract (see *Connecting other features*) — they reference a published trace item by id
and get a result back. They never edit strokes or score ink themselves.

Three names: **Koda Trace** is the module; **Trace Studio** is the admin tool;
**the trace player** is the component a child writes in.

Rules carried over from Library:

- **A model drafts, a person decides.** AI proposes pictures, strokes and order; nothing
  reaches a child until an admin has shaped, test-written and published it.
- **No AI at practice time.** Capture, feedback and scoring run on the device — offline,
  free per child, deterministic.
- **Labels vs content.** Studio and player chrome come from i18n (`trace.*`,
  `traceStudio.*`); item titles, stroke instructions and collection names are content.

## Writing, drawing — and not reading

Koda Trace does **writing** and **drawing**. It does **not** teach **reading**. The
three are different skills with different rules, so they stay apart:

| | **Writing** (in Koda Trace) | **Drawing** (in Koda Trace) | **Reading** (not here) |
|---|---|---|---|
| What | letters, feet, vowels, shifters/signs, numbers, words | pre-writing lines and shapes, pictures (cat, house) | letter names and sounds, recognising letters, syllables, words, sentences |
| Item kinds | `letter`, `mark`, `numeral`, `word` | `line`, `drawing` | — |
| Stroke order | **strict** — a gate | loose — off by default | — |
| Direction | strict | strict for lines, loose for pictures | — |
| Last step | copy → **memory** (write it with no model) | **faded** (draw it with little help) | — |
| Earns | **can write** ✓ | **can draw** ✓ | *can read* — owned by Library / Learn Khmer |
| Extra modes | — | **Just draw** (free, unscored) | — |
| Learner shelf | **Write** | **Draw** | Library, Learn Khmer |

- Each item and each collection is one mode: `mode: "writing" | "drawing"`, set from its
  kind. Steps, gates, coach wording and the progress tick all follow the mode.
- **Reading stays outside.** Koda Trace never asks "which letter is this?" or "what sound
  does it make?". The only link is the memory step's prompt: by default the letter is
  **shown for 3 seconds, then hidden** (look, then write). If a connected feature
  supplies the letter's recorded name, it can be *heard* instead — the recording belongs
  to the reading side; Trace only plays it.
- A connected lesson (Learn Khmer) shows the two side by side for a letter — *can read*
  from its reading activities, *can write* from Trace — but neither decides the other.

## Where it lives

| Concern | Where |
|---|---|
| Code | `src/trace/` — `geometry/` (pure maths), `score/` (pure), `player/`, `studio/`, `data/` (API, offline store) |
| Learner page | `TabId` `"trace"` (collections, like Library shelves) — menu row in `menu_defaults.py` |
| Admin | `TabId` `"trace-studio"`, gated `content:write` |
| Server | `server/app/routers/trace.py`, `repos/trace.py` — items, collections, drafts, revisions, publish, reports |
| Pictures | existing image routes + photo store, with a *line-art* preset |
| AI stroke order | `server.ts` route beside `/api/tutor/analyze-drawing` |
| Vectorising | Web Worker in `src/trace/geometry/` |
| Learning record | `src/lib/learning` — trace error kinds, *can write* state |
| Offline | one collection = one downloadable unit (`offlineSkill.ts` pattern) |

---

## 1. Stroke design

### Coordinates

Everything is in a **normalised square, 0–1000 per axis**, y down. The player maps it to
the screen; the scorer never sees pixels. Tolerances are in the same units, so "12 units"
means the same on a phone and a laptop.

### The item

```ts
interface TraceItem {
  id: string; rev: number;
  title: string;                        // content: "ច", "7", "Loop", "Cat"
  kind: "line" | "drawing" | "letter" | "mark" | "numeral" | "word";
  mode: "writing" | "drawing";          // from kind; see "Writing, drawing — and not reading"
  script?: "khmer" | "latin";           // badge numerals, grid, stroke-order rules
  canvas: { aspect: number };           // 1 = square; words are wider
  grid: "none" | "3x3" | "4x3-moeys" | "baseline-4-lines" | "dots";
  guide: {                              // what sits faded underneath
    source: "font" | "picture" | "strokes";
    glyph?: { text: string; font: string };
    picture?: PictureRef;
  };
  strokes: Stroke[];                    // drawing order
  steps: StepPlan;                      // §3
  sensitivity: "relaxed" | "balanced" | "strict";
}
```

### The stroke

A stroke is **one pen-down motion**: a chain of cubic Béziers through nodes.

```ts
interface Stroke {
  id: string;
  order: number;                        // 1…n, drives the badge ១/1
  shape: "line" | "curve" | "hook" | "loop" | "dot" | "free";  // hint for feedback + defaults
  nodes: Node[];                        // ≥ 2 (a dot has 1 node and a radius)
  closed: boolean;                      // a loop: ends where it starts
  winding?: "cw" | "ccw";               // for closed strokes — which way round
  join: "lift" | "continue";            // pen up before this stroke, or carry on from the last
  width: number;                        // band width (default 60 units)
  checkpoints: Checkpoint[];            // §1.3, auto + pinned
  instruction?: string;                 // content, read aloud: "Start at the top, go down."
}

interface Node {
  x: number; y: number;
  type: "corner" | "smooth" | "symmetric";      // "blend"
  in?: { dx: number; dy: number };              // handles; none = straight segment
  out?: { dx: number; dy: number };
}

interface Checkpoint { t: number; pinned: boolean }   // t = 0–1 along the stroke's length
```

Why Béziers and not stored pixels: every tool edits nodes/handles, so strokes stay
editable, blendable, mirrorable and — the reason that matters most — **exactly measurable**
(length, tangent, nearest point, arc position) for scoring.

### 1.1 Stroke vocabulary

The book teaches letters as parts: straight, curve, hook, loop. The Studio has these as
**primitives** you drop in and adjust, and the player uses the `shape` to word feedback
("close the loop", "curl the hook"):

| Primitive | Made of | Scoring note |
|---|---|---|
| line | 2 corner nodes | direction = vector sign |
| curve / arc | 3 nodes, smooth | direction from arc position |
| hook | line + tight curve at the end | checkpoint pinned on the curl |
| loop | closed, 4 smooth nodes | winding cw/ccw checked; start point matters |
| dot | 1 node + radius | tap or short mark inside radius; no direction |
| zigzag / wave / spiral | generated node chains | for pre-writing items |

### 1.2 Joins between strokes

- `lift` — the child lifts the pen; the player shows the next START ring.
- `continue` — one motion across two strokes (a Khmer letter often flows on). Shown in
  Watch as the pen carrying on with a dotted **magic connector**; the scorer accepts it
  written as one ink stroke *or* two.

### 1.3 Checkpoints — the heart of "did they really draw it"

Distance alone lets a child pass a loop by drawing half of it, or a hook by drawing the
straight part. So every stroke has ordered **checkpoints** the ink must pass through **in
order**:

- auto-placed at start, end, every corner node, every point of maximum curvature, and at
  least every 20% of length;
- the admin can **pin** extra ones (the curl of a hook, the bottom of a loop) or remove
  auto ones, in the Studio;
- a checkpoint is *hit* when some ink point lies within the hit radius, and hits must be
  in increasing order along the ink.

### 1.4 Studio editor tools

**Modes:** Adjust & Drag (nodes, handles; drag a segment to bend) · Add Points (split a
segment / extend) · Freehand Pen (fitted to Béziers on release) · Primitives (line, arc,
hook, loop, dot, zigzag, wave) · **Pick from guide** (click edges of the vectorised outline;
they join into one stroke in click order) · Test.

**Magic toggles:** Magic Snap (to stroke ends, guide centre-line, grid, 0/45/90°) ·
Auto-Connect (next stroke starts at previous end, sets `join: continue`) · Grid Snap ·
Guide Follow (freehand pulled onto the centre-line) · Symmetry (mirror edits across an axis
while drawing a drawing).

**Per stroke:** Bend Up / Bend Down / Straighten · Blend per node (corner/smooth/symmetric)
and **Blend all** · Connect to Prev/Next · Reverse · Mirror · Duplicate · Simplify · Move
up/down in order · Width · Checkpoints (show, pin, remove) · Winding (loops) · Waypoints
with X/Y fields; arrows 1 unit, Shift 10.

**Always on:** undo/redo; start (green) and end (red) markers; badges in the item's
numerals; live checks panel.

### 1.5 AI tracing (a first draft of strokes)

1. **Vectorise, in the browser (deterministic):** threshold → thin to a skeleton → graph of
   edges at junctions/ends → simplify → fit Béziers. For a font glyph, from the rendered
   glyph; for a photo/book page, clean up first (contrast, crop, remove grid lines).
2. **Order and direction, by a vision model:** it gets the picture and the numbered
   candidate pieces, plus the rules (Khmer and Latin: common school handwriting order; drawings:
   outline first, then details, top→bottom, left→right). It returns JSON: strokes as lists
   of piece ids with directions. The server validates it (ids exist, none reused) and falls
   back to reading order. Re-running keeps strokes the admin locked.

---

## 2. Accuracy design — how ink is measured

All pure functions in `src/trace/score/`, unit-tested with recorded real traces.

### 2.1 Capture

- Pointer events with `getCoalescedEvents()` (smooth on fast phones), timestamps kept;
  pressure ignored in v1. Palm rejection: while a pen is down, ignore touches.
- Convert to 0–1000 units; drop points closer than 2 units; light smoothing (moving
  average of 3).
- **Scoring uses the raw ink.** Assist only changes what is *drawn* on screen (ink pulled
  toward the band), never what is measured.
- An ink stroke = pointer down → up. A lift shorter than 200 ms that restarts within 40
  units of where it stopped is merged (a wobble, not a new stroke).

### 2.2 Matching ink to target strokes

- **Guided steps (big, guided, faded):** the expected stroke is known; each ink stroke is
  compared to it. A `continue` pair may be written as one ink stroke — it is split at the
  arc position closest to the join.
- **Unguided steps (copy, memory):** first **fit** all the ink to the whole target: a
  similarity transform (move + uniform scale, rotation ±10°, aspect drift ±25%) chosen to
  minimise distance. Then assign ink strokes to target strokes with a cost matrix
  (Hungarian, cost = path distance); ink written in a different order than the target is
  an *order* fault, not a mismatch.

### 2.3 Measures per stroke

Resample the ink and the target to equal arc-length steps (8 units). With `r` = band
half-width × sensitivity × step factor (§2.5):

| Measure | How | Gate or graded |
|---|---|---|
| **Start** | distance(first ink point, target start) ≤ 1.5 r | gate |
| **Direction** | DTW cost forward vs reversed; forward must win by a margin. Loops: signed area sign = `winding` | gate |
| **Checkpoints** | all hit, in order (§1.3) | gate |
| **Coverage** | share of target length with an ink point within r | gate ≥ 85%, then graded |
| **Path** | mean and 90th-percentile distance of ink to target curve, ÷ r | graded |
| **Extra ink** | ink length outside 2 r ÷ target length | penalty |
| **Scribble** | ink length > 2.5× target, or > 3 direction reversals along the stroke | rejects the stroke |
| **Order** | which target stroke this ink matched vs the one expected | gate for letters; off for drawings by default |
| **Dot** | a tap or mark within the dot radius | gate only |

**Stroke score** (only if every gate passes):
`100 × (0.6 × pathScore + 0.4 × coverage) − extraInkPenalty`, where
`pathScore = clamp(1 − (0.7·mean + 0.3·p90) / r, 0, 1)`.

A stroke that fails a gate is **not accepted** and has no score: the child redoes that
stroke and is told why.

**Item score** = length-weighted mean of stroke scores. Stars: ≥ 90 ★★★, ≥ 70 ★★, ≥ 40 ★.

### 2.4 Feedback — one thing, the most useful one

Priority: unfit → scribble → order → direction → start → checkpoints → coverage → placement → missing → path. (Direction before start: a backwards stroke also starts in the wrong place, and "go the other way" is the useful message. Missing is low: a stroke not reached yet is not the news.) The
message names the stroke badge and uses the stroke's `shape`:

| Fault | Message (i18n key, filled with the badge) |
|---|---|
| start | "Start stroke ២ at the green dot." |
| direction | "Stroke ២ goes the other way — follow the arrow." |
| checkpoint on a loop | "Go all the way round on stroke ៣." |
| checkpoint on a hook | "Curl the end of stroke ១." |
| coverage | "Stroke ២ stopped early — keep going to the end." |
| path | "Stay inside the path on stroke ៣." |
| order | "That was stroke ៤ — do ៣ first." |
| scribble | "Slowly, one stroke at a time." |

Live, in guided steps: the ink is green while inside the band, the current checkpoint
glows, and the next badge lights when a stroke is accepted.

### 2.5 Tolerances

`r = (width / 2) × sensitivity × step factor × age factor`

| Sensitivity | × | Step | × | Age band | × |
|---|---|---|---|---|---|
| Relaxed | 1.6 | big | 1.5 | A (≈4–6) | 1.2 |
| Balanced | 1.0 | guided / faded | 1.0 | B (≈7–9) | 1.0 |
| Strict | 0.7 | copy / memory | 1.3 | C (≈10+) | 0.9 |

Numbers are starting values; §2.6 is how they get tuned.

### 2.6 Calibration — making the numbers honest

- A **golden set** per item kind: recorded traces labelled *good*, *sloppy but right*,
  *reversed*, *wrong order*, *half*, *scribble*. Unit tests assert that every good trace
  passes, every wrong one fails with the right fault, and good > sloppy in score.
- In the Studio, **Steps & test** shows the admin's own attempts at each step with the
  per-measure numbers, plus a heat-map of where the band is too tight or loose.
- After launch, anonymous per-item stats (pass rate per step, most common fault) on the
  item's Studio page: an item where 80% fail "direction" on stroke ២ probably has a
  reversed stroke.

---

## 3. Writing steps — confirming a child can write

Based on the book's procedure: teacher draws with arrows → children trace in the air →
write on the slate.

```ts
interface StepPlan {
  steps: { id: StepId; pass: number; times: number; order: boolean }[];
  canWriteAt: StepId;
}
type StepId = "watch" | "big" | "guided" | "faded" | "copy" | "memory";
```

| Step | Guide shown | Assist | Default bar | Default for |
|---|---|---|---|---|
| watch | magic pen draws each stroke, arrows, voice | — | watched once | all |
| big | item fills the screen, thick band, arrows, START ring | strong | all strokes accepted | all |
| guided | band, arrows, start dot | light | ≥ 70, twice | all |
| faded | dotted outline, start dots; no arrows | none | ≥ 70 | all — **can draw** for drawing items |
| copy | model beside a blank grid | none | ≥ 60 | writing |
| memory | blank grid; the item is shown 3 s then hidden (or its name heard) | none | ≥ 60 → **can write** | writing |

- **Up:** meet the bar `times` times → next step. **Down:** fail twice → back one step,
  never to the start. The child sees their step as a row of dots.
- **Kept, not just earned:** *can write* is stored per learner per item with its date.
  The app re-checks from memory **3 days** after it is earned, then **10 days** after
  that (decided 2026-09-30). Pass both → *learned*. Fail → *needs practice*, back to the
  copy step. A connected feature (e.g. a review lesson) can also ask for a re-check.
- The admin edits the plan per item (turn steps off, change bars/repeats, choose the *can
  write* step); defaults come from `kind`.

### The player screen

Phone-first. Canvas with grid and guide; badges; START ring; step dots at the top; Watch
button; **Help switches** (§3.1); undo last stroke; clear; pen colour/size (cosmetic).
Finger, stylus and mouse. No pinch-zoom surprises; the canvas never scrolls while drawing.

### 3.1 Help switches — ghost and strokes on or off

A child (or parent) can turn each help **on or off** from a small row of icon switches
above the canvas. Two modes of play use them:

| Switch | On | Off |
|---|---|---|
| **Ghost** | the letter/drawing shown faded underneath | blank grid |
| **Strokes** | the path band for each stroke | no band |
| **Arrows** | direction arrows on the strokes | none |
| **Numbers** | badges ១ ២ ៣ at each start | none |
| **Start dot** | green START ring on the next stroke | none |
| **Grid** | the item's grid (4×3, baseline) | plain paper |
| **Voice** | stroke instructions read aloud | silent |

- **Steps** (the default) sets the switches for each writing step — watch/big/guided have
  everything on, faded turns off arrows and the band, copy/memory turn off ghost and
  strokes. The switches are shown but locked, so "can write" is earned honestly.
- **My way** (free practice) lets the child flip any switch: trace with ghost and
  strokes, or write on a blank grid with everything off. Every attempt is still scored
  and gets feedback. It counts toward *can write* only when **Ghost and Strokes are both
  off** — then it counts as a memory-step attempt.
- **Just draw** — for drawings: a blank canvas (or ghost only), no scoring, save the
  picture. For fun and confidence, never recorded as a fault.
- The admin sets each item's default switches; a parent can lock them (e.g. keep Ghost on
  for a 5-year-old) in child settings. The child's last choices are remembered per item.

---

### 3.2 Helping a child improve

The coach is **rule-based and local** (no AI, works offline), in the same style as the
existing offline guide. It reacts to the per-stroke faults from §2, and always does
**one** thing at a time.

**After every attempt**

- **Good first:** accepted strokes turn green with their badge before any correction, so
  the child sees what they already do right.
- **Show, don't just say:** the child's ink is laid over the model; only the part that
  went wrong is highlighted (the stroke that started in the wrong place, the gap where a
  loop was not closed).
- **Replay just that stroke:** a "watch stroke ២" button replays only the failed stroke,
  slowly, with the magic pen.

**When the same fault repeats (2 times in a row on the same stroke)**

| Fault | What the coach does |
|---|---|
| start | turns the START ring on (even in My way) and makes it pulse bigger; fades it out after 2 good starts |
| direction | turns Arrows on and animates one arrow travelling the stroke before the child starts |
| checkpoint (loop not closed, hook not curled) | makes the missed checkpoint glow as a target; "touch the star" |
| coverage (stopped early) | shows the end dot in red; "go all the way to the red dot" |
| path (wobbly, off the line) | turns Strokes on, widens the band one level; narrows back after 2 good tries |
| order | turns Numbers on and dims every stroke except the next one |
| scribble / too fast | a tortoise: "slowly"; the pen draws more thinly when moving very fast |

Help added by the coach is **faded back out** after 2 successes, so the child does not
come to depend on it.

**When a stroke keeps failing (4 times)**

- **Drill the part:** offer that stroke alone as a mini-exercise (a loop, a hook, a
  curve) using the matching pre-writing item, then return to the whole letter.
- **Back one step** with more help (§3), never to the start.

**Over time**

- **Look-alike letters (writing):** the admin marks pairs whose *strokes* differ only a
  little (e.g. ទ / ធ, ឃ / ឈ). When a child writes one like the other in a memory step,
  the coach shows both with the differing stroke highlighted, then asks them to write
  each. (Telling letters apart by sight or sound is reading — not Trace's job.)
- **Proportions in copy/memory:** with no size marking, the coach still notices a head
  circle far too big or a letter off the baseline and gives one gentle tip ("make the
  head small and round").
- **Break time:** after 5 failed attempts in a row, suggest a rest or switch to Watch —
  never a sixth "try again".
- **Parents:** the report turns the most common fault into a tip ("ខ: starts in the wrong
  place — let them watch stroke ១, then start on the green dot").

---

### 3.3 Khmer character set — the first collections

Koda Trace ships with the full Khmer set a young child meets. **Stroke order is authored
in Trace Studio, not taken from a book** — Koda Trace is its own drawing module. For each
item the AI proposes an order, the admin shapes and numbers the strokes, and that
published order is the one every child and every connected feature uses. Each group is
one collection:

| Collection | What | Count (approx.) | How it is traced |
|---|---|---|---|
| **Consonants** ព្យញ្ជនៈ | ក ខ គ ឃ ង … ហ ឡ អ | 33 | on its own on the 4×3 grid |
| **Independent vowels** ស្រៈពេញតួ | ឥ ឦ ឧ ឩ ឪ ឫ ឬ ឭ ឮ ឯ ឰ ឱ ឲ ឳ | ~14 | on its own |
| **Feet (subscripts)** ជើង | ្ក ្ខ ្គ … ្អ | 32 | under a faded carrier (e.g. ស for ស្វ) |
| **Vowels** ស្រៈនិស្ស័យ | ◌ា ◌ិ ◌ី ◌ឹ ◌ឺ ◌ុ ◌ូ ◌ួ ◌ើ ◌ឿ ◌ៀ ◌េ ◌ែ ◌ៃ ◌ោ ◌ៅ, plus ◌ុំ ◌ំ ◌ាំ ◌ះ ◌ុះ ◌េះ ◌ោះ | ~23 + compounds | around a faded carrier (ក) |
| **Consonant shifters and signs** | ◌៉ ◌៊ (shifters); ◌់ ◌៍ ◌៌ ◌៎ ◌័ ◌៏ ◌ៈ | 2 + ~7 | on a faded carrier word |
| **Numbers** លេខ | ០ ១ ២ ៣ ៤ ៥ ៦ ៧ ៨ ៩ | 10 | on its own |

About **125 items**, all **writing** mode (feet, vowels, shifters and signs are kind `mark`). Obsolete letters (ឝ ឞ, ឨ) are left out. The **Lines** collection and pictures are **drawing** mode.

**Traced marks need a carrier.** A foot, vowel, shifter or sign is never written alone,
so its item has a **carrier**: a base letter drawn faded and *not scored*, with the mark's
strokes placed around it. This adds two fields and one measure:

```ts
interface TraceItem {
  // …as above
  carrier?: { text: string; scored: false };   // "ក" for ◌ា, "ស" for ្វ
  zone?: "above" | "below" | "left" | "right" | "around";  // where the mark belongs
}
```

- **Placement** is checked in copy/memory steps: the mark must land in its zone relative
  to the carrier (a foot below the base line, ◌ិ above, ◌េ to the left). Wrong zone is a
  gate fault: "◌េ goes before the letter."
- **Split vowels** (◌ើ ◌ោ ◌ៀ ◌ឿ ◌ៅ) are several strokes in several zones; each stroke has its
  own zone, and its order is set in the Studio.
- **In the Studio**, *Type it* for a mark renders it with the carrier from Noto Sans Khmer,
  so the outline — and the mark's position — is exact. Unicode classes come from
  `src/library/data/khmer.ts` (consonant, independent vowel, vowel, shifter, sign), so
  the Studio can file a typed character into the right collection automatically.
- **Numbers in Khmer** use Khmer badge numerals and the 4×3 grid; Latin 0–9 is a separate
  English collection later.

Building these ~125 items is the first real use of the Studio, and the best test of its
tools. The pre-writing lines (straight, curve, hook, loop, zigzag, wave) come before them
as a small **Lines** collection.

---

## 4. Connecting other features

The contract Library, Learn Khmer lessons or a skill use — and all they may use:

```ts
<TracePlayer
  itemId="km-letter-kha" rev?={3}
  steps?={["watch", "guided", "memory"]}   // a subset of the item's plan, or its default
  onResult={(r: TraceResult) => …} />

interface TraceResult {
  itemId: string; rev: number; step: StepId;
  accepted: boolean; score: number; stars: 0 | 1 | 2 | 3;
  strokes: { order: number; accepted: boolean; score?: number; fault?: TraceFault }[];
  canWrite: boolean;                        // after this attempt
}

traceProgress(learnerId, itemId): { step: StepId; canWrite: boolean; since?: string }
listTraceItems({ collection?, kind?, script? })   // for a picker in another studio
```

A connected studio stores only the **item id** (and optionally a step subset). Editing
strokes always happens in Trace Studio, so one letter used in ten places is fixed once.

---

## 5. Trace Studio — screens

1. **Items** — searchable grid (kind, script, collection, status, pass-rate). New item.
2. **Item editor** — wizard: **Source** (type it / describe it / upload a page) → **AI
   trace** (accept, re-run, blank) → **Shape strokes** (§1.4) → **Steps & test** (§3,
   admin writes each step, sees measures) → **Publish**.
3. **Collections** — order items, cover, age band, script; publish/unpublish.

### Publish checks (live in the editor, enforced by the server)

1. Every stroke has ≥ 2 nodes (dot: 1 + radius) and a minimum length; orders 1…n.
2. Nodes inside the canvas; no stroke so tightly doubled back that direction is ambiguous.
3. Closed strokes have a winding; every stroke has checkpoints at start and end.
4. `continue` joins really touch.
5. Strokes cover the guide — no large untraced part of the outline/skeleton.
6. The step plan ends at a *can write* step.
7. **Test-written by an admin at every enabled step** on this revision, meeting each bar.

---

## Phases

### Phase 0 — Geometry and scorer · no UI · **built 2026-09-30, awaiting review**
Bézier maths (evaluate, split, length, nearest point, resample), editor operations (bend,
straighten, blend, reverse, mirror, simplify, fit-to-points), checkpoints, capture
cleanup, matching (guided + fitted/Hungarian), every measure, feedback choice, the golden
set. **Done when:** golden traces pass/fail with the right fault for a line, a loop, a
hook, Khmer ខ and ច, the numeral 7 and a simple cat.

### Phase 1 — The player, writing steps, help switches and coach · **built 2026-09-30, awaiting review**
`TracePlayer` with Watch (magic pen), all six steps, help switches (§3.1), the coach
(§3.2), carriers and placement zones, live feedback, *can write* state with the 3/10-day
re-checks,
offline, on hand-written JSON items (line row, loop, ខ, ច, 7, cat). **Done when:** a child
climbs to *can write* on each on a phone in the real app.

### Phase 2 — Trace Studio editor · **built 2026-09-30, awaiting review**
Source (type it), every mode and magic tool, checkpoints, Steps & test, local drafts.
**Done when:** an admin rebuilds the Phase 1 items in a few minutes each.

### Phase 3 — Server, collections, publish, learner tab, the Khmer set · **built 2026-10-01 (incl. reports, reorder, cover, search); airplane-mode check pending**

Decided 2026-10-01: a Koda admin grants the **`trace:create`** platform permission to chosen
adults (never a child; no family role can hold it); **every published collection is public**
to all learners; **AI starter strokes (Phase 4) are for paid users**. 3a = server
(`routers/trace.py`, `repos/trace.py`, `trace_verify.py`), drafts synced local-first,
Collections + set board in the Studio (new items from a list, add existing, apply to all,
publish/unpublish), learner shelves per collection cached for offline. Next: 3b set-board
polish (drag reorder, thumbnails cover choice), Phase 4 AI, Phase 5 creator quotas, review
queue for public listings, pass-rate alerts.
`routers/trace.py`, revisions, publish checks server-side, collections, learner Trace tab,
offline download, report-a-problem; then the admin builds the Lines collection and the
~125 Khmer items (§3.3). **Done when:** all Khmer collections are published and work in
airplane mode on a child's tablet.

### Phase 4 — AI
Line-art preset, vectoriser worker, stroke-order route with validation/fallback, book-page
cleanup. **Done when:** "a cat sitting" and a photo of a book grid become sensible
numbered strokes needing only small edits.

### Phase 5 — Record, report, connect
Learning events and error kinds with parent wording, XP/stars, per-item stats in the
Studio, the §4 contract exported for Library and Learn Khmer. **Done when:** a parent sees
"ខ — can write ✓" and a Library or lesson page can embed a trace item by id.

## Open questions

1. **Decided (2026-09-30): stroke order is defined in Trace Studio.** The book is not the
   source; the AI proposes and the admin decides, for every Khmer item.
2. **Trademarked characters** (Hello Kitty) — original or licensed art only in anything
   published to everybody.
3. **Words** — per-letter grids in v1; joined-up later.
4. **Left-handed children** — per-learner setting moving the START badge and tool rail.

## Not in release 1

Cursive, pressure/pen-width scoring, colour-matters drawings, children publishing their
own items, live AI feedback.
