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

Grades 1–3 is where the launch content is focused, **not a trim**: no lesson, puzzle, book or
skill is removed for any grade, and Grades 4–6 content will be provided later. Higher-grade
lessons already in the code (e.g. ages 10–12 division and fractions) stay as they are.

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
| Live voice coach + Ask Koda tutor | `LiveVoiceCoachModal` (970), `KodaAskModal` (410), `/api/live` socket in `server.ts`, `tutorApi` | **Keep, switch off** (decided 2026-10-28) | Already switchable in System settings → Ask Koda (`ai.enabled` master, `ai.chat`, `ai.liveVoice`). For the MVP deployment set `ai.enabled` off; no code is deleted. New `ui.kodaMascot` switch keeps the character on screen (tap says hello) when AI is off, or hides it entirely. |
| Billing, plans, upgrade requests | `routers/billing.py` (475), `services/entitlements.py`, `BillingPage`, `PlanCard`, `UpgradePrompt`, `featureGate`, `premiumLessons` | **Keep** (decided 2026-10-28) | Users are on a free plan, and the plan checks gate Ask Koda and premium lessons. Nothing is removed. |
| Leaderboard + buddies | `routers/leaderboard.py` (448), `LeaderboardPage` (725), `docs/LEADERBOARD_PRIVACY.md` | **Hide** | A privacy surface for children that the MVP does not need. Parents hearing progress is the point, not ranking. |
| Rebus group rooms | `routers/rebus_rooms.py`, `rebus/group` | **Decide** | Just built; useful in a classroom. If the first users are families, hide it. |
| Skill Manager, Skill registrations | `SkillManagerPage` (1,575), `LearningLogPanel`, `PracticeLogPanel`, `routers/skill_registrations.py` | **Hide** | The largest component in the app, for one admin. With 3 skills there is nothing to manage. |
| Push admin console | `PushTemplates`, `PushJobs`, `PushAudiencePanel`, `PushAnnounce`, `NotifyEventsPanel` (≈1.8k) | **Hide, keep delivery** | Delivery stays (core purpose). Admin needs only on/off and schedule, as planned 2026-09-15. |
| Data Cleanup, API keys, Subjects, Personas/Koda Characters admin | `DataCleanupPage` (823), `ApiKeysPanel`, `SubjectsPage`, `KodaCharacters` (554), `routers/personas.py` | **Hide**; cut Personas with the live coach | Operator tools; not on any child or parent path. |
| Dev scaffolding | four Rebus HTML mockups in `docs/`, `scripts/seed-push-demo.js` | **Cut — done 2026-10-28** | Throwaway design mocks and a demo-data script. Kept: `skills/kit/example` (the documented starting point for any new skill), the per-skill build plans (every skill stays), design specs, `generate-observation-art.mjs`. |
| Dependencies | `@anthropic-ai/sdk`, `@dicebear/*`, `firebase`, `@google/genai` | **Audit after the cuts** | Remove only what `grep` shows unused once the Live coach and tutor are gone. `@google/genai` stays if Studio image/voice generation stays. |

Keep untouched: sync/offline layer, auth, family/learners/devices, roles, translations
(en + km), menu, theme/UI kit, PWA/push delivery, Rebus Studio, Trace Studio, Library Studio.

### 2c. How to cut safely

One removal per commit, in this order, with `npm run lint` and the scoped tests green
after each: (1) operator pages, (2) docs, mocks and scripts, (3) unused dependencies.
No skills, billing, leaderboard, group rooms or Ask Koda are cut. Then a final full run:
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
- Run an unused-export pass (e.g. `knip`) *after* the cuts. A quick filename scan found almost no
  orphan files, so the weight is in what is wired in, not in leftovers.

## 4. Gaps and fixes (what the search turned up)

