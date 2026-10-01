# Language courses — Learn Khmer (MVP) and Learn English

**Goal:** launch **Learn Khmer** with the whole **Grade 1 Khmer book** (MoEYS) on it,
authored and published by an admin in Koda — not hand-coded — and build the Studio so the
same tool publishes **Learn English** next, with no new code per course. The admin tool is
the product as much as the lessons are: a book of ~60 lessons has to be a few hours of
checking per lesson, not days of data entry.

Tracing (letters, lines *and* drawings) is **its own module, Koda Trace, with its own
Trace Studio** — see [TRACE_STUDIO_BUILD_PLAN.md](TRACE_STUDIO_BUILD_PLAN.md). A lesson's
trace block only *references* a published trace item by id and embeds the shared
`TracePlayer`; strokes are never edited in the course tool.

## What the book shows (sampled pages, not a full read)

The Grade 1 book (164 pages) has a teacher section, then lessons. What matters for the
design:

| What | Where seen | What it means for us |
|---|---|---|
| **Lines before letters.** The book opens with line tracing — straight, curve, hook, loop; always left→right, top→bottom | intro p5, methodology p8 | the first lessons are *pre-writing*: trace lines and simple shapes. Tracing is not only letters. |
| **Teaching procedure:** teacher draws with arrows on the board → children trace in the air → write on the slate → repeat for each letter | p12 | this is a **step ladder**: watch → trace with help → write alone. We mirror it (see *Writing steps*). |
| **Letter lesson:** header (lesson №, study time), the letter large and on a grid with numbered arrowed strokes, syllable row (consonant blue, vowel red), words, phrases, a sentence | lessons 6, 7 (the author's pictures) | the core template |
| **Pattern lesson:** "combine with □ក □ក់" — rows of syllables built on a pattern, words, two sentences, pictures, a note (ចំណាំ) explaining a sign | lesson 42, p80 | same parts, but the *pattern* (final consonant, sign) is the subject instead of one letter |
| **Review lesson (រៀនសាឡើងវិញ):** recap of 3 letters or a word list, sentences, then **exercises (លំហាត់)**: draw a line from each picture to its word; write the word under each picture; write words containing a given letter/word | p40, p150 | review lessons are checkpoints and they **test** writing — this is where "can write" is confirmed or lost |
| Every lesson has a study time (០៣ ម៉ោង) | all lessons | a guide for parents; not used for pacing in MVP |

So the book is a **sequence of lessons made of a small set of recurring parts**. That is
the data model.

## The decision this plan rests on

**A course is published content: Course → Lessons → Blocks.** An admin builds it in the
**Course Studio** and publishes at runtime, like a Library book. New module `src/courses/`
(not `src/skills/`, not a Library shelf — lessons are ordered and a child goes through
them in sequence).

**Nothing in the Studio or the player is Khmer-specific.** Everything that differs between
Khmer and English lives in one **script profile** per course language (below). Learn Khmer
is the first course; Learn English is the second, made in the same Studio.

**Labels vs content (the app's i18n rule applies):** the Studio and player chrome ("Next",
"Check", "Watch the strokes") come from the i18n catalogs and follow the app language.
Everything in a course — letters, words, sentences, *and the exercise instructions* — is
content, written in the course, never machine-translated by the app.

### Data model

```ts
interface Course {
  id: string;                     // "learn-khmer-g1", "learn-english-starter"
  title: string;                  // content
  language: string;               // what is taught: "km" | "en"
  instructionLanguage: string;    // what the prompts are written in (see open question 6)
  script: ScriptProfileId;        // "khmer" | "latin"
  lessonIds: string[];            // order = the book's order
  cover: PictureRef;
  status: "draft" | "published"; rev: number;
}

interface Lesson {
  id: string;
  number: number;                 // មេរៀនទី ៦ / Lesson 6
  kind: "prewriting" | "letter" | "pattern" | "review";   // picks the template only
  title: string;                  // "ខ", "□ក □ក់", "រៀនសាឡើងវិញ"
  studyHours?: number;            // shown to parents
  focus: string[];                // the letters / pattern this lesson teaches
  blocks: Block[];                // what the child does, in order
  source?: { pdfPage: number; image: PictureRef };   // the book page it came from
  status: "draft" | "ready" | "published"; rev: number;
}

type Block =
  | { type: "trace";        itemId: string; steps?: StepPlan }         // lines, letters, numerals, drawings
  | { type: "meet";         text: string; audio: ClipRef; picture?: PictureRef }
  | { type: "syllables";    rows: string[][]; games: ("find" | "build")[] }
  | { type: "words";        items: WordItem[]; games: ("match" | "spell")[] }
  | { type: "read";         lines: string[] }                            // phrases, sentences
  | { type: "note";         text: string }                               // the book's ចំណាំ
  | { type: "matchLines";   prompt: string; pairs: { picture: PictureRef; word: string }[] }
  | { type: "writeWord";    prompt: string; items: { picture?: PictureRef; answer: string; audio: ClipRef }[] }
  | { type: "writeLetters"; prompt: string; accepted: string[] };       // "write words with ដ"
```

A **lesson kind is only a template** — a starting list of blocks. The admin can add,
remove and reorder blocks in any lesson, so a lesson the templates did not foresee is
still buildable without code.

| Template | Blocks it starts with |
|---|---|
| Pre-writing | trace (line) × n · trace (drawing) |
| Letter | meet · trace (letter) · syllables · words · read · note? |
| Pattern | meet · syllables (pattern rows) · words · read · note |
| Review | meet (recap letters) · words · read · matchLines · writeWord · writeLetters |

### Script profile — the only place Khmer and English differ

| | Khmer (`khmer`) | English (`latin`) |
|---|---|---|
| Split a syllable/word into units | `spellingUnits` / `normalizeKhmer` (consonant · foot · vowel) | graphemes: letters + digraphs (sh, ch, th, ck, ee…) |
| Colour roles | consonant blue, vowel red (from the units, never typed) | consonant blue, vowel red; digraph as one tile |
| Generate a syllable row | consonant × vowel set (the book's 28) | word family: onset × rime (c-at, h-at, s-at…) or CVC |
| Validate a string | `khmerProblem` (dangling coeng, two vowels…) | allowed letters, no double spaces; optional word list |
| Writing grid | `4x3-moeys` | `baseline-4-lines` (sky, mid, base, descender) |
| Badge numerals | ១ ២ ៣ | 1 2 3 |
| Letter names and sounds | recorded sound names (`UnitVoices`, `sayUnit`) | recorded letter names + phonics sounds |
| Stroke-order convention (for the AI) | MoEYS workbook order | school print handwriting (Zaner-Bloser-style ball-and-stick) |
| Font | Noto Sans Khmer (outline = trace guide) | a school print font with single-storey a/g |

Adding a third language later = one profile + its sound recordings.

## The learner side

**Two strands, kept apart.** Every lesson has a **reading** part (meet the letter, its
sound, syllables, words, sentences, match-lines) played by the course's own reading
blocks, and a **writing** part (the letter, its marks, write-word, write-letters) played
by Koda Trace. Progress is tracked separately — a letter shows *can read* and *can write*
as two ticks — and neither gates the other. Drawing items (pre-writing lines, pictures)
come from Koda Trace's **Draw** shelf and earn *can draw*.

**Course page:** the lessons as a path (book order), review lessons as checkpoints. Each
card shows the focus letters, stars, and a "can write" tick per letter (from trace
mastery). Lessons are open with a suggested order (open question 3).

**One lesson:** the blocks, one screen each, stars at the end. A trace block is the
**writing steps** below, not a single trace. Everything works offline once the lesson is
downloaded; XP and stars use the Koda economy.

### Writing steps — how the app confirms a child can write

This is the book's procedure (board with arrows → air → slate) made measurable. Each step
has an accuracy bar; a child moves up when they pass it, and **"can write" is only given
by writing with no guide**. Full scoring detail is in the trace plan.

| Step | The child sees | Passes when | Book equivalent |
|---|---|---|---|
| 1 Watch | the magic pen draws each stroke ១ ២ ៣ with arrows and voice | watched once (no score) | teacher on the board |
| 2 Big trace | the item large, thick band, strong assist | every stroke started right, in the right direction, finished | tracing in the air |
| 3 Guided trace | normal size, band + arrows + start dot | score ≥ 70, twice | first strokes on the slate |
| 4 Faded trace | dotted outline and start dots only, no arrows | score ≥ 70 | — |
| 5 Copy | the model beside a blank grid | score ≥ 60 | copying from the board |
| 6 From memory | sees it for 3 s (or hears its name), then a blank grid | score ≥ 60 → **can write ✓** | writing on the slate |

- Scores are **per stroke** (start, direction, path, coverage, order); the child is told
  the one thing to fix, with the stroke badge.
- A failed step twice drops back one step (more help), never to the start.
- **Review lessons re-test from memory.** Pass: still *can write*. Fail: the letter goes
  back to *needs practice* and is offered again — so the tick means something to a parent.
- The admin sets the steps per item or per template (e.g. pre-writing lines: steps 1–4
  only; drawings: 1–4; letters and numerals: all six) and the bars; defaults above.

### Exercise blocks from the review pages

| Book exercise | In the app | Scored |
|---|---|---|
| Draw a line from each picture to its word | drag a line from picture to word; it snaps and stays | automatically |
| Write the word under each picture | hear/see the picture, write the word **letter by letter on the grid from memory**; each letter scored as step 6 | automatically — the answer is known |
| Write words containing "ដ" / from "បាល់" | open answers can't be checked by handwriting alone → the child spells with tiles; accepted if the word is in the lesson's `accepted` list | automatically, against the admin's list |

## The admin tool — Course Studio

Designed around one job: **turn a book page into a published lesson, fast, with nothing
wrong in it** — for any course language.

### 1. Course board

Lessons 1…N as a grid of cards, each with the book page thumbnail, a status
(*empty · drafted · needs audio · ready · published*) and a checklist count
("Strokes ✓ · Audio 26/31 · Pictures 4/5 · Test-traced ✓"). Filter by status. Publish one
lesson, a range, or the course. A **Trace items** tab lists every trace item the course
uses (lines, letters, numerals, drawings) — a letter used in 10 lessons is made once.

### 2. Import from the book (AI)

Upload the **whole PDF** (or a photo of one page). One draft per lesson page.

- A vision model classifies each page (teacher notes → skipped; letter / pattern / review
  / pre-writing lesson) and reads it into that template's blocks — lesson number, study
  time, focus, syllable rows, words, lines, exercises — as JSON only.
- Every string is checked on arrival by the script profile's validator; anything
  suspicious is **flagged, not silently fixed**.
- Pictures on the page are cropped and offered as the word's picture (or replaced by
  AI line-art / a photo).
- Letter grids and line-tracing rows are cropped and sent to Trace Studio's AI trace; the
  page's numbers (១ ២ ៣) become the proposed stroke order.
- The admin sees the **page side by side** with the draft and corrects it. Manual entry
  works the same without the import.

### 3. Lesson editor

Left: the book page (zoomable), always visible. Right: the lesson's blocks as a list —
add, remove, drag to reorder, each block opening its editor:

- **Trace** — pick a published item from Koda Trace (`listTraceItems`), or jump to
  Trace Studio to make one (a cropped book grid can be sent along as its source). Choose a
  subset of its writing steps, or use the item's own plan.
- **Syllables** — generated by the profile's rule (Khmer: consonant × vowel set; English:
  word family); remove or add; colours come from the units.
