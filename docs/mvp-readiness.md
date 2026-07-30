# Koda — MVP readiness

**Where the product actually stands, what blocks a launch to real families, and the order to
fix it in.**

> Assessed 2026-07-28 against the running stack, not against intentions. Every claim below was
> checked: tests run, endpoints called, database read. Items are checked off in place.

---

## 1. Where we are

| | |
|---|---|
| TypeScript | 0 errors |
| Frontend tests | 166 passing |
| Backend tests | 265 passing — including real HTTP against a real Mongo |
| Bundle | role-split; a learner downloads ~109 kB gzip, down from 325 kB |
| Phases 0–4 | implemented **and exercised end to end** against live data |

The hard part is built. Placement → recommendation → mastery → analytics works: a learner is
placed, gets a sensible next skill, climbs the five-rung ladder under real gates, and an adult
can see it. Immutable releases, the A→Z curriculum path, per-skill artwork, and an
admin-configurable streak all function against the real database.

What is missing is the ordinary shell a consumer product needs around that engine.

---

## 2. Blocking — do not launch to real families without these

### 2.1 Password reset — **done** (Step 3)
- [x] `POST /auth/password-reset/request` — issue a single-use, expiring token
- [x] `POST /auth/password-reset/confirm` — verify, set new hash, invalidate refresh tokens
- [x] Email delivery (or a signed link surfaced another way — see the decision below)
- [x] Frontend: "Forgot password" on `AuthScreen`, and the reset screen
- [x] Rate limit the request endpoint; never reveal whether an address exists

**Evidence (2026-07-28).** `/auth/password-reset/request` and `/auth/password-reset/confirm`
are live and covered by 12 integration tests. Verified against the running stack: a real link
arrived in Mailpit and set a new password; an unknown address got a byte-identical 202 with no
mail sent; a refresh token issued before the reset stopped working (`credentials_changed_at`).
Tokens are stored as SHA-256 digests, single-use, 1 h TTL, and swept by a TTL index. The
frontend is `ResetPasswordScreen` — one screen serving both halves, routed on
`/reset-password?token=` from `RoleRouter`, with "Forgot password?" on the sign-in tab.

**Why it blocks.** A parent who forgets their password loses access to their children's
accounts permanently. There is no support tooling to fix it either. This is day-one load that
cannot be absorbed manually.

**Decision needed.** There is no mail transport in the project. Either add one (SES/Postmark/
Resend) or ship an admin-issued reset link for the first cohort. The endpoints are the same
either way; only delivery differs.

*Estimate: ~1 session, plus whatever the mail decision costs.*

### 2.2 Login rate limiting and lockout — **done** (Step 2)
- [x] Per-identifier and per-IP attempt counters with a backoff window
- [x] Applies to `/auth/login` **and** `/auth/student/login`
- [x] Lock a student PIN after N failures — 5 in 15 min, then a 15 min lockout
- [x] …surface that lock to the guardian — **done 2026-07-28**. `GET /family/children` returns
      `pin_locked_until`, the kid tile shows it, and `POST /family/children/{id}/unlock-pin`
      lets a guardian clear it for their own child. Unlocking clears the counter only — it
      cannot change a PIN, so it is not an account-takeover route. 5 integration tests.
- [x] Return the same timing and message for unknown vs wrong-password

**Evidence (2026-07-28).** Policy is a pure function in `app/core/throttle.py` (`ADULT_LOGIN`
8/15 min, `STUDENT_PIN` 5/15 min, `SOURCE_ADDRESS` 30/15 min), applied via
`app/features/auth/guard.py`. Verified live: 8 failed logins against the running API returned
401 and the 9th returned 429. Timing is equalised with `_DUMMY_HASH` so an unknown address
costs the same as a wrong password.

**Why it blocks.** Guessing a child's PIN is currently trivial and unbounded, and it grants
access to that child's account. This is the one item here that is a safety issue rather than a
usability one.

*Estimate: ~1 session.*