### 4.1 Grades — already defined; no mapping or gate to build (corrected 2026-10-28)
`src/lib/ages.ts` already says **grade = age − 5** (Grade 1 = age 6, Grade 3 = age 8), the
Studios author in grades and store ages, and lessons are hidden when they start more than a
year above the child. So an age-8 Grade 3 child sees lessons starting at ≤ 9 and content
tagged for ages 7–9. That is the "ages 5–9" band used above. Earlier drafts of this plan
said otherwise; they were wrong.
Consequences: (a) no "Grade 4+ gate" is needed — a 10-year-old simply gets the ages 10–12
fractions and division lessons that already exist; (b) the open item is *content* for the
oldest children, not code. Rebus puzzles carry `ages` (1,878 of 2,324 start at 9 or
younger), so nothing needs a new field; spot-check the 181 `math` and 828 `quiz` puzzles for
reading level at Grade 1 vs 3.

### 4.2 Content moves to production by a content pack, not by boot seed
| Content | Reaches a fresh server today? |
|---|---|
| Skills, art, menu, plans, settings, personas, roles | Yes — seeded on boot |
| Rebus puzzles | Yes — `rebus_seed.json`, create-if-absent, in bulk |
| **Library books** | **No.** Local DB: 6 books, 55 images (7.4 MB), 16 audio clips (3.2 MB), 3 unit voices |
| **Trace items/collections** | **No.** Local DB: 76 items (3.9 MB), 4 collections, 1 painting |

Boot seed is the wrong tool for these: ≈15 MB of authored images and audio, while
`boot.py` hashes every file in the `app` package on each start and a slow seed already missed
Cloud Run's probe once (`3122e8e`). Instead: `python -m app.cli content-export <dir>` writes
the published Library and Trace content (plus its images/audio) to a folder or zip;
`content-import <dir>` loads it create-if-absent, so a re-run never overwrites an admin's edits.
Run it once per deploy against the production database, as `create-admin` already is.
The pack is generated from your local Studio, so authoring stays where it is.

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

### 4.5 Parent progress — checked 2026-10-28
- **Logic:** 154 server tests pass (tasks, reminders, progress/parent notifications, email, language).
- **Scheduler (production, `learn-with-koda`):** `weekly-summary`, `daily-reminders`, `skill-announcements`
  run hourly and `token-sweep` daily, all enabled; the last runs returned 200. The absence check and daily
  digest run inside `daily-reminders`, so they need no job of their own.
- **Email does not leave production.** `koda-backend` has `MAIL_DRIVER=console`, so every email (weekly
  summary, password reset, verification) is only written to the log. `SMTP_*` is configured but unused,
  and `MAIL_FROM` is `no-reply@koda.local`, which a real mail server would reject or spam-file.
  `REQUIRE_EMAIL_VERIFICATION` is false, consistent with that. Fix before launch: switch the driver to
  `smtp`, use a sender on a domain you control, and send a real test summary.
- **Push:** `PUSH_DRIVER=fcm` with `FIREBASE_PROJECT_ID` set. Not yet tested on a real device from this
  deployment (the dev container uses the console driver).
- Still to do: one real family end to end — a child plays, the event syncs, the parent receives the
  summary email and the push, in the parent's language.

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
| 3 | Content pack export/import §4.2 | A fresh empty database plus `content-import` shows the same books and trace items as local |
| 4 | Content: Library books 2–6 for Grade 1 then a Grade 2–3 shelf, Trace English + Khmer, Rebus pass by grade | You read each in the app |
| 5 | Parent loop §4.5, production check with `gcloud` | A real family receives a real summary |
| 6 | Deploy; seed; smoke test on a phone on weak internet | Launch |

## 6. Decisions (made 2026-10-28)

0. **No grade is trimmed.** Launch focus is Grades 1–3; content for Grades 4–6 follows later.

1. **Color Sweeper, Bottle Sort, Observation** — keep all three. No skill is cut.
2. **Rebus group rooms and leaderboard** — keep both.
3. **Drawing** — tracing and free painting.
4. **Billing** — keep; users are on the free plan.
5. **Removal** — delete from `main` after tagging `pre-mvp-cut`; no build flag.

Effect: Phase 1 shrinks to the operator pages (Skill Manager, push admin, cleanup, API keys, personas),
docs/mocks/scripts, and unused dependencies. "Hide" rows in 2b for the leaderboard and
group rooms no longer apply.
