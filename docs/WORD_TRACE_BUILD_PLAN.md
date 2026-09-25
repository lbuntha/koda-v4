# Word Trace build plan

> **Superseded on structure (2026-09-22).** The reading feature is now **Koda Library**, an independent module — not a skill. See [KODA_LIBRARY_BUILD_PLAN.md](KODA_LIBRARY_BUILD_PLAN.md). Anything below about registering a skill, container lessons, `src/skills/word-trace/` or lesson locks for books no longer applies. Screens, the passage format and the eight checks still do.

A spelling skill whose word list is grown by an operator rather than shipped in
code. Interactive specification and playable mock-up:
[word-trace-spec.html](word-trace-spec.html) — open it in a browser, the wheel
is real.

**Flow** — Learn vs Topics, the read-then-quiz journey, passage format and
verifier — is in [WORD_TRACE_FLOW_DESIGN.md](WORD_TRACE_FLOW_DESIGN.md).

Implementation rules live in [SKILL_DEVELOPMENT.md](SKILL_DEVELOPMENT.md); this
plan records only the decisions that guide does not already make.

## Release scope

- **ID / name / ages:** `word-trace` / Word Trace / 5–10.
- **Learner outcome:** spells a single-syllable word from a picture or a spoken
  word by choosing and ordering its letters, for the spelling pattern the lesson
  teaches; and, in Khmer, by choosing and ordering its consonant clusters and
  vowel signs.
- **Prerequisites:** none at entry. Lesson 1 requires no existing conceptKey —
  this is the first literacy skill in the course and nothing in `src/skills/`
  teaches letter-sound correspondence yet. Declare `requires: []` in the
  manifest rather than borrowing `counter`.
- **Included:** one wheel engine; five modes (`picture`, `listen`, `bonus`,
  `mixed`, `sentence`); the English pattern ladder to two-syllable plurals; the
  Khmer cluster ladder; the operator Content Studio, which fills a pack two
  ways — **pick a topic** and let the model draft it, or **upload your own
  sentences** and let the app pull the words out of them — both through the same
  mechanical verification, the same human publish and the same offline sync.
- **Deferred:** parent- and child-authored themes (a second review gate, and the
  real risk in this feature); sentence spelling; handwriting/stroke tracing on a
  canvas; any third language.
- **Closest reference engine:** `src/skills/color-sweeper/activities/SweeperBoard.tsx`
  — the nearest thing to a wheel of selectable items with an ordered selection
  and refused moves. Tests: `color-sweeper/*.test.tsx`, and
  `src/skills/kit/testing/renderActivity.tsx` for the driver shape.

## The decision the rest follows from

**A theme is content; a lesson is a constraint.** A generated theme never
becomes a lesson. Lessons are bundled, ordered, prerequisite-gated and shipped
in code, and runtime content can be none of those. A lesson declares a spelling
pattern; a pack supplies words; at round start the engine filters the packs the
device holds down to the words that satisfy the pattern, and draws from those.

Consequences worth writing down:

- A pack is never "installed into" a lesson, so publishing one cannot reorder,
  unlock or break a course.
- A pack that has no word for a pattern is simply absent from that lesson.
- `core-starter`, bundled in `internal/packs/`, guarantees every lesson is
  playable on a device that has never been online.
- `expected` is still authored per question, from the pack, so the learning log
  records what was asked (§10) even though nobody typed it into a lessons file.

## Lesson map

Practice rows use `params.question.practice: true`, existing conceptKeys, and
separate course units. `params.level` is contiguous from 1 across both paths in
this skill's own ordering; the Khmer path is gated by a lesson-level `language`
param, not by a second skill.

