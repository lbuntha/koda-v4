# The family surface — what to build, and in what order

`docs/ARCHITECTURE.md` is the map of what exists. **This file is the plan for
what does not**: the screens and rules that let an adult manage the children and
the adults in their household.

The scope is deliberately *not* content. More skills are coming and they are the
larger prize, but this plan is about the surface around them — and that surface
is where the product currently thins out.

---

## Why this, and why now

Three things were built to very different depths.

**The learning engine** (`src/lib/learning/`) is the strongest part of the
codebase. First-try accuracy held apart from post-hint accuracy, support rate as
its own signal, a nine-kind error taxonomy, abandonment counted as evidence, and
mastery gated on *distinct days practised* rather than one good afternoon. That
last decision is one most commercial products get wrong.

**The operator console** is complete: platform roles, the menu editor, the plan
editor, the system switchboard, the shared art library, skill publication.

**The family surface is thin.** A parent can create a child, pair their tablet
and set a daily goal — and then nothing. They cannot see what the child has
learned, cannot recover their own password, cannot add a second adult, cannot
sign out a lost tablet, and cannot decide how the app behaves for one child
rather than the whole family.

So the engine knows a great deal and tells nobody, and the console can govern a
thousand families that do not exist yet. This plan closes the gap in the middle.

### The finding that set the order

`App.tsx` used to build a `ParentDiagnosticReport` from hardcoded values —
a student named "Alex", 42 minutes, strengths in algebraic balance scales and
improper fractions. None of it was content the app ships, and it was never
rendered. It was scaffolding from the original template that outlived its
purpose.

Meanwhile `getAllMastery()` computes a real version of that report — per
concept, from actual evidence, with error attribution — and shows it only to
developers, inside the Skill Manager, behind `content:write`: a permission no
parent will ever hold.

The parent report is not a feature to build. It is a feature already built and
pointed at the wrong audience. That is why Phase A is first and why it needs no
backend work at all.

---

## The three seams this plan leans on

Each phase is small because it uses a seam that already exists. Worth stating
them plainly, because they are what keeps the work from becoming a subsystem.

**1. The rollup already matches the client's shape.**
`GET /v1/sync/profile/{learnerId}` returns `concept_totals` rows whose fields are
exactly the client's `ConceptTotals` — `repos/rollups.py` and
`learningLog.ts` agree field for field, and `docs/ARCHITECTURE.md` §5 states
that agreement as a contract. Tenancy and `learner_data:read` are already
enforced on the route. So a parent's view of a child can run the *same* mastery
function the child's own device runs, over server data, with no new endpoint.

**2. A new synced setting is one row in a table.**
`src/lib/sync/kinds.ts` on the client, `DOC_KINDS` in `models/sync.py` on the
server. Add a row to each and a document syncs, scopes and permissions itself.
Phase B uses this once and then every parental control after it is a *field*.

**3. `services/codes.py` is a general mechanism.**
Short, hashed, single-use, expiring codes — built for pairing a child's tablet,
and equally the right shape for inviting a second adult. Phase D reuses it and
so does not have to wait for email.

---

## The rule to hold across all of it

> The parent's view and the child's device must never disagree about the same
> child.

The pedagogy lives in `mastery.ts` and is expressed once. Any screen that wants
a judgement calls that function; nothing re-implements a threshold, and nothing
computes a second opinion server-side. When a figure cannot be defended from
evidence, the screen says so rather than rounding it into confidence.

A second rule, inherited from the recommender, which already separates `reason`
(for grown-ups) from `kidMessage` (for children):

> The child never sees a score. The parent always sees the evidence.

---

## Phase A — See the child ✅

*The parent's core loop. No backend work — and none was needed.*

| Step | What | |
|---|---|---|
| **A1** | Export the pedagogy as a pure function | done |
| **A2** | Fetch another learner's totals | done |
| **A3** | Build the report page | done |
| **A4** | Honest thin states | done |
| **A5** | Delete the fake report | done |
| **A6** | Entry points | done |

Landed as `src/lib/childReport.ts` (+ 15 tests), `src/lib/learning/mastery.ts`
(`masteryFrom` exported), `src/components/account/ChildReportPage.tsx`, and
entry points on the Children and Profile pages.

**A1.** `src/lib/learning/mastery.ts` — `toMastery()` is already pure. Export it
as `masteryFrom(totals)`. `getConceptMastery()` stays as the device-local
caller. One implementation of the thresholds, two callers.

