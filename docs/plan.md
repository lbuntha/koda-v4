# Plan — from here to a real curriculum running at scale

**Ordered so each phase makes the next one safe. Every step has a "done when" you can check
yourself.**

Status as of 2026-07-30: rewards and rules verified correct; 332 backend / 199 frontend tests
passing locally; Grade 1 Mathematics archived with 0 questions; all learners on the test
fixture.

---

## Phase 1 — Make the safety net real (half a day)

Everything after this changes content and data. Right now nothing catches a regression
automatically, which is the wrong order to do the rest in.

- [ ] **1.1 Run the backend tests in CI.** `.github/workflows/ci.yml` runs `compileall` only —
      none of the 332 backend tests execute. Needs a MongoDB service container, since the
      integration tests use a real one.
- [ ] **1.2 Run CI on working branches.** It triggers on `pull_request` and `push: [main]`.
      Work happens on `feat/backend`, so nothing has run on any of it.
- [ ] **1.3 Fail the build on type errors in CI** — already there for the frontend; confirm it
      is not `continue-on-error`.

**Done when:** you push to `feat/backend`, and GitHub shows both suites running and passing.

*Why first: without this, every later phase is verified only by me running commands by hand.*

---

## Phase 2 — Rails before generating content at volume (1 session)

Both of these are failures we have already hit once. Generating questions into 30 skills will
hit them repeatedly.

- [ ] **2.1 Draft-vs-release drift warning.** A curriculum whose draft differs from its
      published release silently does nothing for assigned learners. This is exactly how Grade
      1 Mathematics ended up with rewards its release never carried. Surface it in Curriculum
      Health.
- [ ] **2.2 Reference check before deleting a skill.** Deleting a skill orphans its questions.
      The save deadlock is fixed, but the orphan is still created silently. Warn with the count
      before the delete.
- [ ] **2.3 Clear the existing orphan** (`skill-1785110426374-cfq23f`, 1 of 94 questions).

**Done when:** editing a published curriculum without republishing shows a health warning, and
deleting a skill with questions asks first.

---

## Phase 3 — One real curriculum, end to end (1–2 sessions)

Prove the whole pipe with one subject before repeating it 60 times.

- [ ] **3.1 Decide the fate of Grade 1 Mathematics** — unarchive and keep its 11 units / 30
      skills, or start fresh. Recommendation: unarchive. The scope-and-sequence is the
      expensive part and it is already done; only questions are missing.
- [ ] **3.2 Generate questions** for its 30 skills via the AI generator (GPT-4o Mini).
      Target ≥5 per skill; curriculum health already flags shortfalls.
- [ ] **3.3 Review and accept** the generated questions. Bulk review does not exist yet — if
      one-at-a-time proves painful, that is the signal to build it (see 5.3).
- [ ] **3.4 Publish a release.**
- [ ] **3.5 Assign one learner** with `grade_id` matching their grade.
- [ ] **3.6 Verify on screen**: play an activity, confirm XP matches 4/2/12 inherited from
      system settings, level advances at 120, and mastery sits at *developing* after one
      session.

**Done when:** a learner plays Grade 1 Mathematics and every number on their screen is
explainable from `docs/rewards.md`.

*This is the phase that proves rewards, rules, releases and assignment all work together on
real content rather than a fixture.*

---

## Phase 4 — Structure for many subjects and grades (1 session)

- [ ] **4.1 Add grades 2–12** to the catalog (11 records).
- [ ] **4.2 Add subjects per grade** — script it. 60 records by hand invites a wrong
      `grade_id`, which silently produces a curriculum whose units cannot be scoped.
- [ ] **4.3 Second subject for one grade** (Science already exists as `grade-1-science`).
      Assign a learner both, and confirm the queue interleaves — the engine already does this,
      verified against the real recommender.

**Done when:** one learner has two subjects and their daily quest alternates between them.

---

## Phase 5 — Operations that scale (1–2 sessions)

The gaps that bite once there are real cohorts.

- [ ] **5.1 Assignment by classroom.** `Classroom` and `ClassEnrollment` exist and are wired
      into permissions but unused. Assigning a class of 25 to five subjects is 125 API calls
      today. This closes 5.2 as well.
- [ ] **5.2 Bulk reassign to a new release** — otherwise every publish means touching every
      learner by hand.
- [ ] **5.3 Bulk review for generated questions** — build only if 3.3 proved painful.
- [ ] **5.4 Grade rollover** — moving a learner up a grade is archive-and-recreate by hand.

**Done when:** assigning a curriculum to a classroom reaches every enrolled learner in one
action.

---

## Phase 6 — Production (1 session + accounts)

Nothing here is code-blocked; most needs a decision or an account.

- [ ] **6.1 Production config** — `ENVIRONMENT`, `JWT_SECRET`, `CORS_ORIGINS`, `APP_BASE_URL`.
      The config guard refuses to boot without real values, so this is a hard gate.
- [ ] **6.2 Mail provider** (SES/Postmark/Resend). Password reset works and is tested; only
      delivery is local-only.
- [ ] **6.3 Hosted error reporter** — needs a DSN. Errors currently land in container logs
      nobody watches.
- [ ] **6.4 Tokens to httpOnly cookies** — the largest remaining security item, and a real
      refactor across every request path. Its own session.
- [ ] **6.5 Decide what happens to demo data** before any deploy.

**Done when:** the app boots with `ENVIRONMENT=production` and a parent can reset their
password by email.

---

## Sequencing notes

- **1 before everything.** It is the only phase that protects the others.
- **2 before 3.** Generating into 30 skills without the rails means creating the same mess we
  just cleaned up, at volume.
- **3 before 4.** Prove one subject works before creating 60 curricula.
- **5 can wait** until there is more than one family.
- **6 is independent** — it can happen alongside 3–5 whenever the accounts exist.

## Not on this list, deliberately

- **Rewards and rules.** Verified 2026-07-30 against live data and the configured gates. No
  known defects.
- **Security.** Cross-tenant isolation proven by a 24-attack sweep; AI proxy restricted and
  metered; SVG sanitisation on an allowlist. Open item is 6.4 only.