| # / id | Objective / conceptKey | Requires | Mode · pattern | Question constraints | Hint ladder | Practice |
|---|---|---|---|---|---|---|
| 1 `short-a` | Spell CVC words with short a / `spell-cvc-a` | — | picture · `cvc_a` | 3 tiles, 0 distractors, 5 words | clue sentence → first tile → reveal | P1 |
| 2 `short-vowels` | All five short vowels / `spell-cvc-short` | `spell-cvc-a` | picture · `cvc_short` | 3 tiles, 1 distractor, 6 words | "which vowel do you hear?" → vowel tile → reveal | P1 |
| 3 `start-blends` | Initial blends / `spell-initial-blend` | `spell-cvc-short` | picture · `blend_initial` | 4–5 tiles, 1 distractor | "say the first two sounds slowly" → both tiles → reveal | P1 |
| 4 `end-blends` | Final blends / `spell-final-blend` | `spell-cvc-short` | picture · `blend_final` | 4–5 tiles, 1 distractor | name the ending sound → last two tiles → reveal | P1 |
| 5 `digraphs` | sh ch th ck / `spell-digraph` | `spell-initial-blend` | picture · `digraph` | 4 tiles; the digraph is offered both whole and split | "one sound, two letters" → the pair → reveal | P1 |
| P1 `practice-short` | Practice / `spell-cvc-short` | `spell-digraph` | picture · modes 1–5 cycled | 10 words | none | — |
| 6 `magic-e` | Final e / `spell-magic-e` | `spell-digraph` | picture · `vce` | 4–5 tiles; the short-vowel twin is a distractor | "cap or cape?" → the e → reveal | P2 |
| 7 `vowel-teams` | ai ee oa ea / `spell-vowel-team` | `spell-magic-e` | picture · `vowel_team` | 4–5 tiles | which team → the pair → reveal | P2 |
| 8 `bossy-r` | ar or er ir ur / `spell-r-controlled` | `spell-vowel-team` | picture · `r_controlled` | 4–5 tiles | "the r changes the vowel" → the pair → reveal | P2 |
| 9 `plurals` | -s and -es / `spell-plural` | `spell-vowel-team` | picture · `plural` | picture shows more than one | count them → the ending → reveal | P2 |
| P2 `practice-longer` | Practice / `spell-vowel-team` | `spell-plural` | picture · modes 6–9 cycled | 10 words | none | — |
| 10 `spell-heard` | Spell from sound / `spell-from-sound` | `spell-plural` | **listen** · mixed | no picture; clue withheld until hint 1 | replay → first tile → reveal | P3 |
| 11 `word-family` | Find the hidden words / `spell-word-family` | `spell-from-sound` | **bonus** | one ring, n valid words, round ends at n | tile count of the next word → its first tile → reveal | P3 |
| 12 `challenge` | Mixed spelling / `spell-mixed` | `spell-word-family` | **mixed** | 8 words, 2 distractors, patterns 1–9 | the ladder of the word's own pattern | P3 |
| 13 `missing-word` | Spell the word a sentence is missing / `spell-in-sentence` | `spell-mixed` | **sentence** · any | the sentence with its word gapped; read aloud on request; ages 7+ | read it again → first tile → reveal | P3 |
| P3 `practice-mixed` | Practice / `spell-mixed` | `spell-in-sentence` | all five modes | 10 words | none | — |
| K1 `kh-consonant-vowel` | Consonant + vowel / `khmer-consonant-vowel` | — | picture · `kh_cv` | 2 tiles | clue → first tile → reveal | KP |
| K2 `kh-two-consonant` | Two consonants / `khmer-two-consonant` | `khmer-consonant-vowel` | picture · `kh_cc` | 3 tiles | — | KP |
| K3 `kh-coeng` | Subscript (ជើង) / `khmer-coeng` | `khmer-two-consonant` | picture · `kh_coeng` | 2–3 tiles; the base consonant alone is a distractor | "the letter underneath" → the cluster tile → reveal | KP |
| K4 `kh-final` | Final consonant / `khmer-final-consonant` | `khmer-coeng` | picture · `kh_final` | 3–4 tiles | — | KP |
| K5 `kh-independent` | Independent vowels / `khmer-independent-vowel` | `khmer-final-consonant` | picture · `kh_indep` | 2–3 tiles | — | KP |
| K6 `kh-sentence` | Finish the sentence / `khmer-spell-in-sentence` | `khmer-independent-vowel` | **sentence** | ស្វាចូលចិត្តញ៉ាំ___។ | read it again → first tile → reveal | KP |
| KP `practice-kh` | Practice / `khmer-coeng` | `khmer-independent-vowel` | picture · K1–K5 | 10 words | none | — |

**Standards.** English lessons carry only the CCSS codes they assess, primary
first: `RF.1.3.B` and `L.1.2.D` (1–4), `RF.1.3.A` (5), `RF.1.3.C` (6–7),
`L.2.2.D` (8–9, 12), `RF.1.2.D` (10), `L.1.2.E` (13). Khmer lessons carry `[]`: no published
Cambodian standard is mapped in this codebase, and an English code pasted into a
Khmer lesson is a wrong answer no test can see. `trajectoryLevel` uses Ehri's
phases — `partial-alphabetic` (1–2, K1–K2), `full-alphabetic` (3–9, K3–K5),
`consolidated-alphabetic` (10–13, K6).

**iconTone** comes from the closed set. Teaching lessons use `purple`, practice
uses `emerald`. Not `sky`, `violet` or `rose` — those resolve to indigo in
silence.

## Engine decisions

### `word-trace/wheel`

- **Tiles, not letters.** The unit is whatever `internal/segment.ts` returns for
  the word in its language: a Latin letter, or a Khmer base consonant with its
  subscripts attached, or a Khmer vowel sign. Everything downstream — the ring,
  the slots, `itemCount`, the worksheet blanks — counts tiles.
