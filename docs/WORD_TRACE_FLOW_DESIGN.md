# Word Trace — flow design

> **Superseded on structure (2026-09-22).** The reading feature is now **Koda Library**, an independent module — not a skill. See [KODA_LIBRARY_BUILD_PLAN.md](KODA_LIBRARY_BUILD_PLAN.md). Anything below about registering a skill, container lessons, `src/skills/word-trace/` or lesson locks for books no longer applies. Screens, the passage format and the eight checks still do.

The concrete flow for Word Trace once it teaches **reading as well as spelling**.
A proposal to review before anything is built. A clickable version is in
[word-trace-spec.html](word-trace-spec.html). The pattern ladder, Khmer tile rule
and trace behaviour in [word-trace-spec.html](word-trace-spec.html) and
[WORD_TRACE_BUILD_PLAN.md](WORD_TRACE_BUILD_PLAN.md) stand; where this page and
those disagree about *flow*, this page wins.

## 1. The shape

One skill, one library, two kinds of card.

```
                        WORD TRACE
             ┌────────────────┴─────────────────┐
        LEARN (curriculum)                TOPICS (content)
        bundled lessons 1–13, K1–K6       published passages
        "spell this pattern"              "read it, then answer"
             └──────────► same wheel ◄────────────┘
```

- **Lesson cards** are what is already planned: a fixed ladder of spelling
  patterns, played straight away.
- **Story cards** are new: the learner **reads first**, then answers questions
  about the story, then spells words taken from it.
- A **passage** is the unit of content. One authored passage produces the reading
  screen, every question and every spelling word, so it is authored once.

Rule kept from before: *a passage is content, a lesson is a constraint.* Lessons
stay bundled and ordered; passages are published at runtime and never reorder a
course.

## 2. The learner journey (Topics)

```
Shelf ─► Read ─► Understand ─► Words ─► Spell ─► Results ─► (Shelf)
 pick     no      3 choice      2 pic    5 gapped   what to
 one    score     questions     match    sentences  practise
```

### S1 · Library — category cards, one card per lesson or story

```
┌ Word Trace                                        EN │ ខ្មែរ ┐
│ ▍Short sounds                                    1 / 2 done │
│   ┌ 1 ────────────┐ ┌ 2 ────────────┐                        │
│   │ Short a Words │ │ All Five Short │                       │
│   │ picture·5–6   │ │ Vowels         │                       │
│   │ spell-cvc-a   │ │ spell-cvc-short│                       │
│   │ Done ✓ 2/3    │ │ New            │                       │
│   └───────────────┘ └────────────────┘                        │
│ ▍Stories                                         0 / 2 done │
│   ┌ T-A ──────────┐ ┌ T-B ───────────┐                        │
│   │ [picture]     │ │ [picture]      │                        │
│   │ At the Market │ │ A Rainy Day    │                        │
```

- **The home screen is one library with two tabs.** *Lessons* is the card grid below;
  *Books* is a reading-library catalog — covers on shelves (Continue reading, Just
  published, one shelf per category, one per level), category chips, search, and a book
  page with **Read**, **Read to me** and what the learner will do. Lesson cards are
  grouped into categories (Short
  sounds, Blends & digraphs, Long vowels & endings, Listen & challenge, Stories;
  in Khmer: Letters & vowels, Clusters, Stories). Each category shows its own
  progress.
- **A lesson card goes straight to the play screen** — a picture, the ring, the
  word. **A story card goes to Read first**, then the quiz.
- A card shows its number, mode, age band, the `conceptKey` it teaches, and a
  status in **words, not colour**: *New*, *In progress*, *Done ✓ 2/3 first try*,
  *🔒 Needs “…”*.
- **Locks follow `requires`.** A card opens once the concept it needs is done. The
  mock has a switch that turns locks off so a reviewer can try any card.
- A card that is designed but not built (lesson 11, K5) shows as such rather than
  being hidden — the library should not pretend to be finished.
- Stories are filtered to the learner's language and age band. Nothing
  downloaded and offline → the bundled starter story, never an empty library.

### S2 · Read — no score, no pressure