- **Words / Read / Note** — lists; each word with a picture and a hint like the book's
  "(រ)".
- **Exercises** — pairs for match-lines, answers for write-word, the accepted list for
  open writing.
- **Audio** — every spoken item has a row: record, generate with an AI voice, play,
  approve. Missing audio is a checklist item, never a silent fallback to a device voice
  that cannot read Khmer. Letter names reuse the recorded sound names.
- **Preview** — play the lesson exactly as a child will, all writing steps included;
  nothing saved.

### 4. Checks before publish

Refused while any fails:

1. Every block is complete for its type (a trace block has a published-ready item; a
   match-lines block has ≥ 2 pairs; a write-word block has answers…).
2. Every string passes the profile's validator; syllables are built from the lesson's
   focus.
3. Every trace item passes Trace Studio's checks and was **test-traced by an admin at
   every enabled step** on this revision.
4. Every spoken item has approved audio; every picture is approved.
5. Lesson numbers are unique and continuous; each review lesson only reviews letters taught
   before it.

### 5. Publish

Draft → publish per lesson or per range; revisions like Library books (a child mid-lesson
finishes the revision they started). The course index lists published lessons only, so the
book can go live in parts (e.g. the pre-writing and first ten letters first).

## Server and data

- `server/app/routers/courses.py` + repos for `courses`, `course_lessons`, `trace_items`
  (draft, published, rev) — modelled on `library.py`; reads on `settings:read`, writes on
  `content:write`.