- **Answer judging** compares the joined tiles with the word in NFC, never the
  tile array with the pack's tile array. Two tilings that rejoin to the same
  word are both correct.
- **A valid non-target word is a bonus, not an error.** It never reaches
  `learning.answered`. Only the target and a non-word do. Validation is the
  bundled per-language lexicon, offline.
- **Backtracking** — dragging back onto the previous tile unlocks the last one.
  A refused move (a tile already used, not adjacent in the trace) shows nothing
  and records nothing; it is not a hint and not an attempt.
- **Three input routes** to the same word: pointer drag, sequential taps,
  keyboard focus plus Enter. `Backspace` unlocks. Tiles are real buttons with
  accessible names.
- **Start over** is required (§0.2): the ring holds built state. It clears the
  trace, reaches no `answered`, and appears only once a tile is locked.
- **Shuffle** re-orbits the tiles. It is a legitimate strategy for a stuck
  child — the same letters in a new arrangement read differently — and it is
  logged through `log()`, not `supportUsed`.
- **Boundary and impossible cases.** 2 tiles minimum, 8 maximum (a 9-tile ring
  will not hold a 44px touch target at 360px). A pattern with fewer than
  `questionsPerRound` matching words in every held pack repeats rather than
  hangs, as `withoutRepeat` does in addition. A pack whose word cannot be spelt
  from its own offered tiles is rejected at verification and can never reach a
  round.
- **Sentence mode** shows one sentence with its word replaced by a gap, and
  that sentence *is* the prompt — there is no second clue, and the picture is
  optional, because a word pulled out of somebody's uploaded text may have no
  artwork. The gap fills in as the word is solved or revealed. `taskKind` is
  `spell_word_in_sentence`, not `spell_word`: reading a sentence and reading a
  picture are different tasks and their response times should not average
  together.
- **A sentence is a reading load**, which is the whole reason lesson 13 sits at
  the end and carries an `ageBand` starting at 7. The sentence is recorded at
  publish and read aloud on request; a child who can spell the word but cannot
  yet read the sentence has a way through that is not a hint.
- **Distractors get the same presentation as the answer tiles** — same size,
  same weight, same treatment. Difficulty lives in how near a distractor is to a
  real letter of the word (the short-vowel twin in magic-e), never in making the
  answer tiles look different (§7).

### Trace motion — `internal/tracePhysics.ts`

Straight lines between locked tiles; one quadratic curve from the last locked
tile to the fingertip. The first build used a verlet rope with sag, and on a
ring it tangles: turn a corner and the chain folds back through itself, so the
trace reads as a knot. Straight is not a simplification, it is the correct read.

Three damped springs, one `requestAnimationFrame` loop, fixed 1/120s step with
an accumulator capped at four steps, nothing per-frame through React state:

| Spring | k | Notes |
|---|---|---|
| Drawn tip chases the finger | 1700, ratio 0.92 | a little give, not a lag you wait for |
| Curve bend, from the perpendicular component of finger velocity | 300 | capped at ±20px, so the line can never cross itself |
| Tile scale and radial offset | 420, critically damped | one ≈6% overshoot on lock, a smaller inward kick on a wrong word |

`prefers-reduced-motion` sets bend and lag to zero, makes the springs instant
and the shuffle a cross-fade. The game does not lose a feature. Read it through
`useMotionOK` from `kit/motion.ts`, never a private media query, and keep the
constants in this one file the way `additionLayout.ts` holds apparatus sizes.

### Speech

Audience starts at 5, so `voice.json` keeps `speaksPrompts: true` and the lesson
`audioPrompt` is spoken (§0.1 applies to skills starting at 7). But the word
itself is **the question, not a prompt**: in `listen` mode the recorded word is
the only statement of the task, and pressing Listen there is `supportUsed("replay")`
only in the sense that it repeats — it must not be scored as help in a picture
round either, where the picture already carries the question. Gate every
`speech.say()` this engine makes on `audio_speech` itself; the kit only covers
the intro, the hint line and the reactions.

### Worksheet

`picture` and `mixed` print: the artwork as the figure, the clue as the prompt,
one blank per tile, the answer key from the pack. `listen` returns `null` — a
printed sheet cannot ask a child to spell what they hear, and substituting the
clue would change the task (§11.1). Khmer sheets print only where the pack has a
figure; the blanks are tile-shaped boxes, not a single ruled line.

## Content Studio — release 1 is admin-authored

The operator surface, gated on `content:write`, modelled on the existing art
library (`server/app/routers/art.py`) and the art generator in `server.ts`. The
key never leaves the server, the model returns data, and a person decides to
keep it — exactly what `/api/art/generate` already does with drawings.

Pipeline: **bring content → draft → verify → review → publish → sync → play.**
Two ways in, one pipeline; both end at the same review table.