```
┌ At the Market                        ▶ Listen to all ┐
│ [picture]                                             │
│ ▶ Sokha goes to the market with her mother.          │
│ ▶ She buys a mango and two bananas.  ◄ playing       │
│ ▶ The mango is sweet.                                 │
│                                    [ I'm ready ▸ ]   │
```

- **Tap a sentence** → it plays, the row highlights (tint + left bar + ▶ icon, so
  it is never colour alone).
- **Tap a word** → the word is spoken and underlined; a small picture pops up if
  the word has one. A word with no recording shows text only — no dead speaker.
- **Listen to all** plays sentence by sentence, highlight advancing. Highlighting
  is per **sentence**, not per word: word-by-word karaoke needs a timestamp for
  every word of every recording, and Khmer has no reliable device voice, so clips
  are the only audio.
- **I'm ready** enables once the learner has *reached* the last sentence. It never
  requires listening.
- Reading is not a question. It sends no `answered` and has no verdict.

### S3 · Quiz — three parts, fixed order

Common frame: part label and count ("Understand 2/3"), a **Read again** button,
hints, and start-over where a board holds built state.

| Part | Count | Learner does | Input |
|---|---|---|---|
| **Understand** | 3 | answers a question about the passage | tap 1 of 3 choices |
| **Words** | 2 | matches a word from the passage to its picture | tap 1 of 3 |
| **Spell** | 5 | sees a passage sentence with a gap, spells the missing word | wheel (ages ≤ 8) or typing (older) |

```
 Understand 1/3                              [ Read again ]
 ───────────────────────────────────────────────────────
  Who went to the market with Sokha?
   ┌────────────┐ ┌────────────┐ ┌────────────┐
   │  Her dad   │ │ Her mother │ │  A friend  │
   └────────────┘ └────────────┘ └────────────┘
                                             [ Hint ]
```

```
 Spell 3/5                                   [ Read again ]
 ───────────────────────────────────────────────────────
  She buys a ________ and two bananas.        ▶ read it
              (ring of letters, the Word Trace wheel)
```

**Read again** slides the passage up over the quiz. The quiz is a reading skill,
not a memory test, so re-reading is allowed — and logged as support, so an answer
given after it counts as assisted, as any other help does.

**Hint ladder for a choice question** (a choice is never revealed, guide §4):

1. *Nudge* — "The answer is in the story. Try Read again."
2. *Point* — Read again opens with the **evidence sentence** highlighted.
3. *Narrow* — one wrong choice greys out (and says so in words).

**Wrong answer:** the question stays; that choice is marked ✕ with an icon, not
only colour, and cannot be pressed again. Right on the second try is logged as
exactly that.

**Spell** reuses the wheel unchanged. Its ladder is the existing one: clue →
first tile → reveal, where the "clue" is the whole passage sentence read aloud.

### S4 · Results

```
 You finished "At the Market"
 Understand 3/3     Words 2/2     Spell 4/5
 Words to practise:  [ mango ]
        [ Another story ]   [ Home ]
```

- Missed spelling words are listed. They are **shown**, not yet drilled — see §9.
- XP and stars are host-owned; the tool reports what was earned and shows the
  host's numbers, never its own.

### S5 · Parent

Nothing new to build here. Every question is logged with `expected`, so the
learning log can say *"Read 'At the Market' (Khmer). Understood 3/3, spelled 4/5,
missed: ស្វាយ"* for the planned parent progress notifications.

## 3. Difficulty bands

Koda covers grades 1–12, so difficulty is passage length and input type, not
cuteness.

| Band | Ages | Passage | Understand / Words / Spell | Spell input |
|---|---|---|---|---|
| **A** | 5–7 | 2–4 sentences, ≤ 8 words each | 2 / 2 / 3 | wheel |
| **B** | 8–10 | 5–8 sentences | 3 / 2 / 5 | wheel |
| **C** | 11+ | 9–15 sentences, paragraphs | 4 / 2 / 6 | **typed** |

Release 1 ships **A and B**. C needs its own review — a ring of letters reads as
a toy to a fourteen-year-old — and is deferred, not skipped by accident.

## 4. The content format