**A2.** `src/lib/childReport.ts` — `GET /v1/sync/profile/{learnerId}` →
`ConceptTotals[]`. Lives in `lib/`, not in a component: the layering rule says a
component never calls `/v1`.

**A3.** `src/components/account/ChildReportPage.tsx`, four sections:

1. **Rhythm** — last practised, days this week, and rounds/questions all-time,
   from `practisedOn` and `lastSeenTs`. Rounds *this week* is deliberately
   absent: `practisedOn` carries dates and `lessonsCompleted` carries a
   cumulative count, and nothing ties the two together, so the figure cannot be
   derived. An invented one would undermine every honest number beside it.
2. **Where she is** — concepts grouped `mastered` / `practising` / `struggling`
   / `not started`. Friendly names come from lesson titles via the registry, so
   no new data is needed.
3. **Why she's stuck** — `topErrors` in parent English. The `ErrorKind` doc
   comments in `events.ts` are already written; they become the copy.
   Nothing else in this category tells a parent *which* misconception.
4. **Nearly solo** — high accuracy plus high `supportRate`: has the idea, still
   leaning on hints. `mastery.ts` identifies this case and nothing surfaces it.

**A4.** Below `MIN_EVIDENCE` first attempts, refuse to judge — "still getting to
know Mia, about three more rounds". Being honest about insufficient evidence is
the feature; a confident number from two data points is what everyone else ships.

**A5.** Remove `parentReport` from `App.tsx` and `ParentDiagnosticReport` from
`types.ts`.

**A6.** A "View report" button on each `LearnersPage` card, and each child in the
`ProfilePage` Children card. Gated on `learner_data:read` — which is also what
finally gives the **caregiver** role something to do: a grandparent who sees
everything and changes nothing.

---

## Phase B — Control the child ✅

*B1–B5 done. Phase B is complete: the four settings exist, sync, are enforced,
and a parent can set them from the Edit child modal.*

*What a parent decides per child. Mostly about installing the seam.*

**B1. The `childSettings` doc kind.** ✅ *done*

- Client: one row in `kinds.ts` — `{ storageKey: "koda_child_settings_v1", scope: "learner", shape: "whole", notify }`
- Server: `"childSettings"` in `DOC_KINDS`; `KIND_PERMISSIONS["childSettings"] = "learner:update"`; added to `LEARNER_OWNED_KINDS`

**One correction to the claim above.** "One row in `kinds.ts`" was not true when
this was written: `apply.ts` kept its own list of which kinds store a body
whole, so a new kind needed a row *here* and an entry *there* — and forgetting
the second wrote the document into the wrong shape rather than failing. That
fact now lives on the kind as `shape`, and `apply.ts` reads it. The sentence is
true as of B1, and a `Record<DocKind, KindSpec>` means the compiler enforces it.

That combination yields exactly the right access without a line of new
authorization code: **a parent writes any child's, a student writes only their
own, a child writes none.**

The student half of that was true on paper and unreachable in practice until
signup was fixed: a `student` account had no learner row and so no `learnerId`,
which left every learner-scoped thing in the service falling back to a
per-device id. Signup now mints one. A parent still gets none — an adult running
a household is not somebody's pupil. And `docs.since` already routes learner-scoped
documents down to that learner's device, so the settings arrive where they are
enforced and work with no connection.

This is the growth seam. Every parental control after this is a field in one
body — never a new endpoint, never new page plumbing.

**B2. `src/lib/childSettings.ts`** ✅ *done* — modelled on `dailyGoal.ts`, which is
already per-learner, already synced, and already has the subscribe/version
shape.

**B3. Three fields, each with real enforcement behind it.** `plan_defaults.py`
states the doctrine: a feature is not real until something refuses without it.

| Field | Enforced where |
|---|---|
| `sessionMinutes: number \| null` | Round loop and Home. Over the cap, the path closes with a warm "that's it for today", not an error. Day-keyed like `streak.solvedToday`, and deliberately **not** monotonic — see the note on day-scoped figures in `MONOTONIC_PROGRESS_FIELDS` |
| `aiHelpEnabled: boolean` | The same gate as the `ai.koda` entitlement, so the two compose: the plan allows it **and** the parent allows it |
| `goalCadence: "daily" \| "weekly"` | Counts distinct days in a week instead of a running flame. Defaults to `daily`, so nothing changes for anyone until a parent chooses |