- Published course = one index + one JSON per lesson + the trace items it uses; a device
  downloads a lesson with its clips and pictures, the `offlineSkill.ts` way.
- Learning record: a session per block; trace error kinds (`trace_start`,
  `trace_direction`, `trace_off_path`, `trace_incomplete`, `trace_order`) and each trace
  item's **writing step** and *can write* state; spelling kinds from Library. Parent
  report: "Lesson 6 — ខ: can write ✓ · syllables 25/28 first try · spelling needs ខ្ទរ".

## Technical risks to settle first

1. **Two colours inside one Khmer syllable.** Separate `<span>`s for consonant and vowel
   can break shaping. Test Chrome, iOS Safari, Android WebView in Phase 0; fallback is an
   SVG overlay of the vowel glyph. (English has no such issue.)
2. **Scoring writing with no guide (steps 5–6).** The child's letter is anywhere on the
   grid at any size; the scorer first fits it to the target (scale + move, aspect kept
   within limits) before matching strokes. Needs recorded real children's traces to tune.
3. **Khmer voice at scale.** ~1,200+ clips for the book; only *generate all, then approve
   by ear* ships it.
4. **Page reading accuracy.** Vision models misread Khmer subscripts and vowels — every
   string validated and shown next to the page. The import saves typing, never checking.

