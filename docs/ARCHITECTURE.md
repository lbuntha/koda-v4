# Koda architecture — the two halves

`docs/PLUGINS.md` describes how a skill is built. `docs/BACKEND.md` describes
the sync design in depth. **This file is the map**: what lives where, which
layer may talk to which, and why a thing is in the database rather than in the
bundle.

One sentence holds the whole design together:

> The device is the source of truth while a child is playing. The database is
> where that truth is kept safe, merged across devices, and read by an adult.

Everything below follows from that. If a change would make the app wait on the
network to do something a child does, it is the wrong change.

---

## 1. The shape

```
┌─────────────────────────────── one origin ───────────────────────────────┐
│                                                                          │
│  Browser (PWA)                Express :3001                FastAPI :8000 │
│  ┌──────────────┐             ┌──────────────┐            ┌────────────┐ │
│  │ React app    │──── / ─────►│ SPA + assets │            │ /v1/*      │ │
│  │ localStorage │             │ /api/* Gemini│            │ auth       │ │
│  │ service wkr  │──── /v1 ───►│ proxy ───────┼───────────►│ sync       │ │
│  └──────────────┘             │ /api/live ws │            │ family     │ │
│                               └──────────────┘            └─────┬──────┘ │
└─────────────────────────────────────────────────────────────────┼────────┘
                                                            MongoDB :27017
```

Express keeps the SPA, the Gemini proxy and the voice socket. FastAPI owns data
and only data. One origin means no CORS and one certificate; splitting them
later is an env var (`VITE_API_BASE`) and an allowlist, because auth is bearer
tokens rather than cookies.

---

## 2. What lives where — the rule that matters most

| | Where | Why |
|---|---|---|
| Skill code — activities, `manifest.json`, `lessons.json` | **Bundle** | A first run must reach a playable lesson with no network and no account |
| Curriculum order (`course.json`) | **Bundle** | Same reason: the path a child walks cannot wait on a request |
| Bundled art (`src/assets/svg`) | **Bundle** | Instant, offline, versioned with the code that uses it |
| Skill *state* — enabled, features, settings, listing | **Database** | A parent's choice, and it should follow them to another device |
| Lesson *wording* overrides | **Database** | Edited by a person, so it syncs; the lesson itself does not |
| Scoring rates | **Database** | One family, one set of rates |
| Progress, levels | **Database** | The record that must survive a lost tablet |
| Learning events | **Database** | Append-only; the evidence everything else is derived from |
| Preferences — sound, voice, theme | **Database** | Set once by a parent, applied on the tablet the child uses |
| Navigation | **`menu_items` collection + bundled default** | A menu has to draw before any request returns |

Navigation is drawn twice, from one record. From `rail:` (720px) up it is the
sidebar, listing every destination the account may reach. Below it, a toolbar
and a bottom tab bar carrying four — Home, Learn, Children, Settings — because a
rail narrowed to a hamburger puts a tap in front of every screen on the device a
child actually holds. What the four leave out, Profile included, is listed
inside Settings by `NavShortcuts`: a place an adult goes deliberately rather
than one a thumb lands on. Both shells are always mounted and each hides itself
at the width that is not its own, so the choice is CSS rather than a
measurement. `navRecord.ts` owns the record, the permission filter, the counts
and the four names, which is what stops a phone and a tablet offering different
destinations.
| Custom art | **Database** (`docs`, `kind: "art"`, cached in IndexedDB) | So a deployed app can add art without a release |
| Gemini API key, viewer age/dev toggles | **Device only** | A secret, and a description of the device rather than the child |

The pattern, stated once: **what a developer ships is bundled; what a person
changes is a document.** When both exist for the same thing — art, nav — the
bundle is the default and the document is the override, so a fresh install works
before it has ever reached the server.

---

## 3. Frontend

