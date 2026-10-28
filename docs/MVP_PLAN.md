# Koda MVP plan — Grades 1–3 (Math · Reading · Rebus · Drawing)

Written 2026-10-28 from a read of the code, not from running it. Sizes are
TypeScript lines under `src/` unless noted. Nothing has been removed yet.

## 0. What the MVP is

Three grades (Grades 1–3, ages 5–9), four things a child does, one thing a parent gets.

| Pillar | Built from | Status today |
|---|---|---|
| Math | `counting`, `addition`, `subtraction`, `multiplication`, `division`, `fractions` (intro) | Built. Age bands gate each lesson; Grade 1–3 is ages 5–9. |
| Reading | Koda Library (`src/library`) + Khmer/English letters | 1 of 12 planned books published; book 2 has no pictures. |
| Rebus | `src/rebus` | Built. 2,324 puzzles in `rebus_seed.json`, seeded on boot. |
| Drawing | Koda Trace (`src/trace`) + paint | Engine built. English A–Z / a–z / 0–9 drafted, not published. No seed path. |
| Parent | weekly summary, daily reminder, child report | Built (server `tasks.py`, `email_notify.py`, `push.py`). |

Everything else is out of scope until after launch.

## 1. Before touching anything (Phase 0)

1. **Commit the work in progress.** 97 files are modified or untracked, including
   the i18n catalogs for five skills, the Library fit work and the English trace
   set. A removal pass on top of that cannot be reviewed or undone cleanly.
2. `git tag pre-mvp-cut`. Every removal below is then one `git checkout pre-mvp-cut -- <path>`
   from coming back, which matters because you plan to scale to Grades 2–12.
3. Baseline: `npm run lint` and the scoped vitest per module. Record what fails
   now so the cut is not blamed for it. (Known: 4 `test_push.py` failures in the
   dev container, from `PUSH_DRIVER=fcm`.)

## 2. What to remove (Phase 1)

Ordered by size of win. "Cut" = delete from `main` (tag keeps it). "Hide" = keep code,
off by default through the existing menu/permission/skill-registry switches.

### 2a. Skills — scope widened to Grade 3 (ages 5–9)

Lessons are already age-banded, so "Grade 3" mostly means *letting more of the existing
course through*, not building. Lessons that start at or below age 9:

| Skill | Lines | Lessons ≤ 7 / ≤ 8 / ≤ 9 (of total) | Recommendation |
|---|---|---|---|
| counting | 5.8k | 20 / 20 / 20 (of 20) | **Keep** |
| addition | 13.3k | 56 / 64 / 64 (of 64) | **Keep** |
| subtraction | 8.0k | 54 / 63 / 63 (of 63) | **Keep** |
| multiplication | 17.6k | 28 / 55 / 68 (of 68) | **Keep** — Grade 2–3 core |
| division | 12.3k | 7 / 26 / 41 (of 68) | **Keep**; the 27 lessons for ages 10–12 stay gated |
| fractions | 14.9k | 0 / 10 / 27 (of 69) | **Keep**; Grade 3 is the introduction, 42 lessons for ages 10–12 stay gated |
| color-sweeper | 5.5k | 16 / 29 / 40 (of 40) | **Decide** — logic game, not one of your four pillars |
| bottle-sort | 4.6k | 32 / 32 / 32 (of 32) | **Decide** |
| observation | 2.8k | 19 / 21 / 21 (of 21) | **Decide** |

So the skill cut shrinks from ~52,000 lines to at most ~13,000 (the three "Decide" rows).
Most of the MVP's removal win now comes from features (2b), not skills. The course gets
bigger to test: `course.json` (107 units) must be walked by an age 8 and an age 9
child to confirm the `requires` chains open a path with no dead ends, and nothing from the
gated 10–12 range leaks in.

If the three logic games stay, they must be checked against Grades 2–3 too; Color Sweeper
reaches into ages 13–14 and its later lessons stay gated.

### 2b. Features, by cost and fit