### 2.3 React error boundary — **done** (Step 1)
- [x] A root boundary inside `RoleRouter`, above the lazy `Suspense` (so a chunk that fails to
      load is caught too, not just a render error)
- [x] A learner-appropriate fallback — "Let's try that again", never a stack trace
- [x] Report the error (see §2.4) and offer a reload
- [x] A second boundary around the learner's player, so one bad question cannot take the page

**Evidence (2026-07-28).** `frontend/src/components/ErrorBoundary.tsx`, mounted in
`RoleRouter.tsx` and `StudentCurriculumPlayer.tsx`.

**Why it blocks.** One render error white-screens the whole app with no recovery. Much of this
surface renders learner data of varying shape — a skill with no questions, a release missing an
asset, a mastery row from an older schema. A six-year-old facing a blank page cannot recover.

*Estimate: ~1 hour.*

### 2.4 Server-side logging and error reporting — **mostly done** (Step 1)
- [x] Configure `logging` in `app/main.py`; structured output
- [x] Log unhandled exceptions with request context, never with PII or tokens
- [x] A frontend error sink — `POST /telemetry/client-errors`, fed by the boundary
- [ ] A hosted reporter (Sentry or equivalent) — **not done**. Errors land in container logs,
      which nobody is watching. Fine for one developer; not for a cohort. Needs an account/DSN.
