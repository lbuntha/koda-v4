# Plan — growing the flows that already work

Not a list of new features. Each section is a flow that **exists and works today**, written out
as it actually runs, followed by the point where it stops working and the smallest change that
gets it past that point.

Read a section top to bottom and you can run the flow yourself. The ✱ marks are where it
strains.

Status 2026-07-30: 332 backend / 199 frontend tests pass locally. Rewards and rules verified
against live data. Grade 1 Mathematics archived, 0 questions. All learners on the test fixture.

---

## Flow A — Author content and get it to a learner

**Today, end to end:**

```
1. POST   /curricula                        create a draft
2. PUT    /curricula/{id}                   edit the tree (units, skills)   ← studio
3. PUT    /questions                        author questions, tagged by skillId
4. POST   /curricula/{id}/releases      ✱   publish — freezes tree + questions + assets
5. POST   /assignments                  ✱   link one learner to that release
6. GET    /learning/today                   learner's queue
7. POST   /events                           what they did
8. GET    /progress/{student_id}            XP, level, mastery, badges
```

Steps 1–3 and 6–8 are solid: verified this week on real data, and 4/2/12 XP with a 120 level
threshold reconciles exactly.

### ✱ A1 — Step 4 is invisible when skipped

Editing the draft changes nothing for assigned learners; only publishing does. Nothing says so.
This is exactly how Grade 1 Mathematics ended up with rewards its only release never carried,
and it will recur every time you edit after publishing.

**Grow it:** a Curriculum Health warning when the draft differs from the newest release.
Health already runs on every studio render and already knows the draft — it needs the release
alongside it.

**Done when:** editing a published curriculum without republishing shows a warning naming what
has drifted.

### ✱ A2 — Step 5 is one learner at a time

`POST /assignments` takes a single `student_id`. A class of 25 across five subjects is 125
calls. `Classroom` and `ClassEnrollment` already exist and are already wired into permissions
(`authorize_guardian_read` grants a teacher access via active enrolment) — they are simply
unused.

**Grow it:** `POST /assignments` accepting a `classroom_id` instead of a `student_id`, fanning
out to enrolled learners. Same validation, same records written; only the loop is new.

**Done when:** assigning a curriculum to a classroom reaches every enrolled learner in one
action.

### ✱ A3 — Step 3 does not scale by hand

Thirty skills at five questions each is 150 questions. The AI generator exists
(`POST /ai/generate`, now authoring-roles only with a per-account hourly quota) and produces
them; accepting them is one at a time.

**Grow it:** only if it proves painful. Generate one unit's worth first and see. Building a
review queue before knowing the shape of the problem is guessing.

---

## Flow B — A family starts using Koda

**Today, end to end:**

```
1. POST /auth/register                      parent account, family_code generated
2. POST /family/children                    add a child
3. PATCH /family/children/{id}              set a PIN
4a. POST /auth/student/login                child signs in: family code + name + PIN
4b. POST /auth/student/launch               or parent taps their profile
5. GET  /learning/today                     plays
```

This works and is well covered: PIN lockout with guardian unlock, throttling, and the
guardian-stash fix all landed this week.

### ✱ B1 — Step 2 leaves a child with nothing to do

Adding a child creates no assignment. They sign in to an empty app until an adult assigns a
curriculum, and nothing prompts that.

**Grow it:** after `POST /family/children`, offer the assignment in the same screen — the
parent has just told you the grade, and there is exactly one published curriculum per grade ×
subject to offer.

**Done when:** a newly added child has something to play without a separate step.

### ✱ B2 — Nothing moves a child up a grade

Rolling from Grade 1 to Grade 2 means archiving assignments and recreating them by hand.

**Grow it:** later. It is once-a-year work and does not block anything until you have a second
grade published.

---

## Flow C — Tune how the app scores and rewards

**Today:**

```
1. GET /settings          admin reads scoring config
2. PUT /settings          admin edits it            ← Settings → Progression & mastery
3. every engine reads it live
```

Rewards joined this flow this week, alongside streak, placement and recommendation. A
curriculum inherits system values and may override them. XP replays from events, so changing a
value re-scores history rather than leaving old figures stranded.

### ✱ C1 — A stored settings document never gains new sections

Fixed on 2026-07-30, and worth recording because it will recur in shape: `rewards` was added to
the defaults, and every existing install carried on resolving XP to zero because the stored
document predated the key. `get_system_settings` now fills absent sections from the defaults.

**Nothing to do.** The pattern to remember: adding a key to `DEFAULT_SCORING_CONFIG` reaches
existing databases only because of that merge.

---

## Flow D — Artwork reaches a skill

**Today:**

```
1. Assets page / SVG designer        author or paste SVG
2. PUT /svg-assets                   saved per account, sanitised against an allowlist
3. attach to a skill or component    stored as thumbnailAssetId
4. GET /learning/assets/{release}/{asset}   served to the learner from the release manifest
```

Works. Sanitisation is an allowlist as of this week, verified against all 9 real assets
unchanged.

### ✱ D1 — Nothing warns when a skill has no artwork

Not blocking; skills fall back to component defaults. Worth a health check eventually,
alongside A1.

---

## Flow E — Verifying a change did not break anything

**Today:**

```
local:  cd backend && .venv/bin/python -m pytest -q      332 tests
        cd frontend && npm test && npm run lint          199 tests, 0 TS errors
CI:     .github/workflows/ci.yml
          frontend  → typecheck, build, test   ✓
          backend   → compileall only          ✱
        triggers: pull_request, push to main   ✱
```

### ✱ E1 — The backend suite never runs in CI

`compileall` proves the modules import. None of the 332 tests execute — including every
integration test that would have caught this week's defects.

### ✱ E2 — CI does not run on the branch the work is on

It triggers on `pull_request` and `push: [main]`. All work is on `feat/backend`, so nothing has
run on any of the eleven pushes.

**Grow it:** add a MongoDB service container and a pytest step; add `feat/**` to the push
triggers.

**Done when:** pushing to `feat/backend` shows both suites passing on GitHub.

---

## Where to start

**E1 and E2 first.** They are the smallest change here and the only ones that make everything
else checkable by you rather than by me running commands. Until then, "all tests pass" is a
statement about my laptop.

**Then A1**, because Flow A is the one you are about to run repeatedly on Grade 1 Mathematics,
and A1 is the step in it that fails silently.

Everything else can wait for its flow to actually strain.