On `goalCadence`: for a four-to-eight-year-old a daily streak is a punishment
mechanic, because the child does not control device access — the parent does. A
streak broken because Tuesday was busy teaches a six-year-old that the app is
arbitrary. Making it a per-child setting turns that from an argument into a
parent's call.

**B4. `startingPoint: number | null`** ✅ *done* — the manual form of placement. "Mia
already knows this; start her at Unit 3."

Deliberately **not** implemented by seeding mastery evidence. Fake evidence
would poison the Phase A report with concepts marked mastered on zero questions
answered. `startingPoint` is honoured by the curriculum's unlock check
*alongside* mastery instead. Adaptive placement, when it comes, writes the same
field — so the manual control and the eventual automatic one share one data
model and the report stays truthful under both.

**B5. UI** ✅ *done* — extends the existing "Edit child" modal in `LearnersPage.tsx`. It
already holds `DailyGoalField` with a draft-then-save pattern, and already
explains why: a control that saves on tap makes the Cancel button a lie.

**B6.** Each field gets a test that the *rule* holds, not that the value
round-trips. ✅ *done*

| Field | The rule pinned |
|---|---|
| `sessionMinutes` | Play until the cap, then no more rounds until tomorrow — including after a round overran it |
| `aiHelpEnabled` | Plan and parent compose, and a child is told *which* one said no |
| `goalCadence` | A weekly run survives the gap that kills a daily one, and still ends on a missed week |
| `startingPoint` | Opens the door and satisfies prerequisites, without recording completion |

Writing these found a real bug: `requireKodaHelp` returned whatever
`requireFeature` returned, which is *whether the plan allowed it* — so it
reported `true` when the parent's switch had stopped the action. It now reports
whether the action ran, which is what `requireFeature` documents the value to
mean and what every caller reads it as.

---

## Phase C — Hold the account ✅

*Phase C complete.*

Building C2 turned up something older: the service had **no logging
configuration at all**, so every `koda.*` logger wrote at INFO into a root
logger defaulting to WARNING. The request access log had never appeared, and the
console mail driver — whose whole job is putting a reset link where a developer
can read it — would have been silent. Configured once in the app factory.

**C1. `PATCH /v1/auth/me/password`** ✅ *done* — signed in, requires the current password.
No email dependency, about an hour's work, and it closes the ordinary case.
Ship it whenever; it does not need the rest of this phase.

**C2. Mail transport — `server/app/services/mail.py`.** ✅ *done* One function,
`send(to, subject, body)`, and two drivers chosen by settings: `console` for dev
and tests, `smtp` for production. Env vars in `settings.py`, per the read-once
rule. It is the first external dependency in the stack, so it goes in behind a
seam and a later move to SES is a driver rather than a refactor.

**C3. Password reset.** ✅ *done*

- `POST /v1/auth/password/forgot` — public, and **always 204** whether or not
  the address exists. The signup route already takes care not to confirm which
  emails have accounts; this matches it. Rate-limited per IP and per address.
- The token reuses the `codes.py` discipline: random, stored hashed, 30-minute
  expiry, single use.
- `POST /v1/auth/password/reset` — on success, **revoke every device for that
  user**. A reset is what somebody does when they think another person has
  access.
- Client: "Forgot password?" in `AccountForm.tsx`, and a reset screen reachable
  *before* the gate.

**C4. Parent PIN on the account switcher.** ✅ *done*

Today a child in a switched session can open the sidebar switcher and land back
in the parent's session — billing, scoring, "remove child" — with one tap,
because the parent's refresh token is still in the accounts list.

- `pinHash` on the family document, argon2 via `security/passwords.py`.
- `PUT /v1/family/pin` behind **`family:update`** — one of the five permissions
  that currently exist in the table with no route behind them.
- `POST /v1/family/pin/verify`, rate-limited.
- Client: in `SessionAPI.switchAccount()`, when the current session is a child
  and the target is not, require the PIN first.

**Say plainly in the code what this is.** The parent's refresh token lives in
the same `localStorage` the child's session can read, so this is a speed bump
sized to the real threat — a seven-year-old tapping — and not a cryptographic
boundary. `routers/profile.py` is candid in exactly this way about reported
versus observed figures; match its tone. A real boundary would mean encrypting
the stored parent token under a key derived from the PIN, which is hardening and
not part of this plan.