One JSON document per passage, frozen on publish. The example is Khmer because
that is where the format is most likely to be wrong.

```json
{
  "id": "market-01", "rev": 1, "language": "km", "band": "A",
  "title": "នៅផ្សារ", "picture": "market-01.svg",
  "sentences": [
    { "id": "s1", "text": "សុខាទៅផ្សារជាមួយម្តាយ។", "audio": "s1.m4a",
      "words": [ { "text": "សុខា" }, { "text": "ទៅ" }, { "text": "ផ្សារ", "audio": "w-phsar.m4a", "picture": "phsar.svg" } ] },
    { "id": "s2", "text": "នាងទិញស្វាយមួយ។", "audio": "s2.m4a", "words": [ "…" ] }
  ],
  "questions": [
    { "id": "q1", "kind": "comprehension",
      "prompt": "តើនរណាទៅផ្សារជាមួយសុខា?",
      "options": ["ឪពុក", "ម្តាយ", "មិត្តភក្តិ"], "answer": 1, "evidence": "s1" },
    { "id": "q4", "kind": "vocab", "word": "ស្វាយ", "options": ["mango.svg", "fish.svg", "cat.svg"], "answer": 0 },
    { "id": "q6", "kind": "spell", "sentence": "s2", "word": "ស្វាយ", "pattern": "kh_final" }
  ]
}
```

Two fields carry the design: **`evidence`** (the sentence that proves the answer —
it powers hint rung 2 and the review check) and **`words[]`** (the split the admin
approved, so tap-a-word never guesses at Khmer boundaries at play time).

## 5. What the verifier refuses to publish

Mechanical, before a person reads anything. Each failure is listed with its
reason, never dropped silently.

1. Every `evidence` sentence exists, and the correct option's key word appears in it.
2. **At least one** wrong choice uses the passage's own words; the rest are the
   same kind of thing as the answer (a person for a person). A choice from
   nowhere is eliminable without reading, so the check fails if *none* of them
   come from the passage. *(Revised while building the mock: the first draft
   required all of them to, and a "who" question with two people in the story
   produced choices like "who went with Sokha? — the mango".)*
3. The right answer is not the longest option.
4. A comprehension prompt is no harder to read than the passage: word count and
   the bundled child lexicon, per band.
5. Each spell word: 2–8 tiles, in the child lexicon, spellable from its own ring,
   and the gapped sentence re-joins to the original exactly.
6. No two questions share an answer or an evidence sentence within one part.
7. Every sentence has a recording; a word with none is allowed, with no speaker.
8. Khmer: the word split is one the admin **confirmed**. The segmenter only proposes.
   *(Seen in the mock: Chrome's ICU segmenter returns `នាងទិញ` — "she buys" — as
   one word. Fixing it means typing a space in step 1.)*

## 6. The authoring pipeline (Content Studio)

```
AI provider → write or paste the story → Generate → Review & modify → Preview → Publish
                                                                              ↓
                                       learners: Books catalog → book page → read · answer · spell
```

1. **Source.** The admin picks an **AI provider** (Gemini, ChatGPT or Claude), a
   language, an age band and a category, then writes or pastes the story into a text
   box. Changing the text or language starts a new draft.
2. **Generate.** The app builds one request and shows it: the story text, the six
   rules the app will check afterwards, and the exact JSON shape wanted back
   (`understand`, `words`, `spell`). The key stays on the server. The reply is
   **untrusted**: it goes through the eight checks before a person sees it, and the
   story text is treated as data, never as instructions.
3. **Review & modify.** Every question is an editable card — its text, its choices,
   which choice is right, its evidence sentence — with the checks re-running on every
   change. The admin can redraft one question, delete one, or add one, and confirm the
   word splits (mandatory for Khmer). A failed check blocks Publish.
4. **Preview.** Plays the draft, with the admin's edits, in the real learner player.
5. **Publish.** Freezes a revision, records sentence and word audio, and puts the book
   on its category shelf in the learner catalog as **NEW**. Re-editing makes revision 2;
   a child mid-quiz finishes on the revision they started.

