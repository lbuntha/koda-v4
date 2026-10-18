# Rebus Rush — proposed build plan

**Skill id:** `rebus` · **Name:** Rebus Rush · **Proposed ages:** 7–18 (hint depth and word difficulty scale with age) ·
**Category:** `logic` (shown under Learn → **Think**) · **Status: Phases 0 and 1 built 2026-10-17 (`src/rebus/`, 94 tests). Phase 1 was checked in the running app (desktop, 390px phone frame, dark mode) on 2026-10-17. Phases 2, 3, 4, 4a and 4b built the same day (see their records below). Group play (Phase 5) waits for the owner's confirmation; voice recording (Phase 6) is not started.**
**Structure decided 2026-10-17: its own module `src/rebus/` (not a skill under `src/skills/`), with the Studio at `src/rebus/studio/` and the API in `server/app/routers/rebus.py`; read "skill" in §2 and §9 as "module". Real screens use `themeSystem`, the `UI*` components and semantic tokens from `docs/THEME.md`; the HTML mocks only imitate the look.**

The reference is the "Solve this puzzle. Family games" reels: a picture-sum such as
🦠 (germ) + 💵 (money) = **Germany**, or the word CAKE with a slice cut out = **slice of cake**.
A player reads the picture, says the phrase, and a rival tries to beat them to it.
This plan follows `docs/SKILL_DEVELOPMENT.md` and `docs/SKILL_BUILD_TEMPLATE.md`.

## 1. What the child does

1. **Pick a topic** (Countries, Food, Animals, Sayings, Sport, Space, School, Khmer words…).
2. Koda **builds a round of 5–10 puzzles** from that topic (the child chooses 5, 7 or 10).
3. **Play against the Machine.** For each puzzle both sides race: the child types/taps an answer, the Machine "answers" at its own pace.
   First correct answer takes the point. Best of the round wins; ties go to a one-puzzle tie-break.
4. **Hints.** A hint button unlocks after a time limit the **owner (admin)** sets. Three rungs, each costs a little score:
   *category* ("a country") → *first letter + length* (`G _ _ _ _ _ _`) → *reveal one picture piece's word* ("germ").
5. Round summary: score vs Machine, puzzles solved, hints used, time per puzzle. A solved puzzle shows the "why" (🦠 = germ, 💵 = money → germ + money-ish = Germany) so the child learns the trick, not just the answer.

## 2. Where it fits in Koda

| Koda area | How Rebus uses it |
|---|---|
| **Learn → Think** | `manifest.audience.category: "logic"`; appears beside Color Sweeper / Observation / Bottle Sort. |
| **Skill SDK** (`src/skills/rebus/`) | Standard skill: `manifest.json`, `lessons.json`, `index.ts`, `voice.json`, `locales/`. One activity engine (`RebusRound`) with lessons as JSON params. |
| **Ages** (`src/lib/ages.ts`) | Required `ages: [7,18]`; each puzzle also carries its own age so a 7-year-old never draws "once in a blue moon". |
| **Topics** (`src/lib/topics.ts`) | Each topic is a TOPIC tag, so Today picks and recommendations can link Rebus to books/lessons on the same subject (Countries ↔ geography books). |
| **Learning log / mastery** | New concepts: `rebus-decoder`, `phrase-reader`, `lateral-thinker`. Solved without hint = mastered signal; hint use is a softer signal, never a "wrong". |
| **Parent reports** | Rounds count in the existing Think mix; weekly summary can say "solved 14 picture puzzles, mostly Animals". |
| **Offline-first** | Whole round plays with no network (see §4). Results queue and sync like every other skill. |
| **Offline guide pattern** | Hint ladder reuses `counting/internal/guide` shape: signals (stalled / wrong tries) → rungs → two strings per cue. No AI tutor on the play path. |
| **i18n** | App labels in en + km. Puzzle content (answers) is per-language; Khmer puzzle packs are a later phase. |
| **Leaderboard / share** | Round score + speed log feeds the existing practice-speed log; privacy rules in `LEADERBOARD_PRIVACY.md` unchanged. |
| **Admin / Studio** | Owner sets hint delay, Machine difficulty, round length, enabled topics; Studio lets staff author/approve puzzles (§5). |

## 3. Puzzle model (the core idea)

A puzzle is data, not code:

```
{ id, topic, ages:[min,max], language:"en",
  pieces:[ {kind:"icon", name:"germ"}, {kind:"op", op:"+"}, {kind:"icon", name:"money"} ],
  styleTrick?: "cut-slice" | "tall" | "small" | "upside-down" | "repeat" | "inside" | ...,
  answer:"germany", accepts:["germany"],     // normalised, typo-tolerant
  explain:"germ + money sounds like Germany" }
```