```
src/
├── App.tsx                  the shell: gate, tabs, modals
├── components/
│   ├── account/             sign-in, roles & access
│   ├── layout/              MainLayout — rail beside the page, or bar above it
│   ├── navRecord.ts         the menu record both shells read
│   ├── SidebarNav.tsx       the rail, from `rail:` (720px) up
│   ├── AppNav.tsx           toolbar + tab bar, below `rail:`
│   ├── NavShortcuts.tsx     the rest of the menu, inside Settings
│   ├── AccountMenu.tsx      one account menu, two triggers
│   ├── ui/                  the kit — UISidebar, UIAppShell, UISkillThumbnail…
│   └── …                    pages
├── skills/                  one folder per skill: manifest, lessons, activities
│   ├── kit/                 the shared round: chrome, loop, scoring
│   └── catalog.ts           the registry
├── curriculum/              the order lessons are met in
├── lib/
│   ├── skillStore.ts        installed skills + their settings
│   ├── lessonContent.ts     wording overrides
│   ├── scoring.ts           XP and star rates
│   ├── streak.ts            what a day of practice has to be
│   ├── dailyGoal.ts         rounds a day, per learner
│   ├── badges.ts            what a badge is, and who has earned one
│   ├── learnerProgress.ts   XP, level, stars
│   ├── learning/            the event schema, log and rollup
│   └── sync/                ← the only code that knows a server exists
└── assets/svg/              bundled art
```

### The layering rule

```
components  →  lib stores  →  localStorage
                    ↓
                 lib/sync   →  /v1
```

A component never calls `/v1`. A store never fetches. `lib/sync` is the single
seam: it watches what the stores save, queues it, and writes what it pulls back
into the same keys the stores already read. That is what keeps sync out of every
feature — and what makes "signed out" and "offline" behave identically to the
app as it was before there was a backend.

### `lib/sync` in one paragraph each

| File | Job |
|---|---|
| `api.ts` | Base URL, auth header, and the error taxonomy: **offline** ≠ **server fault** ≠ **rejected**. Only *rejected* may sign a device out |
| `session.ts` | Tokens, sign in/out, refresh before expiry, verify on boot |
| `permissions.ts` | The server's own permission table, cached — for *drawing* menus, never for enforcing |
| `outbox.ts` | The queue: events append, document edits coalesce by `(kind, key)` |
| `engine.ts` | When to flush, backoff, conflicts, the pull |
| `apply.ts` | Writes a pulled document into the store that owns it, and remembers revisions |
| `kinds.ts` | **The table.** kind → storage key, scope, notify. Adding a synced setting is one row — and `art` is the row that proves it, routing to IndexedDB instead of `localStorage` while nothing else changes |
| `artStore.ts` | A family's SVGs in IndexedDB: markup is thousands of bytes where a setting is hundreds |
| `install.ts` | Points the learning log at the outbox and backfills a device's history once |

### Two rules learned the hard way

- **A save that changes nothing is not an edit.** The app re-saves its stores on
  boot; without a body comparison every launch bumped a revision and a stale
  device could overwrite a newer change.
- **A conflict is not a retry.** The server's copy is the answer: apply it,
  drop the losing edit.

---

## 4. Backend

```
server/app/
├── main.py        app factory, lifespan, routers under /v1
├── settings.py    every environment variable, read once
├── db.py          the Motor client
├── indexes.py     every index in one list — the migration story
├── menu_defaults.py  the sidebar a fresh database starts with
├── deps.py        the database handle; security moved out of here
├── errors.py      AppError → one JSON shape
├── cli.py         migrate · create-admin · set-password · reset-menu
├── security/      ← everything that decides whether a request may happen
│   scheme · permissions · policy · tenancy · tokens · passwords · rate_limit
├── models/        the wire, and nothing about storage
├── repos/         data access, one module per collection
├── services/      rules that span collections
├── routers/       thin: validate, call a service, return a model
└── middleware/    request id · logging
```

### The layering rule

```
routers  →  services  →  repos  →  Motor
```

A router never touches the driver; a repo never imports a router. The reason is
not tidiness: **`security/tenancy.scoped()` is where tenancy is enforced**, so every
query passes through one function that adds `familyId` from the token. Hold
that, and a wrong permission cell still leaks nothing across families.
`scoped()` *raises* for a principal with no family — staff — rather than
returning an unscoped filter, because that is precisely how "an admin reads one
family" becomes "an admin reads all of them".

