# Koda Library — build plan

A reading library for children: a catalog of short stories, each with a read-aloud
page, a comprehension quiz, a picture-word match and a spelling round, written by an
admin (with an AI provider's help) and played offline. Design mock, clickable:
[word-trace-spec.html](word-trace-spec.html). Flow and screens:
[WORD_TRACE_FLOW_DESIGN.md](WORD_TRACE_FLOW_DESIGN.md).

## The decision this plan rests on

**Koda Library is a new module of Koda, not a skill.** Decided 2026-09-22.

- Skills teach a **curriculum**: lessons are bundled with the app, ordered, gated by
  prerequisite concepts, and registered in `registry.ts` and `course.json`.
- A library holds **content**: books are published at runtime by an admin, browsed like
  a shelf, and never reorder or unlock anything.
- Forcing books into the lesson model needed invented "container lessons" and a lock
  rule that made no sense for a book. Standing on its own removes both.

Two names, so nobody conflates them: **Koda Library** is the module; **Word Trace** is
the letter-ring game inside it.

The **spelling-pattern lessons** (short a … magic e, and the Khmer ladder) *are*
curriculum. They stay a normal skill, built later on the shared ring, on their own
schedule.

## Where it plugs in

| Concern | Where | Notes |
|---|---|---|
| Learner page | a new `TabId` in `src/components/navTabs.ts`, rendered from `App.tsx` | the shell is tab-based; a tab is how a module gets on screen |
| Code | `src/library/` | not `src/skills/`, not the empty `src/features/` |
| Admin authoring | a second tab, gated like the art library | `content:write` |
| Server data | `server/app/routers/library.py`, Mongo, modelled on `art.py` | reads on `settings:read`, writes on `content:write` |
| AI provider call | `server.ts`, beside `/api/art/generate` | provider choice, keys from admin settings or env, "not configured" answer |
| Learning record | `src/lib/learning` | reuse; see the open question below |
| XP and progress | `src/lib/learnerProgress.ts` | the host owns the total, as for skills |
| Recorded voice | `src/lib/voiceClips.ts`, `src/voice/` | recorded **at publish**, never live |
| Offline | the pattern in `src/lib/offlineSkill.ts`, the PWA cache | a published book is one downloadable unit |
| The letter ring | a shared component, used by this module and by the spelling skill | Phase 1 |

## Open questions

1. **The learning log is maths-shaped.** `ErrorKind` is `off_by_one`, `place_value` and
   so on, and events are keyed by `conceptKey`. Proposal for v1: report literacy errors
   as `unknown` with the right `expected`/`given`, and add literacy kinds
   (`letter_order`, `missing_letter`, `wrong_word`) only once there is real data to
   decide their shape. Confirm in Phase 2 what `tracker.ts` requires of a session that
   is a book and not a lesson.
2. **Who can see it.** Family controls and age band decide the catalog a child sees;
   confirm against `featureGate.ts` in Phase 2.
3. **Who writes the first three stories.** Two English and one Khmer, by a person. The
   Khmer must be read by a native speaker. The starter stories in Phase 0 are
   placeholders for that, and say so in their data.
4. **Moderation.** A child reads what an admin publishes. The design already has a
   person approving every book; decide whether there is also a "report this" path.

## Phases

### Phase 0 — Data groundwork · nothing registered, no UI · **done**

**Try it:** `docs/koda-library-phase0-check.html` runs the real data layer in a browser.

| | |
|---|---|
| **Goal** | Every rule the module depends on exists and is tested before any screen |
| **Creates** | `src/library/data/{passage,tiles,text,verifyPassage,spellingDeck,starterPassages}.ts`, their tests, three starter stories under `passages/` |
| **Changes** | nothing outside `src/library/` |
| **Depends on** | nothing |

**What is in it**

1. **`passage.ts`** — the one document a story is: sentences with their approved word
   split, questions that each say where their answer lives (`evidence`), a picture map,
   and the exact number of each question a band requires.
2. **`tiles.ts`** — what a learner spells with. English letters; Khmer *clusters* (a
   base consonant plus its subscripts, and every vowel sign and sign as its own tile).
   `whyUnspellable` refuses a word that cannot be drawn, with the reason.
3. **`text.ts`** — pasted text to sentences and words, with the Khmer word breaker
   injectable, and `gapOf`, the sentence with one word blanked.
4. **`verifyPassage.ts`** — the eight checks as a pure function, plus rule 0 ("is this
   even a passage"). A check that could not run says *skipped*, never *pass*.
   Rules 1 and 2 compare a choice against the story by word. English splits on spaces,
   so they stem ("raining" answers for "rained"); Khmer does not, so a whole clause came
   back as one token and a four-letter stem only ever saw its opening — a distractor
   sharing a word in the *middle* read as story-free and rule 2 failed honest questions.
   For a script that writes without spaces they use the story's own splits, the ones
   rule 8 already makes a person confirm. **The server has its own copy of this**
   (`server/app/library_verify.py`, `_draws_on`) and had the same bug, so a Khmer book
   the studio showed as green was still refused at publish. The two must stay identical:
   the client shows the author a verdict and the server decides, so them disagreeing is
   the worst outcome of all.
5. **`spellingDeck.ts`** — a story's spelling words ready for the ring. A story that
   cannot be played throws rather than reaching a child.
6. **Three starter stories** (two English, one Khmer) as JSON, checked by the same
   verifier as everything else.

**Done when** — `npx vitest run src/library` is green; every rule has a test where a
story broken in exactly that one way fails it. The app is unchanged because nothing is
registered, and that is correct.

**Wrong if** — a rule can be turned off without a test noticing. This was checked by
mutation: rules 2, 3 and 8 were each disabled in turn and each was caught by the test
written for it.

**What Phase 0 caught.** Nothing in the code — but three of the first tests were wrong,
and each was a mutation with a side effect the test had not accounted for: changing a
word broke the gapped sentence as well as the words-rejoin check; a toy lexicon
omitted words from *other* questions; replacing "market" broke the picture question
that used it. The verifier was right each time. Worth remembering: a check that fails
two rules at once is often correct.

**The drafters both emit exactly the band's counts.** `draftLocally` always did;
`fromModel` took every valid question the model returned, so an AI that sent four
spelling words for a band wanting three produced a draft that could not be published
until the author worked out which to delete. Publish now also names which count is wrong
and by how much, rather than "the question counts do not match the band".

### Phase 1 — The ring, shared · **done**

`src/components/wheel/` — `LetterWheel.tsx` plus three pure modules it is built from:
`wheelLayout.ts` (geometry), `traceModel.ts` (what a drag, tap or key does to the trace)
and `tracePhysics.ts` (three damped springs and one Bézier). No dependency on the library
or on any skill: it reports a trace and shows the verdict it is handed back.

Drag submits on lift and unwinds when the finger goes back; taps build a word and submit
with *Check* or at `autoSubmitAt`; the keyboard does everything a finger does. Start over
is never an attempt. Reduced motion draws the ring straight from state, with identical
behaviour — which is also how it runs under test.

**Try it:** `docs/letter-wheel-demo.html` (built by `node scripts/build-library-pages.mjs`)
spells the Phase 0 starter stories with the real component.

**What Phase 1 caught.** In a real browser at 360px: the floating word chip landed on the
top tile, the drawing box kept space for buttons that had moved out of it, and in dark
mode an unchosen tile's edge matched its own fill and disappeared. All three are fixed.
None of them could have shown up in a jsdom test.

### Phase 2 — Catalog, reader and quiz, on the starter shelf · **done (English checked in the app)**

`src/library/LibraryPage.tsx`, reached from a **Library** row in the menu (`navTabs.ts`,
`sidebarNav.json`, `server/app/menu_defaults.py`, `App.tsx`). Catalog with shelves,
category chips, search and an English / ភាសាខ្មែរ switch; book page; reader (tap a word, read
to me where a voice exists); quiz — Understand, Words, Spell on the ring — with the three-rung
hints and Read again; results with stars, XP and the parent summary.

Logic is pure and tested (`session.ts`); progress is per learner and per revision
(`progress.ts`); the learning log gets the same five calls as a lesson (`learning.ts`); voice
follows the SDK's rules and never reads Khmer with an English voice (`voice.ts`).

**Adding the menu row needs an API restart** — the server seeds its menu at start-up.

**What Phase 2 caught.** In the running app the reader said "no voice for this language" for
English: the account had Koda's Voice switched off. Silence was right; the reason was wrong. It
now says the voice is off in Settings.

**Not yet checked in the running app:** Khmer, 360px and dark mode (covered by tests and the
Phase 1 ring checks, not by a pass through this page). Not built: resuming mid-quiz at the same
question — leaving restarts the quiz.

### Phase 3 — Server and Library Studio · **done, checked end to end in the app**

**Server.** `server/app/routers/library.py` (`/v1/library`): readers get the live revision of
every published book (`settings:read`); authors save drafts, publish, unpublish and delete
(`content:write`). `library_books` holds the draft and the live copy; `library_revisions` keeps
every published revision, immutable. Publishing runs `server/app/library_verify.py` — a Python
port of the eight checks — so the browser cannot put a book on a shelf the server would refuse.
The starter stories are copied into `server/tests/fixtures/library/`; a vitest test fails if the
copies drift, and both suites assert the same verdicts on them.

**AI drafter.** `POST /api/library/draft` in `server.ts`, beside the art generator: asks the data
API whether the caller may author (`/library/can-author`), honours the `ai.libraryDrafts` switch,
uses `ai.libraryProvider` (falling back to the art provider, then Gemini), keeps the key in the
server, tells the model the story is data, and returns the reply as an untrusted draft.

**Library Studio** (`src/library/studio/`, menu row "Library Studio", `content:write`): Source
(provider, language, band, shelf, title, story) → Generate (AI, or the **offline drafter**, which
builds questions from the story's own words and needs no key) → Review & modify (every question
editable, word splits mergeable, Khmer confirmation, the checks live) → Preview (the real player,
recorded as `preview`, no progress or XP) → Publish.

**Devices.** `bookStore.ts` keeps the published shelf in localStorage and refreshes it with a 4 s
deadline; offline, the last shelf stands. A published book with a starter's id replaces it.

**What Phase 3 caught.** In the running app, Gemini's draft of a four-sentence story gave one
question whose two wrong choices were not in the story ("drive a car", "ride on a bus"). Check 2
refused it; editing one choice to use the story's words let it publish. This is the pipeline doing
its job, and the reason review is not optional.

Also: the offline drafter could make the right answer the longest choice until it was given the
mock's strict first pass back; and a story with only one drawable word cannot make a two-picture
Words part — the drafter says so rather than inventing a picture.

### Phase 4 — Recordings (optional) and Khmer · **done, checked in the app**

**Recordings are optional.** A book publishes and plays without any; a sentence with a recording
is read in that voice, one without is read by the device's voice where it has one. Rule 7 never
fails — it reports how many sentences are recorded. The server refuses only a book that points at
a clip that was never uploaded.

- **Storage.** `library_audio`, content-addressed: a clip's id is the SHA-256 of its bytes, so the
  same recording is stored once and never changes under a published book. `POST /v1/library/audio`
  (authors, WAV/WebM/Ogg/MP4/MP3, ≤ 2 MB), `GET /v1/library/audio/{id}` (every reader, marked
  immutable).
- **Studio → Voice (optional).** Per sentence: **Record** a person with the microphone, **AI** voice,
  play, remove; "AI voice for the rest" for a whole English book.
- **AI voice route.** `POST /api/library/voice` in `server.ts`: author-only, its own switch
  `ai.libraryVoice`, a plain story-reading prompt, English only. Deliberately *not*
  `/api/tutor/speech`, which is Koda speaking to children live behind the children's `ai.speech`
  switch and a maths-coach prompt.
- **Devices.** `clips.ts` fetches a book's recordings when its page opens and keeps them in Cache
  Storage, so a book opened once online reads aloud offline. Playback respects the learner's
  "Koda's Voice" switch.
- **Khmer font.** Noto Sans Khmer (`@fontsource/noto-sans-khmer`, OFL), loaded only by the library
  pages and split by `unicode-range`, precached for offline.
- **Khmer review.** The split confirmation now reads "A Khmer reader has checked the text and every
  split". The starter Khmer story still says in its data that it has not been reviewed.

**What Phase 4 caught.** In the running app the AI voice was silent: this deployment has
`ai.speech` switched off. That switch is about Koda talking to children live, so the library got its
own route and switch rather than silently depending on it. And the starter stories carried
placeholder recording names (`s1.m4a`) that were never files — removed, since a book pointing at a
missing clip is now refused.

### Phase 5 — Release pass · **done**

**Validation.**

| Check | Result |
|---|---|
| `npm run lint` (tsc over ~830 files, plus the worker) | 0 errors — one real error in a test mock was found and fixed |
| `npm run build` | passes; the library ships as its own lazy chunks (reader 58 KB, studio 40 KB), precached with the Khmer font for offline |
| Full app suite (`npx vitest run`) | 4,150 tests in 253 files pass; 429 in `src/library` + `src/components` after the Phase 5 changes |
| Full server suite (`pytest`) | 715 passed, 11 skipped, 0 failed |

**Offline.** `src/library/offline.test.ts`: the shelf is never empty on a device that has
never been online; a failed refresh keeps the last shelf; published books survive a reload; a
published book can correct a starter; progress is per child and per revision and never moves a
finished book backwards; a saved recording plays with no network.

**Parent report.** Library reading reaches the parent's child report through the same learning
log as lessons. Library concepts now have readable names there ("Reading a story, then answering
and spelling (ages 5–7)") instead of raw keys.

**Moderation.** A quiet "Report a problem with this book" link on the book page (four reasons and
an optional note) goes to `POST /v1/library/books/{id}/reports`; authors see open reports on the
Library Studio list and in the editor, and resolve them. Only authors can read reports.

**Accessibility, phone and dark.** Audited at 386 px in dark mode inside the running app: every
control has a name; no horizontal overflow; category buttons and tappable words raised to the 44 px
floor; the quiz progress labels no longer run into their counts.

**What Phase 5 caught.**
- "I’m ready" could stay locked where a browser pauses the visibility observer. It now also
  unlocks on a scroll check and, whatever happens, after a few seconds a sentence.
- Guarded pages (Art, Menu, Roles, Library Studio…) bounced to Home when clicked in the first
  moment after load, because the guard ran before the permission table had loaded. The guard now
  waits for it; the pages themselves were already hidden until their permission was confirmed.
- The memory note that type-checking was broken was out of date; it is not.

**Not done in this pass.**
- An offline round on a *real* device with the network switched off (covered by tests and the
  offline cache, not by a hand test on hardware).
- A native Khmer reader has not checked the starter Khmer story; its data still says so.
- A screen for single-word recordings (the data format and playback support them).

## Not in release 1

Band C (ages 11+, typed spelling); drilling missed words; word-by-word highlighting;
learner- or parent-authored stories.

## After Phase 5 — the book reader (2026-09-22)

The reader is now a book (`src/library/BookReader.tsx`), for both children and the studio's Preview:

- **Pages** come from `bookLayout.ts`. Band A has 2 sentences a page, band B has 3, and a sentence is never split. Page 0 is the cover, with the book's picture edge to edge. A story page shows the picture of its first pictured word. An English "Setting Out:" lead is shown as a small heading.
- **Emphasis**: quiz words (Words and Spell) are **bold** and keyboard-focusable. Names are *italic*: listed `noRecording` names anywhere, or capitalised words that don't start a sentence or speech.
- **Turning** uses `pageTurn.ts`. The sheet hinges on the spine and follows the finger, and a spring (stiffness 170, damping 21) finishes or reverts the turn. A flick over 0.45 px/ms decides it; otherwise the page must be carried 35% of the way. Shading, cast shadow and curl follow the angle. The arrows and ← → keys use the same spring. With reduced motion the page simply changes.
- **Reading**: black and white, a serif for English and Noto Sans Khmer for Khmer. Type grows with the screen, and A− / A+ gives five sizes (0.85–1.5×), remembered per device in `koda_library_text_v1`. The page arrows stay pinned above the phone tab bar.
- **I'm ready** is on the last page. Turning every page is the rule, so the old scroll observer and time limit are gone.

### Pages & pictures (Studio step 4)

- Authors see the book as the reader lays it out: the cover plus one card per page. Each page can be given any picture from the art library, "No picture", or left on Automatic (the picture of the first pictured word on the page).
- A page's choice is stored as `Sentence.picture` on the page's first sentence: a key, or `null` for none. If the pages later reflow, the picture stays with its words. The cover is `Passage.picture`.
- The server accepts only picture keys (`[a-z0-9][a-z0-9-]{0,63}`), or null for a page.
- **Clicking a page card opens the picture drawer** (`PicturePanel`) from the right, and nothing before it: there is no panel beside the pages, and the art library — a Mongo collection that grows without bound — is fetched when an author says they want to look, not on the way into the step. Everything for that page lives in the drawer: Automatic/No picture, where the picture sits, the pictures of the page's own words, the photos already in this book.
- The drawer offers three ways: **Library** (All pictures, Story art, Built-in — the reader's own `PICTURE_KEYS` — then every collection the library actually holds, read from it rather than listed by hand; 20 tiles at a time, "Load more" for the rest), **Draw one** (a prompt to `/api/art/generate`), and **Upload** (a photo from the device). Picking one closes the drawer; changing where the picture sits does not.
- **"Draw one" opens with a finished instruction, not a blank field.** The caller (a page,
  the cover, a Words question) builds the prompt from what it actually is: a page seeds
  `Illustrate this line from the story: “<the page's own text>”`; the cover seeds
  `A cover illustration for the story titled “<title>”`; a Words question's right-hand
  picture seeds `A single, clearly recognisable picture of “<word>” — one plain object,
  centred, no background scene` — distinct from a page's scene-illustration instruction,
  because a vocab tile is an icon and a page is a scene. A wrong picture seeds nothing:
  naming the word there would draw the very thing that slot must not be. The field stays
  editable and is only ever seeded once, at the drawer's first open (`PicturePanel`'s
  `promptSeed` prop).
- **The house system prompt (`server.ts`, `ART_BRIEF`) no longer says "a children's maths
  app".** It served every asset generator in Koda already — the Art page's editor and this
  drawer both — so a story's cover kept coming back with a stray "1+2=3" baked into it. It
  now names Koda generally and says explicitly not to add numbers or maths symbols unless
  the subject itself is one.
- **Drawing runs the Art page's pipeline, because it writes to the Art page's collection.** `inspectSvgMarkup` (shared in `utils/svg`, used by both surfaces) reports what the sanitiser will drop and refuses a document that will not render; the markup is stored as `preprocessSvgMarkup` normalised it; the author names it and files it under a category, `story` by default. A picture drawn in the studio is on the Art page the moment it is saved, indistinguishable from one drawn there.
- Anything drawn is saved to the art library under a name, because a book stores a key rather than a picture. Saving under a name that already exists replaces that art everywhere — the drawer says so before it does it. That is also how a house drawing like `banana` is changed for good: the pencil on a tile opens it to be drawn again under the same name, and the saved art then wins over the one shipped in `Picture.tsx`.
- Page pictures don't affect the quiz. A Words question's picture still comes from `pictures`.
- **A closing quote is not a sentence.** `splitSentences` broke after the `!` in `…ស្អែក!»`
  and left the `»` as a sentence of its own — a page with no words on it, and in English a
  line starting with a stray `"`. The split is now taken after any closer that follows the
  stop. For the books that already have one, each line in the Word splits panel has a
  **join-to-the-line-above** control (`joinSentences` in `src/library/draft.ts`): it keeps a
  picture from either half, keeps one recording but never claims a stitched one, and
  re-points the questions that named the sentence that is gone. Going back to Source would
  have worked too, and would have thrown away every question.
- **A Words question's three pictures open the same drawer** (Review & modify). Tapping one calls `withVocabPicture` (`src/library/draft.ts`), which keeps both rules the verifier cares about: a picture already in another slot is *swapped* rather than duplicated (rule 0 wants three distinct), and changing the right-hand one rewrites `pictures[word]` too before re-pointing `answer` at it (rule 1 wants `options[answer] === pictures[word]`). Because `pictures` is book-wide, the drawer says so on the right-hand picture before it is changed. `photosOf` now also scans `pictures`, so a photo used as a word's picture is offered back for reuse and is prefetched for offline.

### Photos and picture position

- **Photos**: `POST /library/images` accepts JPEG, PNG or WebP up to 3 MB and checks the file's first bytes, so SVG or HTML is refused. `GET /library/images/{id}` serves them with `nosniff` and an immutable cache. The id is the SHA-256 of the bytes, stored in `library_images`. A book refers to a photo as `photo-<id>` anywhere a picture key goes (cover or page). Publishing is refused if a photo was never uploaded.
- The studio shrinks a photo to 1600px on its long side and saves it as JPEG before upload. `src/library/photos.ts` caches photos in Cache Storage `koda-library-photos-v1`, and the book page prefetches them for offline reading. A photo that can't load shows the plain book picture.
- **Position**: `Sentence.pictureAt` is top, bottom, left or right (absent means top), stored with `picture` on the page's first sentence. Left and right sit side by side from `sm:` up. On a phone, left goes above the words and right below them.

## Khmer spelling algorithm (from the Keyman "Khmer Angkor Keyboard" guide)

`src/library/data/khmer.ts`, ported to `server/app/khmer_spelling.py`. Both are held to the same cases in `khmer-cases.json`, and the server's copy of that file must match byte for byte.

- **Spelling order**: consonant, then subscript(s), then shifter, then vowel, then sign, then diacritic. `normalizeKhmer` applies the guide's silent corrections:
  - a subscript comes before the vowel;
  - ◌្រ comes after any other subscript;
  - the shifter comes after the subscript and before the vowel;
  - nikahit (◌ំ) comes after ◌ុ or ◌ា;
  - ◌េ + ◌ា becomes ◌ោ, and ◌េ + ◌ី becomes ◌ើ;
  - ◌្ដ goes under ណ and ◌្ត under ន;
  - ◌ុ plus an above vowel becomes the consonant's shifter: ◌៉ for ង ញ ន ម យ រ វ, ◌៊ for ស ហ អ. ប takes either, so it's left for a person.

  It runs on authored text: every story sentence, every model-drafted word and every spelling word. It is **not** run on a child's answer: tiles chosen in the drawn order (◌ែ before ◌្ម) are wrong, even though they render the same, because that order is the lesson. A zero-width space counts as a word break.
- **Constraints** (`khmerProblem`): two vowels on one syllable, two shifters, two subscript signs or one with no consonant, and a bantoc after a vowel, sign, shifter or subscript. These are reported by check 5.
- **Tiles** (`spellingUnits`) follow how a Khmer class spells:
  - consonant · each subscript (◌្វ) · shifter · vowel · each sign;
  - the compound vowels ◌ុំ ◌ាំ ◌ុះ ◌េះ ◌ោះ are one tile each;
  - so ស្វាយ is ស · ◌្វ · ◌ា · យ, and ខ្មែរ is ខ · ◌្ម · ◌ែ · រ.

  Mark tiles are drawn on a dotted circle (`unitLabel`).
- Not applied: the guide's "Mistyped characters" table, because its glyphs didn't survive text extraction and guessing them would be wrong.

### Coaching Khmer spelling (`src/library/data/khmerCoach.ts`)

- **Names**: each unit has its classroom name. A consonant is its own name; ◌្ម is ជើងម; a vowel is ស្រៈ with the vowel on អ (◌ែ is ស្រៈអែ); shifters and signs have their names (មូសិកទន្ត, បន្តក់ …). A native speaker should review these, the sign names especially.
- **Hints follow the trace**: hint 2 marks the next unit needed on the ring and names it ("Next: ជើងម (◌្ម)"). If the trace has gone wrong, it goes back to the first unit. Hint 3 spells the word out by name.
- **Order feedback**: when a wrong answer has the right units in another order, the child is told the rule, e.g. "ជើងអ (◌្អ) comes before ស្រៈអែ (◌ែ), even though ◌ែ is written on the left".
- **Decoys**: a Khmer word gets up to two spare tiles when there is room, chosen from what children confuse:
  - first, a vowel's look-alike (◌ិ/◌ី, ◌ុ/◌ូ/◌ួ, ◌េ/◌ែ/◌ៃ, ◌ុំ/◌ាំ …);
  - then a foot's look-alike (◌្ដ/◌្ត), its series pair, or its own consonant as a full letter;
  - then a consonant's series pair (ក/គ, ត/ទ, ប/ព …).

### Word forming, recorded names, levels

- **Word forming**: while a Khmer word is traced, the sentence's blank shows the partial word. A panel shows it large, with each piece named underneath. When the piece just chosen is drawn on the left of what's already there (◌ែ after ផ្អ), a note says it's written on the left but spelled after (`drawnLeftNote`).
- **Recorded names**:
  - The server keeps one clip per spelling unit in `library_unit_voices`, keyed by the unit rather than its name, so a corrected name keeps its recording.
  - Endpoints: `GET /library/unit-voices` for readers; `PUT /library/unit-voices` with `{unit, clip|null}` for authors. The unit must be exactly one spelling unit, and the clip must already be uploaded.
  - The device keeps the list in `koda_library_unit_voices_v1` and refreshes it with a 4s deadline. Clips are cached with the book recordings, and a spelling question prefetches its ring's clips.
  - A piece is named aloud when chosen and at hint 2. The order of preference is the recording, then the device's Khmer voice, then silence.
  - Studio → **Khmer sound names** lists all 117 units, grouped, with the units used by the studio's drafts and the shelf first. Each can be recorded with the microphone or uploaded from a phone (m4a/mp3 labels are mapped to the server's types).
- **Levels** (`spellingLevel`), from a word's units:
  1. consonants and right/above/below vowels;
  2. a vowel drawn on the left;
  3. one foot;
  4. a compound vowel or a sign;
  5. two feet, ◌្រ or a shifter.

  Band A (ages 5–7) is capped at 3: the offline drafter avoids harder words when it can, the studio flags them in red, and the book page shows the book's level.

### Studio: server-side listing (large recordsets)

The studio's book list no longer downloads every book to list it — it asks the server for one page at a time, searched, filtered and sorted in the database:

- **Server** (`server/app/repos/library.py`, `routers/library.py`):
  - `GET /library/drafts` — a page of `BookSummary` rows (title, language, band, category, picture, status, counts, timestamps — never the story text), with `q` (title/id substring, regex-escaped), `status` (draft/published/changed/reported), `language`, `band`, `category`, `sort` (updated/title/created/published), `page`, `pageSize`. Response includes `stats` (counts per status for the current search) and `facets` (the languages/bands/categories the books actually have, with counts).
  - `GET /library/drafts/{id}` — one full book, for the editor.
  - `GET /library/studio/meta` — the categories, sorts, statuses and page-size bounds the server accepts, so the client keeps no copy of its own.
  - `GET /library/studio/spelling-units?language=km` — every spelling unit used by *any* book (not just the studio's current page), for the sound-names screen.
  - `GET /library/reports?bookId=` — reports for one book, for the editor's flag panel.
  - "Changed" means saved since it was last published — the shelf still serves the older revision.
  - Indexes: `library_books` on `(deletedAt, updatedAt)`; `library_reports` on `(resolvedAt, bookId)`.
- **Client** (`src/library/studio/StudioHome.tsx`): built from the shared admin UI (`UIDataTable`, `UITabs`, `UIPageHeader`, `UIButton`, `UIBadge`, `UISpinner`, `themeSystem.field`) rather than one-off markup, matching the pattern in `UsersPage.tsx`. Search is debounced 300ms; every other change (tab, filter, sort, page) reloads immediately. The view (tab/filters/sort/page size) is remembered per device in `koda_library_studio_view_v1`; the search box is not. A stale filter value the current search no longer has stays selectable, so it's visible and clearable.
- The editor no longer holds the book list in memory: opening a row fetches that one book and its reports, and closing it just re-fetches the current page.