## Phases — MVP (Learn Khmer), then English

### Phase 0 — Formats and hand-made lessons · no Studio
Course/Lesson/Block types (TS + server model), the Khmer script profile, the trace geometry
core (trace plan phase 0), the colour-split test. Hand-written JSON: one pre-writing lesson
(4 lines + a simple drawing), lessons 6 (ខ) and 7 (ច), one review lesson. **Done when:** all
four validate and render on a phone.

### Phase 1 — The learner lesson, offline
Course page, the block players (meet, trace with all six writing steps, syllables, words,
read, match-lines, write-word, write-letters), *can write* state. **Done when:** a child
completes the four lessons in airplane mode, a review lesson can take a *can write* tick
away, and the parent report shows it.

### Phase 2 — Course Studio, manual
Course board, lesson editor with blocks, Trace Studio for lines/letters/drawings, preview,
checks, drafts/publish, course download. **Done when:** an admin rebuilds the four lessons
from scratch and publishes them; a child's device picks them up.

### Phase 3 — Audio at scale
Generate-all-missing, approve-by-ear queue, re-record, sound-name reuse. **Done when:** one
letter lesson is fully voiced in under 20 minutes of admin time.

### Phase 4 — Import the book (AI)
Whole-PDF import with page classification, per-template extraction, picture crops, stroke
proposals from grids and line rows, side-by-side review. **Done when:** importing the
Grade 1 PDF gives a draft for every lesson page and a typical lesson needs only minor fixes.

### Phase 5 — Publish Grade 1 and launch Learn Khmer
A Khmer teacher reviews every lesson; publish; Learn Khmer in the menu. **Done when:** the
whole book is live and works offline.

### Phase 6 — Learn English (after launch)
The Latin script profile (graphemes, word families, 4-line grid, print stroke order,
letter names + phonics recordings), then build a starter course in the same Studio — no
new player or Studio code. **Done when:** an admin publishes the first ten English
letter lessons without a code change.

**Not in the MVP:** Grade 2+, joined-up handwriting, teacher/classroom accounts,
children publishing their own drawings.

## Open questions

1. **Rights to the book.** The pages carry the Ministry's marks (krou.moeys.gov.kh).
   Confirm the licence allows republishing in an app — or get written permission — before
   Phase 5. The format is the same either way.
2. **Who reviews content?** A "reviewed by" field as a publish check?
3. **Lesson gating.** Proposal: open, with a suggested order; review lessons recommended
   but not blocking.
4. **Study time.** Proposal: shown to parents only in MVP.
5. **Syllable vowel set.** Confirm the book's 28, and whether some lessons omit some.
6. **Instruction language of Learn English.** For Khmer-speaking children, the English
   course's prompts ("Write the word") probably need to be in Khmer. Proposal: a course has
   an `instructionLanguage`, and prompts are written (by the admin) in that language —
   still content, not app translation.
7. **English source.** Is there an English book to import (like the MoEYS one), or does the
   admin build Learn English from templates only?
8. **Left-handed children.** Proposal: a per-learner setting that moves the start badge and
   tool rail; stroke rules unchanged.
