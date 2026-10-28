# English tracing — letters and numbers

Plan for the English half of Koda Trace: capital letters, small letters and the numbers 0–9,
drafted as **collections** in Trace Studio and **traced by children** in the Trace tab.
Builds on `docs/TRACE_STUDIO_BUILD_PLAN.md` (§3.3 left "Latin 0–9 … an English collection later").

## What already exists (no new engine needed)

- `TraceItem` already has `script: "latin"`, `numerals: "latin"`, `kind: "letter" | "numeral"`,
  and the grid `baseline-4-lines` (`gridLines()` in `StrokeEditor.tsx`).
- Studio → Collections → New set already has presets **A–Z**, **a–z**, **0–9**
  (`PRESETS` in `Collections.tsx`); `itemFor()` (`batch.ts`) creates one empty draft per entry
  with its typed guide glyph.
- The player, six writing steps, scorer, can-write record, offline shelves, parent report and
  publishing are script-agnostic.

So the work is **content** (62 items of strokes) plus a few English-specific polish items.

## The collections

All **writing** mode, strict stroke order, grid `baseline-4-lines`.

| # | Collection | Items | Notes |
|---|---|---|---|
| 1 | **Lines & shapes (pre-writing)** | ~8 | standing line, sleeping line, slant, circle, curve, zigzag, hook. Drawing mode. Shared with Khmer; build once. |
| 2 | **Capital letters A–Z** | 26 | |
| 3 | **Small letters a–z** | 26 | |
| 4 | **Numbers 0–9** | 10 | |
| — | *(later)* **Letter families** | — | re-grouping of the same items by stroke shape (see below); no new items |

Suggested teaching sub-order inside each alphabet collection, so the shelf order is a path
rather than a-to-z. Items keep alphabetical titles; the collection's **item order** is set on
the set board:

- **Capitals** — straight lines first: `L I T H E F` · diagonals: `V W X Y Z A K M N` ·
  curves: `C O Q G S U J` · lines + curves: `D P B R`.
- **Small** — "c-shapes": `c o a d g q e` · down-and-up: `i l t j u y` ·
  humps and arches: `h b n m r p k` · diagonals: `v w x z` · `f s`.
- **Numbers** — `1 7 4 · 0 6 9 8 3 5 2` (straight first, then rounds). Two-line items: `4` is
  two strokes with a lift, `5` is two (the hat is the second).

## Grid and guide lines (one convention)

`baseline-4-lines` is y = 250 / 450 / 650 / 850 in the 0–1000 square:

| Line | y | Used by |
|---|---|---|
| Top | 250 | capitals, digits, tall small letters (b d f h k l t) |
| Middle | 450 | x-height of small letters (a c e …) |
| **Baseline** | 650 | every letter and digit sits on it |
| Bottom | 850 | descenders (g j p q y) |

- Capitals and digits span 250 → 650. Small letters span 450 → 650, ascenders reach 250,
  descenders reach 850.
- Typed guide glyph is placed so its baseline lands on y = 650 (check `guide.glyph.y` in
  `itemFor`; today it is 780, tuned for Khmer — **fix for latin**).
- Font for the guide: a plain **school-print** face (single-storey `a` and `g`) so the
  outline matches what is taught. This is a decision: see Open questions.

## Stroke order: the rules the Studio author follows

Common school print order, applied uniformly so the checks can be trusted:

1. Top to bottom, left to right.
2. Vertical/slanted strokes go **down**; horizontals go **left → right**.
3. Circles/rounds start at the **1 o'clock** point and go **counter-clockwise** (`a c d e g o q`).
4. Round-and-stem letters: round first, stem second (`a d g q`); stem first for `b p` and capitals `B D P R`.
5. Dots and crosses last: `i j` dot, `t f` crossbar, `x` second diagonal.
6. Each stroke is a single pen-down motion; a lift always starts a new stroke.

Letters needing a decision (mark in the Studio set board as "check"): `a g y` (single- vs
double-storey, take the school-print form), `k`, `M N W` (4 vs 1 continuous stroke — use
**separate down/up strokes**, easier to score for children), `Q` tail, `4` open/closed, `7`
with/without crossbar (no bar), `1` with/without flag (flag, no foot), `f t` crossbar.