| Feature | Where | Verdict | Why |
|---|---|---|---|
| Live voice coach + Ask Koda tutor | `LiveVoiceCoachModal` (970), `KodaAskModal` (410), `utils/geminiLiveAudio`, `/api/live` socket in `server.ts`, `lib/koda*`, `tutorApi` | **Cut** | Billed Gemini calls and a child-facing open-ended AI, for a 6-year-old on unstable internet. Your own direction is an offline rule-based guide. Keep `KodaMascot`/`KodaFace` and the guides. |
| Billing, plans, upgrade requests | `routers/billing.py` (475), `services/entitlements.py`, `BillingPage`, `PlanCard`, `UpgradePrompt`, `featureGate`, `premiumLessons` | **Hide**, then cut | There is no payment processor. A free MVP needs none of it. Keep `FREE_PLAN` so `entitlements()` still answers "yes". |
| Leaderboard + buddies | `routers/leaderboard.py` (448), `LeaderboardPage` (725), `docs/LEADERBOARD_PRIVACY.md` | **Hide** | A privacy surface for children that the MVP does not need. Parents hearing progress is the point, not ranking. |
| Rebus group rooms | `routers/rebus_rooms.py`, `rebus/group` | **Decide** | Just built; useful in a classroom. If the first users are families, hide it. |
| Skill Manager, Skill registrations | `SkillManagerPage` (1,575), `LearningLogPanel`, `PracticeLogPanel`, `routers/skill_registrations.py` | **Hide** | The largest component in the app, for one admin. With 3 skills there is nothing to manage. |
| Push admin console | `PushTemplates`, `PushJobs`, `PushAudiencePanel`, `PushAnnounce`, `NotifyEventsPanel` (≈1.8k) | **Hide, keep delivery** | Delivery stays (core purpose). Admin needs only on/off and schedule, as planned 2026-09-15. |
| Data Cleanup, API keys, Subjects, Personas/Koda Characters admin | `DataCleanupPage` (823), `ApiKeysPanel`, `SubjectsPage`, `KodaCharacters` (554), `routers/personas.py` | **Hide**; cut Personas with the live coach | Operator tools; not on any child or parent path. |
| Dev scaffolding | `skills/kit/example`, `scripts/seed-push-demo.js`, `generate-observation-art.mjs`, `*.html` mockups in `docs/`, 40 of the 42 docs | **Cut / archive** | Mocks and per-skill build plans become noise once the skills are gone. Keep ARCHITECTURE, BACKEND, SECURITY, PWA, PUSH, THEME, VOICE, plus Rebus/Trace/Library plans. |
| Dependencies | `@anthropic-ai/sdk`, `@dicebear/*`, `firebase`, `@google/genai` | **Audit after the cuts** | Remove only what `grep` shows unused once the Live coach and tutor are gone. `@google/genai` stays if Studio image/voice generation stays. |

Add one MVP step: a **Grade 4+ gate** so lessons above age 9 exist but are not offered, and the home/recommender never reaches for them.

Keep untouched: sync/offline layer, auth, family/learners/devices, roles, translations
(en + km), menu, theme/UI kit, PWA/push delivery, Rebus Studio, Trace Studio, Library Studio.

### 2c. How to cut safely

One removal per commit, in this order, with `npm run lint` and the scoped tests green
after each: (1) the four skills, (2) Live coach + tutor, (3) billing, (4) leaderboard,
(5) admin pages, (6) docs and scripts, (7) dependencies. Then a final full run:
`npm run lint`, full vitest, server pytest (≈16 min), and a look at the app at 390 px.

## 3. Clean-up (Phase 2)

- **`App.tsx` is 1,160 lines** holding the gate, tabs, modals and about 20 lazy admin imports.
  After the cuts, split it: signed-out gate, learner shell, adult shell.
- **`Home.tsx` (810) and `LearnPage.tsx` (624)** — re-check against the grade-banded home work
  (Phases 1–3 done; Kid/Focus bands pending). For the MVP only the 5–7 band is needed. Ship that
  one and leave the rest of the band logic for later.
- **Menu and routes**: `sidebarNav.json` and `menu_defaults.py` list 21 destinations. The MVP
  learner and parent need about 7: Home, Learn, Profile, Children, Notifications, Settings, plus
  Studios for the owner. Seed the trimmed menu; the server prunes dead entries on boot already.
- **One place for "Grade"**. See 4.1.
- Run an unused-export pass (e.g. `knip`) *after* the cuts. A quick filename scan found almost no
  orphan files, so the weight is in what is wired in, not in leftovers.

## 4. Gaps and fixes (what the search turned up)

### 4.1 "Grade" does not exist as data — fix before seeding
Everything is gated by **age bands**; Rebus puzzles have `ages` but no grade, and 787 of 2,324
are the broad `[6,12]`. Define one mapping (`grade 1 = 5–7`, `2 = 7–8`, `3 = 8–9`; the bands overlap, so it must be decided once) in `src/lib/ages.ts` /
`server/app/ages.py` and have Rebus, Library and Trace filter by it. 1,878 of 2,324 Rebus puzzles (743 math) start at age 9 or younger. Check how many of the
181 `math` and 828 `quiz` puzzles are really readable at Grade 1 vs 3.

