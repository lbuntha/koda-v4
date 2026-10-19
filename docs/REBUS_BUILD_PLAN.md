# Rebus Rush — proposed build plan

**Skill id:** `rebus` · **Name:** Rebus Rush · **Proposed ages:** 7–18 (hint depth and word difficulty scale with age) ·
**Category:** `logic` (shown under Learn → **Think**) · **Status (2026-10-18): Phases 0–4b, the Studio and group play 5a–5c are built. Phases 5d and 5e built. Next: Phase 6 (voice and polish), then Phase 6 (voice and polish).**
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

## Phase 5b — group lobby, client (2026-10-18)

Built in `src/rebus/group/`: `GroupHome` (open or join), `HostForm` (topic, count, level, nickname and avatar; signed-in users only), `JoinForm` (code + nickname + avatar from fixed lists; guests and signed-in users), `Lobby` (big code, copy code/link/share, players with Host and Koda badges, lock, remove, Start when two or more, Leave), `GroupRoom` + `useRoom` (poll every second, "Reconnecting…" instead of errors, removed/closed screens), `seatStore` (a refresh returns to the same room, per tab).

- Entry: "Play with friends" on the Rebus topic screen.
- Invitation link: `/?room=CODE`. Signed out → a guest screen in front of the sign-in gate (join as a guest, or "I have a Koda account. Sign in", which brings them back to the room). Signed in → straight to the join screen.
- Nicknames are stored in English and shown in the viewer's language (`rebus.nick.*`, en + km).
- Verified live in Chrome: host on localhost, guest on 127.0.0.1 (no session); the host saw the guest within a second; both left and the room closed.
- Start works, but the play screens are Phase 5c; until then the room shows "The game has started!".

## Phase 5c — synchronized group play (2026-10-18)

Built in `src/rebus/group/`: `GroupPlay` (countdown on the server's clock, the shared puzzle, answer box with the cursor in it, hints after the owner's delay, claim on a correct answer, the reveal with who was first, the answer and why), `Scoreboard` (everyone's score, the leader ringed), `GroupFinal` (winner, places, host "Play again", Leave), `useServerClock` (counts against the server's time, so a phone with a wrong clock still starts with everyone).

- The device checks the answer and sends one claim; the first to arrive wins the points. A player who was too late is told who was first. A claim that fails to send can be tried again.
- Verified live with two browsers (host signed in, guest with no session): shared puzzle, guest won the first puzzle +3, the host saw "Clever Fox got it first!", the race ran to the end and both saw the final screen.
- Next, 5d: a creative podium, "ask a grown-up to sign up" for guests, XP and the learning log for signed-in players (a replay pays no XP). 5e: admin settings and reporting.


## Join needs the host's OK (2026-10-18)

Owner decision: nobody enters a room until the host accepts them.

- `POST /rebus/rooms/{code}/join` now only puts a **request** at the door (`requests` on the room) and returns the seat's token with a `pending` room view that says nothing about who is inside. The same token becomes the player's seat when the host accepts.
- Host-only `POST .../accept` and `.../decline` (`{pid}`). The host's poll carries `requests`. Accept is atomic and is where "room full" and "name taken" are decided. A request not heard from for 30 s drops off the host's list and frees its nickname; a waiting child can withdraw with Leave; at most 10 may wait at once. Starting the game clears the requests.
- Client: a waiting screen for the child ("Waiting for the host to let you in…", and "The host did not let you in." if declined), and a "Waiting to join" list with Accept / Decline in the host's lobby. Strings are in `en` and `km`.


## Phase 5d — podium, ask a grown-up, XP (2026-10-18)

Built in `src/rebus/group/`:

- `Podium`: the top three on steps (second, first, third) that rise into place (motion-reduce turns the rise off); players who share a place share a step; fourth place and below are listed under it. No yellow.
- `AskGrownUp` (guests only, i.e. `!me.isKodaUser`): a card on the results screen with "Ask a grown-up", which shows a short note with Koda's address to copy or share. The child types and sends nothing; nothing is collected.
- `useGroupLearning` (signed-in players only): once per game, records the game in the learning log with the same `RebusRecorder` as a solo round, files outcomes in the per-puzzle memory, and pays stars and XP with the same rule (`rebusReward`, owner's `xpPerRound`). A game of puzzles the player has all played before is logged as practice and pays no XP, and the results screen says so. A friend winning a puzzle is logged as an unanswered puzzle ("machine"), never as a mistake. Puzzles are collected as they are shown, so one a device never saw is left out.
- Verified in Chrome: host (signed in) and a guest over the API played five puzzles; the podium showed Clever Fox first and Brave Tiger second, and the replay note appeared (those puzzles had been played on this browser before).


## Phase 5e — owner controls and reporting for group play (2026-10-18)

- **Owner settings** (Admin → Rebus Rush): the existing `rebus.group` switch (generic System list) and most players per room, plus a new **"Let players without an account join"** (`guestsAllowed`, default on). Off: a join without a Koda sign-in is refused with `guests_off` ("Only players with a Koda account can join right now."). Rooms can always be opened only by a signed-in player.
- **Counting, numbers only:** `rebus_group_stats`, one document per day (UTC) of counters: rooms opened, join requests, seats (Koda / guest), games started, players at start, games finished, play-agains, guests who opened "ask a grown-up" (once per seat, via `POST /rebus/rooms/{code}/asked`). No names, codes, answers or anything about a child; counting never fails a game. Rooms still vanish two hours after they open, so these counters are the only history.
- **Report:** `GET /rebus/rooms/report/summary?days=` (needs `system:write`, so only the owner) returns one row per day, zeros included, and totals. Admin → Rebus Rush → **Group play** shows them as tiles and a day table for 7 or 30 days, fetched only when the owner presses "Show the numbers".
- Not built (by design): reports on individual rooms or players; parent approval for a managed child's room; preset reaction stickers.


## Phase 6 — voice and polish (2026-10-18)

- **The Machine's moods:** the Machine's score chip now reacts. Thinking while a puzzle runs; a wobble and "Oops!" when it guesses wrong (the child's chance); a hop and "Got it!" when it wins a puzzle; a droop and "Aw, you were quicker!" when the child does; a shrug when nobody solves it. Each plays once and stops, and a "reduce motion" setting turns the movement off (the words stay). It is a reaction, never a judgement of the child.
- **Adaptive carries over:** "Adaptive" used to start every round on medium. It now starts where the last adaptive round ended (`prefs.ts` `loadAdaptive` / `saveAdaptive`, kept on the device; `RoundConfig.adaptiveStart`). A fixed level pick, or the owner's lock, ignores it.
- **Spoken lines:** Rebus Rush has its own voice pack, `src/voice/rebus/` (`voice.json`, `index.ts`, `audio/`), registered under the id `rebus` so its lines are heard only in Rebus Rush. 13 reaction groups (start, next, wrong, solved, machine missed / won, time up, round won / tie / end, a friend winning in a group, group won / end), 2 to 4 variants each, 33 lines in all. Only fixed lines: nothing with a name or a number. `cue()` in `sound.ts` says the matching line after its chime, only when the family's **voice** switch is on (separate from the chimes), and says nothing for a line that was never recorded, so the game works the same with no recordings.
- **Recording:** `scripts/generate-voice.mjs` learned a second kind of non-skill voice (`MODULE_VOICES`). Plan with `npm run voice:plan -- --skill rebus`, record with `npm run voice:record -- --skill rebus --provider openai`. **The first attempt failed for every line: the OpenAI account has no credits left.** The game is silent where it would speak until that is topped up and the command is run again; no code changes are needed.
- A tie now has its own cue (a chime and a line), instead of sounding like a loss.


## Phase 7 — take turns on one device, and Khmer words (2026-10-19)

- **Dropped connections no longer end a group game.** `useRoom` used to give up after 8 failed asks (about 8 to 16 seconds) and call the room closed. Now only the server saying "you are not in this room" (removed, or closed) ends it. A failed ask shows "Reconnecting…" on every screen (lobby, play, results, waiting at the door), keeps the seat, keeps asking (every 3 s once 10 in a row have failed), and asks at once when the device comes back online or the page is shown again.
- **Take turns on this device** (`src/rebus/turns/`): two to four players share a screen, with no network at all. Puzzles go round the players in order (everyone gets the same number: 2, 3 or 5 each). Between turns a hand-over screen says who to pass the device to and the clock does not run while it is passed. Same hints, time limit and points as a game against the Machine (the owner's settings). Most points wins on the same podium as group play; ties share a place. Players are a nickname and a look from the fixed lists. It pays no XP and writes no learning log, because a shared screen cannot say whose play it was. A pure `engine.ts` reducer (7 tests) and screens (3 tests). Entry: a second button under "Play with friends".
- **Khmer words** (`src/rebus/content/khmer.ts`): a new topic "Khmer words" / ពាក្យខ្មែរ (`khmer` is now a category in the app and on the server) with 36 puzzles for early readers (about 5 to 12): 26 "name the picture" and 10 two-picture compounds (ទឹក + កក = ទឹកកក). Answers are typed in Khmer; matching already kept Khmer syllables whole. Ids are spelled out (`key`) because a Khmer word has no Latin letters to make one from. The audit stops at age 12 for this topic until it has harder words.
- **A Khmer speaker should read every puzzle before it is published.** They arrive in the Studio as drafts (the standard flow), but I cannot check the spelling or whether each drawing is what the answer says. Drawings have English names, so the third hint ("the pieces") is in English.


## Play feedback, as shared UI (2026-10-19)

Direction from the owner: **clean and light, with good animation and interaction.** One small movement per moment, quiet white surfaces with a thin coloured edge, nothing that competes with the puzzle, and every movement stops for a player who asked for less motion (decoration with no resting state is hidden, not frozen). All of it is shared UI (`src/components/ui/`), not Rebus-only, so a skill can use the same pieces:

- `UICountdown`: the time left as a ring that empties; calm indigo, then rose and a gentle beat in the last ten seconds (or fifth), an hourglass at zero. The seconds are written in the middle, so it is never colour alone.
- `UIHintPanel`: the hint button (a ring that drains while locked, a soft glow when ready), dots for hints used, and each hint taken as its own numbered card that slides in and glows once.
- `UIOutcome`: how a puzzle ended. Right: a medallion pops, one burst of confetti, the points rise in as a chip. Out of time: an hourglass shakes once and the words stay kind. Beaten to it or passed: a calm card. In a group or on a shared device the medallion is the face of whoever got it.
- `UIBurst` (the confetti, moved out of the Showdown), `UICountUp` (a number that climbs to its new value), `UIPointsPop` ("+3" rising from whoever scored), `UIXpReward` (XP counting up from zero, with the final amount written for a screen reader).
- Used on the solo, take-turns and group screens; scores count up everywhere, and in a group the scoreboard shows who took the puzzle (their chip glows and "+3" rises from it) next to the banner with their face and name.
- Fixed: the winner's crown on the results screen was not centred and overlapped the trophy; it is centred on the card with room above. The XP chip and the points tile were yellow (the shared message used amber); both are now emerald/indigo.


## Rebuilding creation: categories, question types, photos (2026-10-19)

Owner direction: simplify and rebuild puzzle creation with a clean, clear process and validation; let the owner add categories (Math, and others) and other question types; and keep open the option of letting end users make and share puzzles (**decided later, not built**; see the memory note). Decisions: categories are **managed in the Studio**; the first question types are **picture puzzle, math, multiple choice and name-the-photo**.

**Phase A: built (this entry).**
- **Categories are data.** `rebus_categories` (server `repos/rebus_categories.py`): id (its address, never changed), names per language (English required, Khmer optional, fallback to English), one of five colours, the Koda topic, order, on/off, `builtIn`. The eight that shipped are created once, create-if-absent. Delivered to devices with the published list (`GET /rebus/puzzles` now has `categories`) and kept on the device (`bankStore`), with the eight as the stand-in before the first contact, so a fresh offline install still has topics. Switching one off hides it and its puzzles from children without deleting anything; a built-in one, or one with puzzles, cannot be deleted. Any change bumps the list version so devices pick it up.
- **Studio → Categories tab** (`CategoriesPanel`): add (id made from the English name), rename in each language, colour, topic, reorder, switch off, delete when unused.
- **Photos in puzzles.** A new piece kind `photo` (`photo-<sha256>`), mixed freely with drawings, words and signs in one puzzle. Uploaded from the author's computer in the editor ("Add a photo": shrunk in the browser to 640px, checked as a real JPEG/PNG/WebP by the server, kept with the library's photos), named by the author, sized Small / Normal / Big like a drawing, shown whole (never cropped). Players read it from an open route `GET /rebus/images/{id}` that only answers for a photo some puzzle shows (a guest in a group room has no account; the address is the hash). The photos of a published list are fetched with it, so offline play never shows an empty frame; one that cannot be had shows its name. Checks: a photo needs a name, and must have been uploaded.
- Replaced every hard-coded category list (app, server, rooms, Studio filters, the AI brief) with the data.

**Phase B: built (see below)** — the new creator: one clear path (1 pick the question type and category, 2 build it, 3 live checks and preview in the player's own screen, 4 save as a draft or send for approval), with a template per type. New question types need three things each, in this order: the stored shape and its server-side check, how it is played, and how a hint works. Math: the author picks the numbers and the operation (or a missing number) and the answer is computed, so it cannot be wrong; played with a number pad. Multiple choice: a question (text and/or picture) and two to four answers with one marked right; played by tapping, with hints that remove a wrong answer. Name-the-photo: a picture puzzle with one photo. Authorship and status stay on every puzzle and the creator holds no staff-only powers, so opening it to end users later is a permissions and moderation decision, not a rewrite.


### Math questions and the Math category (2026-10-19)

- **A new question kind, `math`** (`kind: "math"`, `math: { a, op, b, unknown }`). The author gives the numbers, the operation and which part the child works out; the prompt (`7 × ? = 56`, stored as the one word piece, so older devices still show it), the answer and the explanation are **worked out from the numbers on the server and in the editor**, so a math question cannot be wrong. Whole numbers 0 to 9999, never negative, division exact, and no "missing number" that has no single answer (`0 × ? = 0`). `src/rebus/math.ts` and `server/app/rebus_math.py` are the same rules, tested against the same cases.
- **Identity is the numbers, not the answer:** many sums come to 13, so the duplicate check, the seed audit and the one-per-answer rule in group rooms use `math|<prompt>` for a math question.
- **Played** in every mode (solo, group, take-turns) with a number pad and "Type the number"; the letter-tiles setting does not apply to numbers. **Hints narrow a number down:** the category, how many digits the answer has, then which ten it falls in ("between 50 and 60").
- **Studio:** Create → "Write a math question" (the numbers, the operation, which part is missing, and a live preview of the question and its answer; no answer box to mistype). Editing a saved math question changes its numbers and the rest follows. "Draft with AI" skips Math.
- **Math is a built-in category** (`math` / គណិតវិទ្យា, topic `numbers`, cyan), created on the next start for every deployment, and **108 questions are seeded as drafts**: easy (adding and taking away within 20, a missing addend; ages 5 to 9), medium (two-digit adding and taking away, the times tables to 10, the matching division, a missing factor; 7 to 12) and hard (three digits, two-digit times tables, longer division, bigger missing numbers; 10 to 14). Like every seed puzzle they wait in the Studio for approval and a release.


### Phase B: multiple choice and the guided creator (2026-10-19)

- **Multiple choice** (`kind: "choice"`, `choice: { options: [2 to 4], correct }`). The question is the puzzle's pieces (words, a drawing, a photo); the answer is the marked option, worked out on the server (`rebus_choice.py`) and in the editor (`choice.ts`), so it cannot disagree with the screen. Checks: two to four answers, none blank or over 40 characters, none repeated (ignoring case, spacing and punctuation, but not Khmer marks), one marked right. A choice is matched **exactly** (one slipped key is a different option, never a typo), and is told apart by its question as well as its answer ("Paris" answers many). Played by tapping (`UIChoiceGrid`, shared): lettered buttons in an order that is fixed per puzzle but not always the same, a wrong tap crosses that answer out, and **hints take wrong answers away** (the category first, then one wrong answer at a time, always leaving two) instead of spelling anything.
- **The guided creator** (Create → "Write one myself"; `QuestionWizard`): **1 Kind** (Picture puzzle, Name a picture, Math, Multiple choice, with the category), **2 Build** (the builder follows the kind), **3 Check and save** (the question exactly as children meet it with the right answer ticked, a level, the checks in words, then Save & approve or Save as draft). Next stays off until a step is done and always says what is missing, from the same checks the server runs. "Name a picture" is not a stored kind: it starts a picture puzzle from one drawing or photo and the word for it.
- The editor used for fixing a saved question is built from the same parts (`studio/builder/`: pieces, choice, level, checks, preview), so creating and fixing behave the same.
- Not seeded: multiple-choice questions are for the owner to write.