### Collections

| Collection | Holds |
|---|---|
| `users` | Adults — parents and staff alike. Argon2id, `platformRole`, TOTP secret |
| `families`, `memberships` | A family, and who belongs to it with which role |
| `devices` | One row per install; refresh-token hash, revocable |
| `events` | Append-only learning events. Unique `(familyId, eventId)`, 400-day TTL |
| `concept_totals` | Rollups, `$inc`-ed only for events that were genuinely new |
| `docs` | **Every mutable document**: skill, lessonContent, scoring, streak, badges, progress, levels, goals, preferences, nav, art |
| `menu_items` | The sidebar: shipped defaults (`familyId: null`) plus a family's overrides |
| `rate_limits` | Attempt budgets, TTL-expired |
| `counters` | One monotonic integer per family: the sync cursor |
| `learners`, `grants`, `audit_log` | Reserved for the family and staff work still to come |

---

## 5. The sync contract

Two kinds of data with genuinely different merge rules — the split is the design.

**Events** are immutable and cannot conflict: the merge of two devices' events is
their union. `(familyId, eventId)` unique is the whole idempotency story, and the
rollup only counts what was actually inserted.

**Documents** are edited by people: each carries the revision it was edited
against, and a stale edit loses to the server's copy. One exception —
`progress` merges monotonic counters by `max`, because two devices playing the
same child must never subtract XP from each other.

```
POST /v1/sync/push      { events[], mutations[] }  → { accepted, duplicates, conflicts[], cursor }
GET  /v1/sync/changes   ?since=<cursor>            → { cursor, docs[], hasMore }
GET  /v1/sync/profile/{learnerId}                  → concept totals
```

Pull returns **documents only**. A device that has no events needs the rollup,
not forty thousand taps.

**The rollups fold events exactly the way the client does, and that is a
contract**: first attempts only, a correct answer after a hint is not first-try,
errors count on every attempt. Drift there means the app and a parent view
quietly disagree about the same child.

---

## 6. Security

Four layers, one package — `docs/SECURITY.md` is the full account:

1. **authentication** — every router lists `AUTHENTICATED` once; four public
   routes, each with a written reason, and a test sweeping the OpenAPI schema
   that fails if a fifth appears.
2. **authorization** — one permission table, per-person exceptions, carried on
   the token.
3. **tenancy** — `familyId` from the token, never from a request.
4. **rate limiting** — budgets per IP and per account, in Mongo with a TTL.

---

## 7. Roles, drawn and enforced

Two axes: **family membership** (owner · parent · caregiver · learner) and
**platform role** (none · support · admin). Staff are not members of anyone's
family. The full matrix and the reasoning are `docs/BACKEND.md` §5.

The frontend never restates it. `GET /v1/family/permissions` serves the table
`rbac.py` actually checks against; the nav hides an entry whose `requires`
permission is not held, and the Roles page renders the same table. A cached copy
can only ever *show* a menu item that then says no — it can never grant one.

```json
{ "id": "skills", "label": "Skills", "icon": "brain", "requires": "settings:write" }
```

---

## 8. Where this is now

| Built | Next | Deferred |
|---|---|---|
| Auth, roles & rights, devices | The `learnerId` decision, and everything behind it | Family: invite a second parent, caregivers, ownership transfer |
| Events up + rollups + backfill | | Learners, join codes, a kid signing in on their own tablet |
| Documents both ways: 8 kinds | | Staff console, grants, audit log |
| Roles & access page · Menu page | | Parent PIN |
| Menu from `menu_items`, editable | | |
| Family art in Mongo, IndexedDB cache | | |
| Settings on the `preferences` kind | | |

The one decision blocking the deferred column: **what `learnerId` means.** Today
it is a random per-device id with 441 events and progress filed under it.
Claiming it as the real learner's id is a one-line migration; minting a new one
means remapping three collections.