**Provider.** Which provider drafts is a setting with an admin default; the caller can
choose another for one story. It follows the existing art generator: one server route,
the key read from the admin's settings or the environment, and a clear "not configured"
answer when there is none. The mock has no keys, so it says so and runs an offline
stand-in that builds its questions from the story's own words.

**What the stand-in taught us.** Built from nothing but a story's own words, the
offline generator produced valid drafts for three English stories on the first run. On
the Khmer story it did not, and the failure was upstream: the segmenter joined
`នាងទិញ` ("she buys") into one word, which made the right answer the longest option
and blocked Publish. **Redraft could not fix it. Correcting the split in Source could.**
A real provider will make different mistakes, so the checks and the review step are not
optional.

## 7. How it lands in Koda's structure

**An independent module, `src/library/`, reached by its own tab.** Not a skill. See
[KODA_LIBRARY_BUILD_PLAN.md](KODA_LIBRARY_BUILD_PLAN.md) for where it plugs in and what
it reuses.

- **No lessons, no manifest, no registry entry.** Books are published at runtime; there
  are no "container lessons" and no lesson locks. A book is gated by age band.
- **The ring is a shared component**, used here and by the spelling skill.
- **The spelling-pattern lessons stay a skill** — they are curriculum.
- **Practice** for a book is a later decision; release 1 has no ranked practice.
- **Offline:** a published book — text, pictures, recordings — is one downloadable unit.
  Play never fetches.

## 8. Telemetry and the learning log

| Event | When | `taskKind` |
|---|---|---|
| `startLesson` | Quiz begins (not when Read opens) | — |
| `present` / `answered` | every question | `comprehension_choice`, `vocab_match`, `spell_word_in_sentence` |
| `supportUsed` | hint rung, Read again, replay | — |

The mock's log panel shows exactly this, one timestamped row per event:

| Column | Meaning |
|---|---|
| Time | seconds since the round began |
| Event / Question / Task | the record, keyed by question id and `taskKind` |
| Detail | what was expected and given, the attempt number, and an **assisted** flag |
| Response | milliseconds from `present` to `answered` |

Above the table: the round's context (`skill`, `lesson`, `conceptKey`,
`ageBand`, `passage`, `rev`, `practice`, `entry`) and a summary — questions
shown, first try unassisted, wrong attempts, hints, replays, median first
answer, and **how many answers count for practice speed** (unassisted,
first-attempt, 700ms or more; ranking needs eight). Filters: all, questions,
help, lifecycle; a raw view; copy as JSON.

The three task kinds never average together: reading a sentence, matching a
picture and spelling a word are different skills and have different response
times. Reading time goes through `log()`, which is for diagnosis, not judgement.

## 9. Edge cases

| Case | Behaviour |
|---|---|
| Offline, nothing downloaded | Bundled starter passage |
| Left mid-quiz, came back | Resume at the same question, on the same revision |
| Passage republished while a child is in it | Finishes on the revision they started |
| Word has no recording | Text only, no speaker button |
| 360px, long passage | Page scrolls; the picture never pushes the sentences off-screen |
| Reduced motion | Sentence highlight stays; slide-up becomes a fade |
| Wrong answer repeated | Pressed choice stays marked and locked; question does not skip |

## 10. Not in release 1

- **Drilling missed words.** Results *list* them. Turning that list into a round
  needs a runtime deck outside the bundled-lesson model — decide it deliberately.
- **Band C** and typed spelling for older learners.
- **Word-by-word highlighting.**
- **Learner- or parent-authored passages.** Release 1 is admin-authored.

## 11. Decisions I need from you

1. **One skill or two?** I have assumed one skill with two doors. Splitting
   changes the folder layout and puts the wheel in `kit/`.
2. **Is Read again allowed during the quiz?** I say yes, logged as support. The
   alternative makes it a memory test.
3. **Who writes the first three passages?** Two English and one Khmer are needed
   before the format can be judged, and they should not be model-written.

## 12. Build order

1. Format plus three hand-written passages, including one Khmer.
2. Reader, then quiz, on hand-written data. No studio.
3. Verifier as pure functions with tests, run over those three passages.
4. Content Studio last, so it is shaped by what steps 1–3 showed it needs.