**Way in 1 — pick a topic.** A short list of ready topics plus free text, a
language and a size. `POST /api/themes/draft` takes topic text, language, target
patterns and a count; returns candidate words with gloss, clue and an art prompt
each. Fastest way to fill a pack, and the clues are invented rather than met.

**Way in 2 — upload your own sentences.** `POST /api/themes/ingest` takes plain
text (≤200KB, ≤2000 sentences, one language) and returns the same candidate
shape, with two differences: each word carries the sentence it came from, gapped
around it, and nothing is invented. A page of the reader a class is actually
using becomes a spelling pack whose clues are sentences the child has already
met. Splitting is per language:

- English splits on whitespace and punctuation.
- **Khmer has no spaces between words.** Splitting goes through
  `Intl.Segmenter("km", { granularity: "word" })` — ICU's dictionary breaker —
  and it is *good, not right*: on `ស្វាចូលចិត្តញ៉ាំចេក។` it returns
  `ស្វា · ចូល · ចិត្ត · ញ៉ាំចេក`, merging the last two words. So the review
  screen lets the admin merge and split, and the verifier only accepts a
  candidate that is in the bundled Khmer child lexicon. Treat the segmenter as a
  proposal a person corrects, never as an answer.
- Uploaded text is somebody's writing on its way to a child's screen: it takes
  the same review gate as a generated pack, and any instruction-shaped text
  inside it is data, never a prompt.
- Verification is the same code for both routes and re-derives everything the
  model or the text claimed: the pattern from the word, the tiles from the word,
  that the offered multiset can spell it, tile count 2–8, presence in the
  bundled child lexicon, and no duplicate already published in that language. A
  word that fails is shown with its reason, not silently dropped. An ingested
  word has one more check: the gapped sentence must re-join to the original
  sentence exactly.
- Artwork per word goes through `/api/art/generate` in house style, so a pack is
  bundled-weight SVG in one palette rather than photographs.
- Audio is recorded at publish through the existing voice pipeline — per word,
  and per sentence for anything sentence mode will show. A round that needs the
  network to say a word fails on a bus.
- **Publish freezes a revision.** Words, tiles, clue text, art and clips are
  immutable; re-generating makes revision 2. A device on revision 1 keeps
  playing it until it syncs, because a pack that changes under a child mid-round
  can contradict its own answer key.
- Sync is versioned and deadlined (`packs?since=rev`, 4s); the answer on timeout
  is the packs already held. Play reads the local store only.

## What this deliberately does not copy from the reference screen

| Reference | Here | Why |
|---|---|---|
| Cream and amber chrome | Koda surfaces, indigo primary, emerald correct, rose wrong | `THEME.md`: no amber and no yellow anywhere; the reference palette is a yellow on a yellow on this app's surface |
| Coins, Reveal 15, Magnet 20 | Helps free, unlimited, logged | A priced hint stops the child who needs it most; the log already tells an adult the word was hard |
| Stars, LVL 1/32 | Lesson number and word position; XP stays host-owned | §3 and §12 — a skill never owns XP, and "Level" already means the XP level |
| Photographic subject | House-style SVG | licensing, weight, and no offline story |
| Bonus words | Kept | the best idea on the screen; it only needed the rule that a bonus is not an error |

## Delivery

Build in this order; each phase ends playable.

1. **The wheel.** One engine, picture mode, English, `core-starter`, all three
   input routes, the hint ladder, start over. Lessons 1–5 and P1 end to end.
2. **The trace.** `tracePhysics.ts` extracted and tuned, reduced-motion path,
   360px and dark checked in the running app at `localhost:3001`, shuffle, bonus
   tray, sound and haptics through the SDK.
3. **Lessons 6–13,** listen, bonus, mixed and sentence modes, P2 and P3, the
   worksheet adapter — sentence mode prints as a cloze sheet, the one mode that
   prints better than it plays — and course units appended.
4. **Khmer.** `segment.ts` and its table tests, `sentences.ts` word splitting
   with the admin's corrections, Noto Sans Khmer, K1–K6 and KP, recorded Khmer
   audio.
5. **Content Studio.** Topic draft route *and* sentence ingest route, the shared
   verifier, the review screen with merge/split for Khmer, publish and freeze,
   per-word art and audio, pack sync and the local store.
6. **Release.** Full validation matrix, an offline round on a real device,
   `npm run voice:plan -- --skill word-trace` at zero missing, draft → published
   in Skill Manager.

Evidence for each check goes in the
[validation matrix](SKILL_DEVELOPMENT.md#11-validation-matrix); the rows this
skill adds to it are the segmenter table tests (40 English, 40 Khmer, both
directions), the pattern verifier rejecting a mislabelled generated word, and an
assertion that a bonus word never reaches `answered`, and a round-trip test that
an ingested sentence gapped around its word re-joins to the original.