- [x] Log the operational signals the design doc calls for — **done 2026-07-28**:
      rejected events (with reasons, in `events/router.py`), recommendation starvation
      (`learning/router.py` — an empty queue is the learner's whole session), stale projections
      and re-score outcomes (`progression/service.py`), placement sparsity
      (`placement/router.py` — a checkpoint skill with no authored questions places a learner
      on thinner evidence than the design assumes).

**Evidence (2026-07-28).** `app/core/logging.py` with `redact()` over `SECRET_HINTS` /
`PERSONAL_HINTS`; `*_id` fields deliberately survive redaction so failures stay traceable.

**Why it blocks.** When something fails in production you will not know it happened. Every
defect found today was diagnosed by reading the database directly — that does not scale past
one developer and one learner.

*Estimate: ~half a session.*

---

## 3. Should fix soon — not launch blockers

- [x] **Swallowing catches — audited 2026-07-28.** Two were hiding a failure from the person
      who needed to know: the academic catalog in `CurriculumDetailsDrawer` (an empty chip list
      and a failed fetch looked identical) and `AppSettingsContext` (defaults presented as the
      account's saved settings). Both now surface. The remaining 11 are deliberate and carry a
      comment saying why — audio autoplay, an optional job-status poll, the three save-queue
      keepalives, and the learner player's enrichment requests, which degrade to `null` so a
      failed streak chip can't block a working lesson.
- [x] **Unbounded event query — capped 2026-07-28.** `activity_snapshot` is bounded at
      `MAX_SNAPSHOT_EVENTS = 25_000`, newest first, served by the existing
      `(student_id, client_timestamp_ms)` index. Deliberately *not* a 90-day window: XP,
      lifetime totals and longest streak are defined over the whole history, so a window would
      silently change what those numbers mean. Hitting the cap logs a warning. Verified against
      live data — snapshot totals still match the collection exactly (227 and 31 events).
- [x] **Data-loss guard on all three autosaving stores — 2026-07-28.** The SVG library, the
      question deck and the curriculum tree each loaded once, kept a server `revision`, and
      resumed saving even when the *load* had failed. Because the revision ref outlives a load,
      a failed reload after a good one would write cached — or default — content over the real
      data and report "Saved". `api/persistenceGuard.ts` makes the rule explicit: reading has to
      succeed before writing is allowed.
- [x] **Portal `Drawer`** — done, same reasoning as `Dialog`.
- [x] **Log noise — 2026-07-28.** pymongo's 10-second heartbeat at DEBUG *was* the log: 761
      lines in 20 seconds, with real events invisible inside it. Noisy libraries are pinned to
      WARNING; the same window is now 5 lines and the startup line is legible.
- [ ] **Tokens in `localStorage`** — XSS-readable. httpOnly cookies are the hardening step.
- [ ] **Single 282 kB stylesheet** (37 kB gzip). Low value until it grows.

---

## 3b. Found by looking — 2026-07-29

The first session driving the real UI. Three defects that every test suite had passed over,
because each needed either real data or a rendered page to exist at all.

- [x] **The Interactive Studio could not save, and blamed the database.** One question of 110
      referenced a skill that had been deleted from a curriculum. `PUT /questions` validated
      the *whole* deck on every save, so that single orphan made every save 400 — including
      the deck the server had just served. There was no way out from inside the app. The
      endpoint now rejects only references a save *introduces*; an inherited orphan is carried
      through and logged. 5 tests.
- [x] **"Saved locally — MongoDB unavailable" was a fabrication.** The studio had a bare
      `error` status with no reason, so it guessed — and sent the author to look at Mongo for
      a curriculum problem. The real message now surfaces.
- [x] **`docker compose build web` builds the wrong stage.** The service declares
      `target: dev` (Vite on 3000, source bind-mounted); a plain `build web` produced the
      nginx stage, which listens on 80, taking `localhost:3000` down. Use
      `docker compose up -d --build web`. Note the frontend needs **no** rebuild at all — it
      is a bind-mounted dev server. Only the backend does.

Verified working on screen: PIN lockout and guardian unlock; both reset-password states; the
Property Studio Components tab; the portaled artwork dialog; the portaled Drawer; the
curriculum details drawer; the settings page.

---

## 4. Accepted as-is

| Item | Why it is fine |
|---|---|
| Demo data in the database | Owner has confirmed it will not be published |
| 22 placeholder technique thumbnails | Geometric, not illustrated — every skill in the live curriculum carries its own library artwork, so these surface only for unstyled skills |
| Frontend `scoringEngine.ts` duplicating the backend engine | Deliberate: it is the reference implementation and the shared-fixture source |

---

## 5. Plan

Ordered so that each step makes the next one cheaper to verify.

### Step 1 — See failures (½ session)
**§2.4 logging + §2.3 error boundary.**

First because everything after is easier to trust once the system can tell you it broke. The
boundary needs somewhere to report to, so logging lands first. Both are small and touch little.

**Done when:** an exception thrown deliberately in a canvas shows a friendly fallback, and the
backend logs an unhandled error with request context and no PII.

### Step 2 — Close the safety gap (1 session)
**§2.2 rate limiting and lockout.**

Before reset, because it is the only item that is a safety issue rather than a usability one,
and because the reset endpoint needs the same limiter.

**Done when:** N failed attempts on a parent login and on a student PIN both back off, an
integration test proves it, and timing does not distinguish unknown from wrong.

### Step 3 — Make accounts recoverable ✅ done 2026-07-28
**§2.1 password reset.**

Last of the blockers because it is the largest, and it reuses the limiter from Step 2.

**Done when:** a parent can reset from the sign-in screen end to end, old refresh tokens stop
working, and the request endpoint reveals nothing about which addresses exist.

### Step 4 — Tidy before the first cohort (½ session)
The §3 list, in this order: swallowing catches (correctness), event-query bound (it grows
forever), `Drawer` portal (one line).

---

## 6. Verification standard

Four defects shipped through a fully green unit suite before integration tests existed: a
thumbnail URL with an invented `/api` prefix, an assignment's `grade_id` never reaching the
code that scopes on it, a `MasteryState` datetime written into a string field, and a modal
trapped in a stacking context. Three more were caught only by looking at the rendered page.

So, for each item above:

1. A test at the layer the defect would live in — integration for anything crossing HTTP,
   auth, or the database.
2. For UI, a look at it rendered. `tsc` and a green build do not see layout or z-index.
3. For anything touching learner data, a check against the real database before claiming it
   works.