The switcher is the only hole of its kind: the child role genuinely lacks the
permissions for Settings, Billing and Children, so those pages already refuse.

**C5. Device management UI** ✅ *done* — `GET /v1/devices` and
`DELETE /v1/devices/{id}` both exist and are tenancy-safe.

**One thing had to be fixed first, and it was not in this plan.** A device row
was written on *every sign-in*, so one laptop signed into a dozen times was a
dozen rows all called "This device" — a list nobody could find a lost tablet in,
and a password change that reported "15 other devices were signed out" to
somebody who owned one. The client now mints a stable install id and keeps it;
the server rotates the row that install already has instead of writing another.
A client that sends no id still works and simply goes unhelped. Show name, kind, last seen and a "this device"
marker; revoke behind the `UIDialog` confirm already used for removing a child.
One small backend addition: return `learnerId` on the row, so the list can say
"Mia's iPad" rather than "This device".

---

## Phase D — Grow the family ✅

*Complete. A family can have two adults in it.*

**D1. Co-parent invite, by code rather than email.** ✅ *done*
`POST /v1/family/invites` behind **`member:invite`** → an eight-character code
from `services/codes.py`, seven-day expiry, role baked in (`parent` or
`caregiver`). Redeemed at `POST /v1/family/invites/redeem`.

A code rather than an emailed link for three reasons: it does not depend on
Phase C's mail transport, it reuses a flow already tested end to end, and it
fits the common case where both parents are standing in the same kitchen.

One guard, and it turned out to be the normal case rather than an edge: signup
always mints a family, so somebody invited as a second parent arrives already
owning an empty one. Refusing them outright would make the feature unreachable.
So redeem moves them only when there is provably nothing to strand — no children
and no other members — and refuses with `family_not_empty` otherwise. The empty
family is left behind rather than deleted: it costs nothing, and a delete would
be the one destructive step in an accept flow.

Two smaller things the flow needed. A person's **devices move with them**, because
a refresh reads the family off the device row — without that they would keep
being handed tokens for the family they left. And **removal revokes their
sessions in that family only**, so an account that belongs somewhere else keeps
what it holds there.

**D2. `DELETE /v1/family/members/{user_id}`** ✅ *done* (`member:remove`) — never the
owner; revokes that user's devices in this family.

**D3. `PATCH /v1/family`** ✅ *done* for the family name (`family:update`, already added
in C4). Surfaced in Settings.

**D4. Strip what is still dead.** ✅ *done* After D1–D3 only `family:delete` and
`family:transfer` remain unimplemented. Remove them from the label map in
`RolesPage.tsx` until they exist. A rights checkbox that grants nothing is worse
than an absent one: it teaches a parent that the page lies.

---

## Sequence

```
C1  own password change     ship whenever — about an hour
A   child report            highest value, zero backend
B   per-child controls      installs the growth seam
C4  parent PIN              pull forward the moment a real family switches
C2  mail + reset            one dependency, also unblocks the digest later
C5  devices                 small
D   family growth           last
```

**A before B**, because the report is what tells you which controls parents
actually reach for. **B before C**, because B is the management surface and C is
the safety net. **C4 jumps the queue** as soon as anyone real is switching
between a parent and a child on one tablet — that is an open hole today, not a
future one.

---

## Deliberately not in this plan

- **Adaptive placement.** B4's manual `startingPoint` gets most of the value and
  shares the data model, so the adaptive version is a later upgrade rather than
  a rewrite.
- **The weekly digest.** The mail transport in C2 is the hard part; the digest
  is a scheduled job over figures Phase A already computes. It earns its keep
  once there is more than a fortnight of content to report on.
- **Mastery decay and a review queue.** Still the strongest single pedagogical
  improvement available — `lastSeenTs` is collected on every concept and read by
  nothing, so mastery is currently permanent. But it is engine work rather than
  management, and it pays off in proportion to the size of the library.
- **`family:delete` and `family:transfer`.** Real account-lifecycle features
  with no MVP urgency.
- **The `student` role, as a segment.** The plumbing is now correct — a student
  is their own learner, with a row, a record and their own settings — but the
  option is off the signup form, because the content still tops out around age
  eight and somebody choosing "Student" would get a first lesson counting to
  ten. Restoring the choice is two buttons in `AccountForm`; nothing behind it
  was removed.
- **More operator console.** It is finished enough for ten thousand families.
  The family surface is not finished enough for ten.