- **Piece kinds:** icon (from Koda's own SVG set), styled word (CAKE with a slice cut out, BIG/small, upside-down, text-in-a-box, word repeated), operators `+`, `−` (remove letters), `=`.
- **Renderer** draws any puzzle from the data; no per-puzzle components.
- **Answer check:** normalise case/spacing/accents, accept listed alternates, allow 1-letter typos for long answers.
- **Icons:** own SVG library, no yellow (memory: no yellow anywhere). Emoji are not used because they are inconsistent across devices and many are yellow.

## 4. "Generate questions by topic" — and keeping it offline

This is the one real design choice. Three options:

| Option | Offline? | Quality | Cost/risk |
|---|---|---|---|
| **A. Curated bank per topic** (recommended base) | Yes | Highest — humans verify every rebus works | Needs authoring effort; start with ~30 puzzles × 6 topics |
| **B. Composer: combine icon pieces by rule** (germ + money → Germany via a "sounds-like" table) | Yes | Good for compound-word / sound-alike puzzles; weak for clever visual tricks | Medium |
| **C. AI-generated puzzles on demand** | **No** — breaks the offline rule; AI also draws bad rebuses (answer doesn't match picture) | Unreliable | Latency, cost, wrong answers shown to kids |

**Recommendation: A + B for play, C only in Studio as a drafting aid.**
"Generate" for the child = Koda **assembles a fresh round** from the topic's bank (seeded shuffle, age-filtered, no repeats from the last rounds, difficulty ramp easy → hard). Fully offline, always correct.
In Studio, staff can press "Suggest puzzles" (online, AI-drafted), then **a human must approve each one** before it can ship. Nothing AI-written reaches a child unreviewed.

## 5. The Machine opponent (offline, no AI)

The Machine is arithmetic on a clock, not a model:

- Each puzzle has a *difficulty score* (answer length, trick type, age). Machine's answer time = `base(level) × difficulty ± jitter`, seeded so a round is reproducible.
- Machine **accuracy** by level: Easy ≈ 55% right, Medium ≈ 75%, Hard ≈ 90%. A miss makes it "guess wrong" and lock out for a few seconds (visible, so the child can pounce).
- Levels: **Easy / Medium / Hard / Adaptive** (adaptive nudges toward ~50/50 based on the child's last 3 rounds so it stays fun).
- Persona: a small Koda character with reactions (thinking, buzzing in, groaning). Pure animation + the existing voice clips.

## 6. Owner controls (admin settings, synced via system defaults)

| Setting | Default | Notes |
|---|---|---|
| **Hint unlock delay** | 20 s | Per-puzzle countdown ring on the hint button; seconds, owner-defined; can be set per age band. |
| Hint rungs allowed | 3 | Owner can cap at 1–3. |
| Hint score cost | −1 / −2 / −3 | Multiplier on points. |
| Puzzle time limit | 60 s | After it, puzzle auto-reveals and nobody scores. |
| Questions per round | 5 / 7 / 10 | Child picks within owner's allowed set. |
| Machine level | Adaptive | Owner can lock a level. |
| Topics enabled | all | Per-topic on/off. |
| Voice read-aloud | on | Matches the existing `audio_speech` flag. |

Lives in `server/app/system_defaults.py` alongside the Smart-guide settings, so the owner changes it without a release.

## 7. Screens

1. **Topic picker** — grid of topic cards with age-appropriate filtering and a "mixed" card.
2. **Round setup** — questions (5/7/10), Machine level, Start.
3. **Play** — big rebus canvas, answer box (keyboard / letter tiles for young kids), Machine score strip, hint button with countdown ring, skip.
4. **Reveal** — correct/wrong, the explanation, who scored.
5. **Round summary** — score vs Machine, stars, "play again / new topic".
6. **Studio → Rebus** — puzzle list, piece editor, preview, approve/publish, import/export.

Phone-first (390px), 44px minimum targets, reduced-motion respected.

## 8. Age scaling (grades 1–12)

- **7–9:** picture-only, 2 pieces, letter tiles instead of a keyboard, concrete topics (Animals, Food).
- **10–12:** 3 pieces, sound-alikes, simple style tricks (cut, tall, small).
- **13–18:** idioms and sayings, `−` letter removal, layered tricks, countries/science/history topics, typed answers only.

## 9. Build phases (one at a time; you verify each)

| Phase | Deliverable | Gate |
|---|---|---|
| **0 Foundations** | Puzzle schema, answer normaliser/typo-tolerance, Machine timing model, hint ladder rules, seeded round builder — pure logic, with tests | Unit tests; **no UI** (reviewed via Phase 1) |
| **1 Play engine** | `RebusRound` activity, renderer for icon/op/styled-word pieces, answer box, Machine strip, reveal | Playable in `localhost:3001` incl. 390px |
| **2 Content v1** | SVG icon set (~120), 6 topics × ~30 puzzles with explanations, topic picker + setup screens | Content audit test (every answer reachable, ages valid) |
| **3 Owner controls** | Admin settings + sync, hint countdown ring, rungs and score costs | Change a setting, see it live |
| **4 Koda integration** | Register in `registry.ts`, Think category, topics/ages tags, learning-log concepts, parent report line, km labels | Appears in Learn → Think; report shows it |
| **5 Studio authoring** | Puzzle editor + approve flow; optional AI "suggest" for staff only | Staff can add a puzzle that then plays |
| **6 Voice + polish** | Recorded prompts (`voice:record -- --provider openai`), Machine reactions, adaptive level | Full gate: lint strict, scoped then full tests |
| **7 (later)** | Khmer puzzle pack; head-to-head with a sibling on the same device | Separate decision |

New skill needs `docker compose restart api` so `skill_registry` re-seeds before it publishes.

## 10. Risks

- **Rebus quality is the whole game.** A puzzle whose picture doesn't clearly say its answer feels unfair. Mitigation: human-approved bank, explanations shown after every puzzle, a "report this puzzle" button.
- **Icon library effort.** ~120 consistent SVGs is the largest cost. Start with 60 and grow by topic.
- **Answer variants.** "Slice of cake" vs "a slice of cake" vs "piece of cake". Mitigation: normaliser drops articles, per-puzzle `accepts` list.
- **Copyright.** The reels' exact puzzles are the creator's; Koda authors its own puzzles in the same *style*.

## 11. Addendum — scale, community, group play (added 2026-10-17)

Mock: `docs/rebus-flow-mock.html` (Koda theme; Process / Demo / Owner / Studio panels).

### 11.1 1,000+ puzzles per category, growing with users
- **Goal per category: 1,000 puzzles**, shown as a progress bar so gaps (e.g. Sports at 987) are visible to staff and to makers.
- **Two sources:** official (staff/Studio) and community (approved user puzzles). Both play identically; community ones credit the maker's **nickname only**.
- **Offline packs:** each category is a versioned JSON pack (~0.3 KB/puzzle ≈ 350 KB per 1,000). The child downloads a category once; solo play reads it locally. Packs update incrementally (changed ids only). Group play uses the online library, so nothing needs downloading.
- **Never repeat:** the round builder remembers recently seen puzzle ids per learner (local), so 1,000 puzzles last a long time.
- **Bulk seeding:** the 1,000 cannot be hand-drawn. Studio imports CSV/JSON drafts; AI may *draft* (staff only), a human approves each (§4).

### 11.2 Community authoring pipeline
`Draft (offline OK) → Submit (online; queued if offline) → Auto-checks → Studio review → Published → counts in category`
- **Auto-checks:** at least one picture/word; answer 3+ letters; answer not spelled out in the puzzle; explanation present; profanity/safety filter; duplicate detection against the bank.
- **Studio review:** approve or send back with a reason. Makers see the status in *My puzzles*.
- **After publish:** report button on every reveal screen; 3 reports hide a puzzle until re-reviewed.
- **Who may submit:** self-managed students and parents; a managed child drafts, a parent submits (same rule as buddies in `LEADERBOARD_PRIVACY.md`).
- **Rights:** makers grant Koda a licence to use the puzzle; they cannot edit after publish (they submit a revision).

### 11.3 Group play (online only)
- **Reuses Buddies:** invite accepted buddies, or share a `KODA-XXXXXX` room code (15-minute, single-use, peppered hash — same contract as buddy codes). Consent and block lists are honoured; a blocked user can never join.
- **Room lifecycle:** create (category, 5/7/10 questions) → invite → lobby (ready states, host starts, ≥2 players, max set by owner) → 3-2-1 → live race → reveal after each puzzle → podium → rematch or leave. The room is **deleted after the game**.
- **Race rules:** same puzzle, same moment, server-timed. First correct answer takes 3 points minus the answerer's own hints; a wrong answer locks only that player for 3 s; hint delay and time limit come from the owner.
- **Safety:** no free-text chat — preset reaction stickers only; nickname + avatar only; a parent approves rooms for a managed child.
- **Disconnects:** seat held 30 s; the race continues; on return the player resumes at the current puzzle; after 30 s the seat is released.
- **What is saved:** only the player's own score/hints to the learning log and parent report. Other players' answers are not stored.
- **New infrastructure (does not exist yet):** the API has no realtime channel for rooms (only the Gemini Live socket in `server.ts`). Plan: FastAPI WebSocket rooms with server-authoritative timing, plus a polling fallback for weak connections; rooms in Mongo with TTL. This is the largest new piece and gets its own phase.

### 11.4 Offline / online matrix
| Feature | Offline | Online |
|---|---|---|
| Solo vs Machine on a saved category | Yes | Yes |
| Download / update a category pack | No | Yes |
| Hints, scoring, learning log | Yes (queued) | Yes (synced) |
| Draft a puzzle | Yes | Yes |
| Submit a puzzle / report a puzzle | Queued, sends later | Immediate |
| Group rooms | **No** — clear message with "play alone instead" | Yes |
| Mid-race disconnect | n/a | 30 s seat hold, then released |

### 11.5 Added phases (slot after Phase 4)
| Phase | Deliverable |
|---|---|
| **4a Category packs** | Pack format, download/update, offline round builder reading packs, recently-seen memory |
| **4b Community authoring** | Builder, auto-checks, submit queue, My puzzles, Studio review queue, reports |
| **5 Group play** | Room API + WebSocket, buddy/code invites, lobby, live race, reconnect, parent approval for managed children, TTL cleanup |

Original Phase 5 (Studio authoring) is absorbed by 4b; voice/polish stays last.

### 11.6 Risks added
- **Content moderation is ongoing work**, not a one-off. Needs a Studio queue, reports, and a staff owner for it.
- **Realtime on unstable connections** — mitigated by server-authoritative timing, 30 s seat hold and polling fallback; still the riskiest build.
- **Cheating** — answers must never ship to other players' clients in group mode; the server checks answers (solo checks locally from the pack).
- **Pack size growth** — 7 categories × 350 KB is fine; monitor if puzzles gain images.

### 11.7 Rebus Studio — AI-assisted content (supersedes the cautious line in §4)
Mock: `docs/rebus-studio-mock.html` (responsive web: side rail ≥ 860 px, scrolling tab bar below).
**Decision:** puzzles are created with AI, but only inside a staff Studio. Children never wait on AI and never see an unreviewed puzzle.

**Flow: Brief → Generate → Review → Publish** (plus Coverage, Community queue, Releases)
1. **Coverage** — per category vs the 1,000 goal, with an age × difficulty heat-map; thin cells start a pre-filled batch.
2. **Brief & prompt** — staff pick category, age band, difficulty, tricks, count (10–50), language, notes and model. The system prompt is editable and **versioned** (v1, v2…) so a good batch can be repeated; the exact assembled prompt is shown.
3. **Generate** — five automatic stages: *draft* (model returns structured JSON) → *schema + icon check* → *blind solve* (a second AI call sees only the pictures and must name the answer; if it cannot, the puzzle is flagged ambiguous) → *duplicate check* → *safety + age fit*.
4. **Review** — card per puzzle with the checks; Approve / Edit / Regenerate / Reject; "Approve all passing"; flagged cards cannot be approved until fixed.
5. **Publish** — approved puzzles join the category, new pack versions are built, learners get them on next sync, offline learners keep the old pack until then; **Releases** log who/which prompt version/which model and allow **roll back**.

**Design rules that keep AI output clean**
- **Closed icon library.** The model chooses icon ids and cannot invent artwork; an idea needing a missing icon is returned with `missing_icons`, shown as a dashed "?" and queued as an icon request for the artist.
- **Structured output only** (JSON schema); anything that does not validate is discarded.
- **Blind-solve gate** is the main quality check — if AI cannot decode it from the pictures, a child will not either.
- **Community puzzles use the same pipeline**; AI adds a suggestion, a person decides.
- **Cost control:** per-run cost shown, owner sets a monthly AI budget; Haiku-class model for bulk drafts, Sonnet-class for hard difficulty.
- **Audit:** every published puzzle stores prompt version, model, run id and approver.

**Access & build notes**
- Its own role grant ("Rebus Studio"), like Trace Studio / Library Studio; never a child.
- New server piece: a `rebus_generation` service in the Python API that calls the Claude API (key in server env, never the browser), runs the five stages, and stores runs and drafts in Mongo. The API has no LLM calls today, so this is new.
- Players and group rooms read only published puzzles; no AI on any play path (keeps offline-first intact).

**Phase placement:** Studio replaces "4b Community authoring" as **4b Rebus Studio** (generation, review, publish, releases, community queue). Phase 4a packs and Phase 5 group play are unchanged.

## 12. Open questions for you

1. Content source: agree with **curated bank + composer for play, AI only as a Studio drafting aid**?
2. First topics to ship (suggest: Countries, Animals, Food, Sayings, Sport, School)?
3. Should the Machine be **one persona** or pick from a few characters?
4. Is the hint delay **one global value**, or different per age band?
5. Does a hint ever fully give the answer, or stop at "reveal one piece"?


## Phase 0 delivery record (2026-10-17)

Pure logic in `src/rebus/`, no UI. Gate: **64 tests in 5 files** pass (scoped run), `npm run lint` (tsc, strict, no unused symbols) clean.

| File | What it does |
|---|---|
| `types.ts` | Piece (icon/word/stack/op), Puzzle, categories, tricks, difficulty |
| `answer.ts` | Normalise (articles, accents, Khmer-safe), compact spacing, typo allowance (none under 8 letters, 1 from 8, 2 from 14) |
| `puzzle.ts` | `validatePuzzle`: the checks the builder, Studio auto-stage and server share; duplicate key |
| `machine.ts` | Seeded Machine plan (delay, accuracy, retry, lockout), adaptive level, owner lock |
| `hints.ts` | Three-rung ladder, unlock timing from the owner's delay, points (3, −1 per hint, min 1) |
| `scoring.ts` | Race winner from times, round score, outcome |
| `round.ts`, `seen.ts` | Seeded round builder: category, age fit, fresh-first, unique answers, easy→hard, mixed interleave; recently-seen log |
| `settings.ts`, `categories.ts`, `rng.ts` | Owner settings with clamps, categories mapped to shared topics, seeded random |
| `fixtures/samplePuzzles.ts` | The 15 sample puzzles as typed data |

Finding during the build: allowing one typo from 6 letters accepted "hat dog" for "hot dog", so the allowance now starts at 8 letters.
Not done in Phase 0 by design: no screens, no server, no storage, no icons, no Khmer content.


## Phase 1 delivery record (2026-10-17)

The solo game is playable inside Learn → Think. Built only from `themeSystem`, the `UI*` components and semantic tokens (`UIButton`, `UITabs`, `UIProgressBar`, `UIKidMessage`, `UIStatTile`, `UIBadge`, `bg-play-sky/ground`, `text-ink`, `border-line`); no raw slate shades, no yellow.

| Piece | Where |
|---|---|
| Round reducer on an injected clock (answer, hint, skip, tick, next; Machine, limit, scoring, adaptive level) | `src/rebus/engine.ts` |
| Clock hook | `src/rebus/ui/useRebusRound.ts` |
| Setup (topic, 5/7/10, Machine level or the owner's fixed level) | `ui/RebusSetup.tsx` |
| Play (puzzle, scores, Machine bar, hint ring, wrong-answer message, answer box) and reveal | `ui/RebusPlay.tsx` |
| Letter tiles for the youngest (owner setting `letterTiles`) | `ui/LetterTiles.tsx` |
| Summary (solved, hints, average time, points) | `ui/RebusSummary.tsx` |
| Piece renderer; icon glyph stand-in until Phase 2 art | `ui/PieceView.tsx`, `ui/iconGlyph.ts` |
| Page, entry card on the Think shelf, bank stand-in, seen log on the device | `RebusPage.tsx`, `ui/RebusEntry.tsx`, `bank.ts`, `seenStore.ts` |
| Wiring | `App.tsx` (state + branch after the study-hours and day-cap gates), `SkillCatalogPage.tsx` (`onOpenRebus`) |
| Strings | `rebus.*` in `en.json` and `km.json` (64 keys each) |

Gate: **94 tests in 7 files** (scoped), `npm run lint` clean, i18n and Learn tests pass, running dev server compiles every changed module. **Checked in Chrome** (desktop, 390px phone frame, dark): setup, play, wrong answer, reveal, hint ring, phone tab bar hides, no overflow. The shared `UIKidMessage` `tryAgain` tone is amber, so Rebus uses `nudge` (violet) instead.
Stand-ins by design: emoji glyphs for icons (Phase 2 art), 15 sample puzzles (Phase 2 content), default settings (Phase 3 owner controls), local seen log (Phase 4a).


## Phase 2 delivery record (2026-10-17) — content and artwork

- **Artwork:** 133 flat SVG icons in Koda's palette, drawn as markup in `src/rebus/icons/` (nature, food, creatures, things; helpers in `draw.ts`). No yellow anywhere (sun, cheese, honey are orange/peach); an audit test measures the hue of every colour. An artist can redraw one under the same id.
- **Content:** about 160 hand-written puzzles in `src/rebus/content/` across six topics (Countries, Food, Sayings, Animals, School, Science; Sports stays "Soon"), written with short helpers and checked by the same validator the Studio will run.
- **Audit (`content.audit.test.ts`):** every puzzle valid with every icon present; unique ids and answers; no accepted spelling that is another puzzle's answer; every drawing used; no yellow; every topic open to a child of 7 to 14 has at least ten puzzles for that age. That last test found that teens had almost no Food puzzles, so harder sayings-style puzzles were added.
- **Age bands:** easy 6–12, medium 8–15, hard 11–18. The setup screen counts what suits the child's age.
- **Sound:** `src/rebus/sound.ts` + `ui/useRebusSounds.ts`, on the app's own synthesised chimes (`playSound`, which honours the family's sound setting): pop on choices and a hint unlocking, hint chime, error only for a wrong answer, soft clink (never an error) when the Machine or the clock wins, success on a solve, a fanfare for a round won. Offline-safe: nothing is fetched.
- **Still short:** teens (16–18) have only the hard puzzles in each topic, a few each. The Studio (4b) is how that grows.

## Phase 3 delivery record (2026-10-17) — owner controls

- **Server:** `rebus.settings` in the system switchboard (`server/app/system_defaults.py`), validated by `server/app/models/rebus.py` (hint delay 3–60 s, time limit 30–120 s, 1–3 hints, 2–6 players, Machine level free/0/1/2, letter tiles, round lengths 5–10) and by the `PATCH /system/settings/rebus.settings` route; out-of-range values are refused with a message. 3 new tests in `test_system_settings.py` (43 pass).
- **Client:** `settingsStore.ts` reads the cached setting (so offline devices play by the last rules they saw); `admin/RebusAdminPanel.tsx` is a new **Rebus Rush** tab on the Admin page with steppers, a level selector, round-length chips and a letter-tiles switch. It refuses to save if it could not load the current values first.
- **Verified in the app:** set the hint delay to 5 s, saved, and the next game showed "Hint in 4s"; reset to the default.

## Phase 4 delivery record (2026-10-17) — integration

- **Learn → Think:** an entry card on the Think shelf, gated by the same study-hours and daily-cap screens as lessons.
- **Learning log:** `learning.ts` (`RebusRecorder`) uses the standard `LessonTracker`: skill `koda-rebus`, concept `rebus-decoder`, one lesson per round, one question per puzzle, wrong tries, hints as support. It never records what was typed. A round counts in the parent's Think mix with no server change to the mix.
- **XP and stars:** `reward.ts` applies the deployment's own scoring rules (first try = solved with no hint and no wrong answer); XP is paid once, when the summary is reached, and shown on it.
- **Parent messages:** the server treats `rebus-` concepts like `trace-` ones: they never raise "mastered" or "stuck" and are not offered as the next step, because losing to the Machine is not a mistake the child made; `MODULE_CONCEPT_NAMES` names the concept "Solving picture puzzles".
- **Tests:** 132 in `src/rebus`; server `test_rebus_concepts.py`.


## Phases 4a and 4b delivery record (2026-10-17) — device list and the Studio

**Decision recorded:** the pre-built puzzles are managed in the Studio like any other, and an admin reviews them. They are copied into the server's database once (create-if-absent, so an admin's edits are never overwritten), published and playable from day one, and flagged "not yet reviewed". A device plays the server's published list when it has one (edits, retirements and additions all arrive), and the bundled puzzles otherwise.

- **Server (`server/app/`):** `rebus_puzzles` / `rebus_releases` / `rebus_state` / `rebus_prompts` collections (`repos/rebus.py`); `routers/rebus.py` (learners: `GET /rebus/puzzles?since=` returns the published list or "unchanged"; staff, gated by `content:write`: overview, list/search/filter, create, edit, status workflow, reviewed flag, delete drafts only, publish as a release, roll back, answers list, versioned generation prompt); `rebus_verify.py` (Python copy of the answer and puzzle checks, same cases as the TypeScript tests); seed file `rebus_seed.json` and icon list `rebus_icons.json`, both generated by `scripts/generate-rebus-*.ts` and checked against the app by a parity test. Menu row "Rebus Studio".
- **Workflow:** draft → approved (checks must pass, no duplicate) → published in a release (can be rolled back); live ↔ retired (retiring also counts as reviewed); rejected; a fix to a live puzzle must leave it valid and is applied at once; an edit after approval sends it back to draft; live and pre-built puzzles can never be deleted, only retired.
- **Device list (4a):** `bankStore.ts` caches the server list in localStorage with a 6 s deadline, a 60 s minimum gap, and a quiet failure; malformed rows or ones naming a drawing the app does not have are dropped; an empty list is never adopted. Limit: localStorage holds a few thousand puzzles; move to IndexedDB packs per category if the bank grows past about 5,000.
- **Studio screens (`src/rebus/studio/`):** a one-at-a-time review queue for the pre-built puzzles ("Looks good", "Edit", "Retire", "Skip") with progress; a searchable list with the right next step per state; an editor built from the icon library with live checks; Publish and Releases with rollback; **Draft with AI**.
- **Draft with AI:** `src/rebus/generate/` (prompt, parser, pipeline). The Node server hosts the model call (`/api/rebus/generate`, like the Library's AI draft): operator check, `ai.rebusDrafts` switch, the admin's provider (Claude Sonnet or Haiku, ChatGPT, Gemini), 90 s deadline per call, a clear "add a key" message. The model picks from the closed drawing list; every candidate is checked by the same rules as a typed one; a second call sees only the pictures and must name the answer; repeats and unsafe words are flagged; keepers are saved as **drafts** with their checks. Nothing is live until a person approves and publishes.
- **Verified in the app:** the review queue ("1 of 165 reviewed" after one click), the editor, the Generate tab, and the endpoint's gates (bad brief refused, no key gives the "add a key in Admin → API keys" message).
- **Not verified:** a real batch from a real model. No Claude key is saved in this environment, so the pipeline is tested with a fake model only; the prompt's quality against a real model is untested.
- **Quality pass on the pre-built set:** 8 weak puzzles cut (obscure words: dogwood, dog star, sea dog, fisheye, dogfish, moonstone, seagrass; an ambiguous picture: bookmark), 7 stronger ones added, and two unused drawings removed. Now 164 puzzles; the audit requires every open topic to give a 7–14-year-old at least ten.


## Drawings in the Studio (2026-10-18)

Where the drawings live: the 126 built-in icons are SVG markup in `src/rebus/icons/`; the **Art library** can override any of them, or add new ones, under the id `rebus-<name>` (category `rebus`). Lookup order, as `SvgAsset` resolves: this family's art, the shared art library, then the built-in drawing (`icons/useRebusIcons.ts`).

- **Studio → Drawings tab (`studio/DrawingsPanel.tsx`):** every drawing with Built in / Edited / Added badges, search and filters. **Edit** opens the Art page's own SVG editor (`SvgAssetEditorModal`: edit markup, live preview, sanitiser report, "Redraw" with AI), prefilled with the current drawing and filed under `rebus`. Saving writes to the Art library, so the drawing changes in every puzzle on every device at the next art sync (the app already refreshes shared art on boot). **Use built-in** removes the override; **New drawing** adds one with no built-in version.
- Puzzles can use drawings added through Art: the editor's checks, the server's checks (`repos/rebus.known_icons`: built-in list plus `rebus-*` in `art_assets`) and the device list all accept them; a piece whose drawing is missing shows its name instead of disappearing. An art asset without the `rebus-` prefix does not count.
- Drawing convention: a 64×64 viewBox, flat shapes, no yellow (the tiles are white "paper", so a drawing reads the same in dark mode).
- Verified in the app: edited `honey`, saved, saw the purple jar in the Honeymoon puzzle at once, then restored the built-in. Tests: `icons/icons.test.tsx`, `studio/rebus.drawings.test.tsx`, two server tests.
- **Where a drawing is used:** each card shows "Used in N puzzles" (server: `GET /rebus/studio/icon-usage`, counting puzzles in play or in the pipeline once each; the puzzle list also takes `?icon=rebus-honey`). Clicking it opens every puzzle that uses the drawing, drawn as a child sees it, with **Edit** on the same screen, so an admin sees what a change to `fire` will touch before saving and the result in place afterwards. Counts refresh after a save.

## Pre-built puzzles as Release 1, owned by the admin (2026-10-18)

Pre-built puzzles were live but belonged to no release, so Publish said "0 ready" and Releases said "nothing published" while 164 were live. Now: the first seed files them as **Release 1** ("Pre-built puzzles shipped with the app"), and an app update that adds puzzles files those as the next release. Both are marked `prebuilt`, cannot be taken back as a group (409; retire a weak puzzle instead), and show as "Shipped with the app". The puzzles and the release belong to the **platform admin account** (the oldest active admin; an older account with no status field counts; a disabled one does not): at seed time if one exists, otherwise the first admin to open the Studio adopts them. Cards show the release and "Pre-built · belongs to <name>"; releases show "Published by <name>". Separate from release state, "reviewed / not reviewed" is the admin's review pass over the pre-built set.


## Seed data follows the standard flow (2026-10-18) — supersedes the pre-built / reviewed / Release 1 special cases above

**Decision:** the starting puzzles are seed data in a file, not a special class. `src/rebus/content/*.ts` is the authoring source and `scripts/generate-rebus-seed.ts` writes `server/app/rebus_seed.json` (a parity test keeps them equal). On boot the server creates any seed puzzle that is not there yet as a **draft authored by the admin account** (the oldest active platform admin; if there is none yet, the first admin to open the Studio becomes the author). From then on a puzzle is just a puzzle: **draft → approved → published in a release**, with Unpublish (reversible), Reject, and Take back for a release. Nothing is live until an admin publishes, so the first publish is Release 1 like any other.

- **Removed:** the `reviewed` / "not reviewed" axis, the "pre-built" release flag and its no-rollback rule, and the bundled puzzle fallback on devices. `seeded` remains for one purpose: a seed puzzle cannot be deleted (it would be created again on the next start), so an unwanted one is rejected or unpublished.
- **Added:** **Approve all that pass the checks** (optionally per category) so a trusted batch does not need 164 clicks; anything that fails a check, including a duplicate, is left for a person. Duplicate rule: a puzzle in play (approved or published) always blocks a copy; among drafts the older one wins.
- **Devices:** children play only the published list, which the app fetches at start (so it is on the device, and works offline, before Rebus is opened) and keeps. A device that has never downloaded it asks the child to connect once ("Getting the puzzles ready", with Try again); a device whose list is empty says "No puzzles yet". An empty published list is a real answer, so unpublishing everything really empties the game. The runtime bundle no longer contains the puzzle content.
- **Wording:** "Retire" is now **Unpublish** and "Restore" is **Publish again**.
- **Dev data migrated:** 35 puzzles the admin had reviewed became *approved*, 129 became *drafts*, the pre-built release was removed. To go live: Studio → Publish → Publish 35 puzzles, or Review → Approve all, then Publish.


## Points and XP are configurable (2026-10-18)

Owner settings (Admin → Rebus Rush, validated by the server, cached on devices): **points for a win** (1–10, default 3), **cost of a hint** (0–5, default 1; 0 makes hints free), **points for the Machine** (1–10, default 3). A win is never worth less than 1 point. These are the points a child and the Machine race for inside a round; they decide who wins the round and are not XP. The hint button shows the cost; the Machine's reveal message shows its points.

**XP:** by default a round pays like lessons and books: the deployment's "XP per level" in Scoring & XP, with stars and their shares from the same page. The owner can switch **Same XP as lessons and books** off and set **XP for a perfect round** (0–200, Rebus Rush only); stars and shares still come from Scoring & XP. `xpPerRound: null` means follow the deployment. Nothing in Rebus holds an XP number.

## Delivery record: simpler Studio creation (2026-10-18)

- Tabs are now Create · Review · Publish · All puzzles · Drawings. The Studio opens on Review when drafts wait, otherwise on Create.
- Create offers two choices: **Write one myself** (picture row, answer, why it works, category, level) and **Draft with AI** (topic, level, 5/10/20, optional note).
- A level (little kids 6–8 easy, kids 9–12 medium, teens 13–18 hard) sets ages and difficulty together. Exact ages, difficulty, tricks, provider/model and the prompt sit under "More options".
- Both paths can **save as a draft** or **save & approve**. The server (`POST /rebus/studio/puzzles` with `approve: true`) approves only when every check passes; otherwise the puzzle stays a draft and says why.
- AI results are cards with Keep/Keeping toggles; "Approve N now" or "Add N to review".
- Not checked in a real narrow window (resize did not take effect); no real AI batch run (no Claude key in dev).

## Delivery record: play all, replay, phone setup (2026-10-18)

- **Setup is two short screens:** tap a topic, then confirm the options (how many, filter, after each puzzle, Machine) and Start.
- **Play all:** "All N" plays every matching puzzle in rounds of the chosen size (5/7/10), none repeated, then offers Replay all and "Play the N to retry". Filters: level and history (new, to retry, got it), with a live count.
- **Per-puzzle history** is kept on the device (`koda.rebus.results.v1`): plays and last result (clean, helped, missed).
- **A replay pays no XP.** A round where every puzzle was played before earns stars but 0 XP, and the summary says so.
- **Learning log:** a replay round is logged with `practice: true`, so speed and accuracy on puzzles already met are separable from first plays. Per-puzzle time, correctness, wrong tries and hints were already logged.
- **Answer box** takes the cursor on every puzzle. **After each puzzle** the player chooses "I tap Next" (default) or "Move on by itself" (5 s, Next still works); remembered on the device (`koda.rebus.autoNext`).

## Phase 5a — group rooms, server (2026-10-18)

Decisions (confirmed by the owner): join by invitation code; guests (no account) and signed-in Koda users can both play; guests use a **preset nickname + avatar** only (no free text from a child); a Koda user **signs in to play as themselves**; only a signed-in Koda user can **open** a room; a guest who likes it can ask a parent to sign up (finish screen, Phase 5d).

Built (`server/app/rebus_room.py` rules, `repos/rebus_rooms.py`, `routers/rebus_rooms.py`, `models/rebus_room.py`, `tests/test_rebus_rooms.py`, 15 tests):
- `POST /rebus/rooms` (signed in) → 6-character code + player token; `POST /rebus/rooms/{code}/join` (anyone, rate limited, optional bearer links a Koda user); `GET /rebus/rooms/{code}` poll (token in `X-Player-Token`); `start`, `solve`, `lock`, `kick`, `leave`, `rematch`; `GET /rebus/rooms/choices`.
- Polling, not sockets: one cheap read that also applies what time has done, so it works on any number of containers and a flaky connection just catches up.
- A race: first correct claim on the live puzzle wins its points (owner's points, less the owner's hint cost, min 1) and ends it for all; reveal 5 s; next puzzle; finish with shared places. Claims are atomic Mongo updates.
- Rooms expire after 2 h (TTL index). Owner switch `rebus.group` (Admin → Rebus Rush) turns group play off.
- Trust model: the device checks the answer and claims; the server only decides who was first. Fine for a children's game; the answers are already on every device.

Next: 5b client lobby, 5c synchronized play, 5d podium + rematch + "ask a parent", 5e admin settings and reporting.