### 4.2 Content seeding is uneven — your deploy plan depends on this
| Content | Seeded on boot today? |
|---|---|
| Skills, art, menu, plans, settings, personas, roles | Yes |
| Rebus puzzles | Yes (`rebus_seed.json`, create-if-absent, in bulk) |
| **Library books** | **No.** Only the Studio writes them; `docs/library-books/*.json` are drafts, `starter-*.json` are bundled passages. |
| **Trace items/collections** | **No.** Only the Studio writes them. `englishSet.ts` is a generator, not a seed. |

Fix: a `library_seed.json` and `trace_seed.json` next to `rebus_seed.json` in `server/app/`,
loaded the same way (create-if-absent, bulk, `published`), plus an export button/CLI in each
Studio so what you author locally becomes the seed file. Note `boot.py` fingerprints the whole
`app` package, so a changed seed file re-runs the seed on the next release — which is what we
want — but a seed that is slow will again miss Cloud Run's startup probe, as it did before
`3122e8e`. Keep it bulk, and measure it with the Library and Trace sets in.

### 4.3 Reading content is thin
Library has 1 of 12 Grade 1 books published and nothing planned for Grades 2–3 (the 12-book plan is band A, ages 5–7 only); book 2 (`sleepy-night-animals`) is waiting on
pictures. Khmer letters are the Grade 1 reading backbone (MoEYS book), but the Course Studio in
`LEARN_KHMER_MVP_PLAN.md` (`src/courses/`) does not exist. **Recommendation:** do not build it
for the MVP. Reading = Library books + Trace letters (Khmer consonants/vowels and English
A–Z) + the spelling-pattern lessons already in `src/library`. Course Studio becomes post-MVP.

### 4.4 Drawing needs a decision and a content set
"Drawing" is two things in the code: **tracing** (Trace, letters/lines/shapes) and **free
painting** (`paint.py`, `paintings.py`, `PaintPicture`). Confirm which the MVP means. Either
way, the English set needs publishing and the Khmer set needs drafting; there are no tests or
grades on the English set yet (noted in memory 2026-10-23).

### 4.5 Parent progress — the stated core purpose
Weekly summary, daily reminder and absence check exist in `tasks.py` (1,308 lines).
Verify end to end on a real device before launch: a child plays → event syncs →
summary email and push arrive in the parent's language. The admin account never syncs learning
data by design, so test with a real family. Also confirm Cloud Scheduler is actually calling
`/tasks/*` in production (`gcloud` logs; do not assume).

### 4.6 Smaller things to fix
- `server.ts` still holds ~10 Gemini routes; after the cut, keep only Studio generation
  (images, voice) and move the key handling into one place.
- Tests: 4 push tests fail in the dev container for an env reason; make CI set
  `PUSH_DRIVER` so the suite is green and trustworthy at the gate.
- Build output `dist/` (27 MB) and `dev-dist/` should not be tracked — check `.gitignore`.
- Audio: the in-scope skills carry ≈12 MB of clips. Confirm they are cached by the service worker
  rather than in the first-load bundle (offline-first requirement).
- Both languages: every string touched by the cuts needs its key removed from `en.json` **and**
  `km.json`, or the catalogs drift.

## 5. Sequence

| Phase | Work | Gate |
|---|---|---|
| 0 | Commit WIP, tag, baseline lint/tests | Clean tree, baseline recorded |
| 1 | Cuts 2c(1)–(7), one commit each | Lint + scoped tests green per commit; app opens at 390 px |
| 2 | Clean-up §3 (App split, trimmed menu, grade-1 home) | Full vitest + pytest; you review in the app |
| 3 | Grade mapping §4.1, seed files + Studio export §4.2 | Fresh empty DB boots under Cloud Run's probe with all content present |
| 4 | Content: Library books 2–6 for Grade 1 then a Grade 2–3 shelf, Trace English + Khmer, Rebus pass by grade | You read each in the app |
| 5 | Parent loop §4.5, production check with `gcloud` | A real family receives a real summary |
| 6 | Deploy; seed; smoke test on a phone on weak internet | Launch |

## 6. Decisions (made 2026-10-28)

1. **Color Sweeper, Bottle Sort, Observation** — keep all three. No skill is cut.
2. **Rebus group rooms and leaderboard** — keep both.
3. **Drawing** — tracing and free painting.
4. **Removal** — delete from `main` after tagging `pre-mvp-cut`; no build flag.

Effect: Phase 1 shrinks to the feature cuts only — Live voice coach and Ask Koda tutor,
billing/plans, the operator pages (Skill Manager, push admin, cleanup, API keys, personas),
docs/mocks/scripts, and unused dependencies. "Hide" rows in 2b for the leaderboard and
group rooms no longer apply.