## How a child traces them (the "allow user to trace them" requirement)

This is the existing Trace tab; the plan only makes sure English is reachable and good:

1. **Shelf** — once the three collections are published they appear on the Write shelf with
   cover, count and progress ring. Cover = the first item's strokes.
2. **Open a collection** → grid of letters (done ✓ ring, in-progress dot). Tap a letter.
3. **Player steps** — watch → trace with arrows/numbers → trace dotted → copy → memory; the
   *can write* tick is earned with 3- and 10-day rechecks. Age preset (young/middle/older)
   sets band width, strictness and numbers/arrows (`presets.ts`).
4. **Pairing capital/small** — on a letter's end screen, a "Next: a" link to its partner so
   `A` → `a` is one tap (needs the pair map below). Optional, phase E3.
5. **Offline** — each collection downloads as one unit; tracing works in airplane mode.
6. **Parent report** — can-write letters appear in the existing report section.
7. **Voice** — tapping the speaker plays the letter name/sound if a recording is attached
   (`voice`); not required for launch (Trace does not teach reading; see main plan).

## Work phases (build one, you verify, then next)

**E0 — Fix the foundations for latin** *(small)*
- Guide glyph baseline/size for latin (glyph `y` so baseline = 650; size by case).
- Confirm the 4-line grid renders in the player (not only in the Studio editor).
- Latin badge numerals and `numerals: "latin"` in the player; capital/small tall-line sanity.
- Tests: `itemFor` latin positions; `gridLines` zones.

**E1 — Numbers 0–9 + Lines** *(first collection, smallest, validates the pipeline)*
- Create the collections from the presets; Auto-strokes for a first pass, author fixes
  order/shape per item; publish; trace each in the app at 390 px and desktop.
- Lines collection reused from the Khmer plan.

**E2 — Capital letters A–Z**
- Author in the families order above; set board order; publish.

**E3 — Small letters a–z**
- Same; descender/ascender line checks; publish.
- Capital↔small pair map (`A↔a` …) as a content field/tag so "next" and a combined
  review can use it.

**E4 — Polish & cross-links**
- Optional "Letter families" collections (re-use of the same item ids, no duplication).
- Mixed review: "write a, then A" using the pair map.
- Word tracing (`cat`, `dog`) later via `docs/WORD_TRACE_BUILD_PLAN.md` — out of scope here.

## Drafting method per collection

1. Studio → Collections → **New set** → preset (A–Z / a–z / 0–9). 26/26/10 empty drafts appear
   with their typed guide.
2. Per item: **Auto strokes** (free, on-device) → author corrects with the editor's tools
   (Adjust & Drag, Add Points, Magic Snap, Straighten) → number the strokes per the rules
   above → test-write in the preview.
3. Studio **checks** (`checks.ts`) must pass per item (every stroke ≥ 2 nodes, start-ring
   clear of crossings, strokes inside the box, order contiguous).
4. Apply the **Young** style preset to the whole set from the set board ("apply to all");
   let older bands choose Middle/Older at play time.
5. Review → publish (collections are public; non-admin creators go via review).

Each item is ~2–5 minutes by hand; the three collections are roughly 62 items ≈ 3–5 hours of
Studio work, which is the real cost of this plan.

## Open questions

1. **Guide font** — school-print (single-storey a/g, e.g. Andika / Sassoon-like) vs plain sans.
   Recommendation: Andika (SIL OFL, free) loaded for the Studio guide only.
2. **Print vs cursive** — print now; a cursive/joined set would be a separate later collection.
3. **Which age band / grade** the three collections tag as (suggest K–2, ages 4–7).
4. **Do capitals ship before small letters?** Recommendation yes (E2 → E3), numbers first (E1).
5. Should I author the 62 items myself in code (programmatic stroke definitions, committed as a
   seed, reviewed in the Studio) rather than by hand? Faster and reproducible, but needs your
   eye on every shape. Recommendation: **yes for first drafts**, you adjust in the Studio.
