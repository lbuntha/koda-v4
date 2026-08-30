# Backend design — FastAPI + MongoDB

Koda works today with no server: lessons are bundled JSON, progress is
`localStorage`, and the PWA precaches the app so a cold start with no network
still reaches a playable round. **That does not change.** The backend is a
second copy of the record, not the place the app reads from.

Everything below is designed around one rule:

> The device is the source of truth while a child is playing. The server is
> where that truth is kept safe, merged with the child's other devices, and
> shown to a parent.

---

## 1. What the backend is for

Three jobs, in order of value:

1. **A record that survives the device** — clear the browser, lose the tablet,
   reinstall the app: XP, mastery and the learning log come back.
2. **A parent view** — one place to see what a child has practised, across
   whatever they played on.
3. **A child on their own device** — a kid signs in on their tablet with a code
   the parent gives them and their record follows.

Non-goals for now, stated so they do not creep in: realtime multiplayer, an
analytics warehouse, per-field conflict resolution, third-party plugin hosting,
serving lessons from the server (they stay bundled — that is what makes the app
work offline on first run).

---

## 2. What already exists to build on

The client was written with this seam in mind, so most of the work is wiring,
not rewriting.

| Seam | Where | What it gives us |
|---|---|---|
| `setLearningSink(fn)` | `src/lib/learning/learningLog.ts` | One function call turns the local event ring into an upload; nothing above it changes |
| `LearningEventBatch` + `LEARNING_SCHEMA_VERSION` | `src/lib/learning/events.ts` | A versioned wire format already exists — the server can accept batches from older builds |
| `learnerId` | `learningLog.ts` | A stable per-device id, ready to be re-pointed at a real learner |
| Versioned storage keys | `pluginStore`, `lessonContent`, `scoring`, `learnerProgress` | Each is one JSON blob under one key — a natural document boundary |
| `useOnlineStatus()` | `src/pwa/useServiceWorker.ts` | Online/offline signal for the flush loop and status UI |

Local state that becomes syncable documents:

| Doc kind | Key | Written by | Scope |
|---|---|---|---|
| `progress` | learnerId | `learnerProgress.ts` | learner |
| `levels` | learnerId | `learnerProgress.ts` | learner |
| `goals` | learnerId | `dailyGoal.ts` | learner |
| `profile` | learnerId | `learningLog.ts` (also derived server-side) | learner |
| `plugin` | pluginId | `pluginStore.ts` | family |
| `lessonContent` | `pluginId/lessonId` | `lessonContent.ts` | family |
| `scoring` | `default` | `scoring.ts` | family |
| `badges` | `default` | `badges.ts` | family |
| `streak` | `default` | `streak.ts` | family |

`viewer.ts` (age/beta/developer toggles) and the Gemini API key stay device-local
and are never uploaded — they describe the device, not the child.

---

## 3. Shape: two processes, one origin

FastAPI owns data. `server.ts` keeps everything it already does — serving the
SPA, the Gemini REST proxy, and the `/api/live` WebSocket. Shared SVG management
now lives in FastAPI and MongoDB with the rest of the durable product data.

```
browser ──► Express :3001 ──┬── /            SPA (Vite dev middleware / dist)
                            ├── /api/*       Gemini proxy
                            └── /v1/*  ────► FastAPI :8000 ──► MongoDB :27017
```

One origin means no CORS in dev and no second hostname to configure in the
service worker. The client calls `import.meta.env.VITE_API_BASE ?? "/v1"`, so a
separate deployment is an env var, not a code change.

```ts
// server.ts — dev and prod alike
import { createProxyMiddleware } from "http-proxy-middleware";
app.use("/v1", createProxyMiddleware({ target: process.env.API_URL ?? "http://127.0.0.1:8000", changeOrigin: true }));
```

Add `/v1` to the service worker's `navigateFallbackDenylist` alongside `/api/`
— a cached sync response would be worse than an offline one.

### Deployment topology

Two processes, always. One *origin* is the design decision; how many machines is
a deployment choice the client never sees, because the base URL is one env var.

| Topology | Shape | Trade |
|---|---|---|
| **One box** — start here | `docker compose`: Express published, FastAPI and Mongo on the internal network only | One origin, one certificate, no CORS. Cheapest to run and to reason about |
| One box, proxy in front | Caddy or nginx serves `dist/` statically, routes `/api` → Node, `/v1` → FastAPI | Still one origin; Node stops serving files. Worth it when traffic justifies it |
| Split | SPA on a CDN, API on its own host, Mongo Atlas | `VITE_API_BASE=https://api…`, a CORS allowlist, two certificates. Scales independently |

Splitting stays cheap because auth is **bearer tokens, not cookies**: no
`SameSite` rules, no credentialed CORS, just an `Authorization` header and an
origin allowlist. The service worker is unaffected either way — `/v1` is on the
denylist by design, so a sync response is never cached.

What does not move: the Gemini proxy and `/api/live` stay with Express wherever
it runs. FastAPI owns data, and only data.

Production checklist, short version: TLS terminated in front, Mongo reachable
only from the API (compose network, or Atlas with SCRAM and an IP allowlist),
`JWT_SECRET` and `GEMINI_API_KEY` from the host's secret store rather than a
`.env` file, `docker compose --profile api up -d` with restart policies, and a
daily `mongodump` to object storage — a backup is what makes "a record that
survives the device" true.

---

## 4. Identity: families, parents, learners, devices

Per your decision: parents sign up, create a child account, and share a code the
child uses to sign in on their own device. On a device where the parent is
already signed in, the child just taps their own face on a picker.

```
Family ──┬── Parent (email + password)          can see every learner
         ├── Learner "Mia"   ─── JoinCode ───► Device (kid tablet)
         └── Learner "Sam"
```

**Four flows, four endpoints:**

| Flow | Call | Result |
|---|---|---|
| Parent signs up | `POST /v1/auth/signup {email, password}` | Family + parent created, tokens returned |
| Parent signs in | `POST /v1/auth/login` | Family-scoped tokens on this device |
| Parent adds a child | `POST /v1/learners {displayName, birthYear?}` | Learner id; the local `learnerId` is claimed into it on first sync |
| Child signs in elsewhere | parent: `POST /v1/learners/{id}/join-code` → child: `POST /v1/auth/join {code, deviceName}` | Learner-scoped tokens on the kid's device |
| Staff sign in | `POST /v1/auth/login` | A family-less token whose `role` is the platform role; family routes refuse it |

**Tokens.** Access token: JWT, 15 minutes, carries `familyId`, `scope`
(`family` or `learner`), and `learnerId` when learner-scoped. Refresh token:
opaque random string, 60 days, rotated on use, stored hashed server-side so it
can be revoked ("sign out that tablet"). Both live in `localStorage` — the app
must work after a week in a drawer with no network, which rules out
session-cookie-only auth.

**Your own profile.** `GET /v1/auth/me` answers with the account behind the
token — including `joinedAt`, which the profile page prints as "Joined August
2026". `PATCH /v1/auth/me {displayName?, avatarSeed?}` edits it, and
`PATCH /v1/auth/me/avatar` edits only the face. None of the three takes a
permission: the token decides which row is reached, so the only account any of
them can touch is the caller's own — a child's write lands on their learner row,
an adult's on their user row.

**Profile figures are stored, not derived.** `GET /v1/profile/stats` returns one
row per subject — a child's is keyed by their learner id, everyone else's by
their user id — holding every number the profile prints: `dayStreak`, `totalXp`,
`level`, `starsEarned`, `lessonsMastered`, `lessonsAvailable`, `dailyGoal`,
`dailySolved`, `topThreeFinishes`, `league`, `badges`, `childrenCount`,
`codesWaiting`, `permissionsCount`. A first read seeds the row from
`repos/profile_stats.PLACEHOLDERS` and marks it `source: "placeholder"`, which
the page badges as sample data. `PATCH /v1/profile/stats` writes any subset and
flips it to `"recorded"`; unknown keys are dropped rather than stored. The
figures are deliberately not counted at render time — a derived number has no
history, no owner and no way to be corrected, and two screens deriving it are
free to disagree. Filling these from real play is a separate job; this route is
the seam it will use.

**Join codes.** 8 characters, unambiguous alphabet (no `O`/`0`/`I`/`1`), hashed
at rest, single use, 15-minute TTL via a Mongo TTL index, rate-limited to 5
attempts per minute per IP. A short-lived single-use code is a weak secret used
once, which is the only way it is safe.

**Offline is not signed out.** Expired access token, dead network, revoked
device — none of these may block a round. Play is local; sync fails soft and
retries. The only visible effect is the sync indicator, and after a revoke, a
quiet "sign in again to save your work" note that keeps the outbox intact.

---

## 5. Users, roles and rights

Four adults' worth of situations show up immediately — a second parent, a
grandparent who only watches, a tutor, and you, running the service — so
authorisation is a model, not an `if is_parent` scattered through the routers.

### Two separate axes

A person's rights come from **membership in a family**. Running the platform is
a **different axis entirely**: staff are not members of anyone's family, and no
amount of platform role silently makes someone a parent.

```
User ──< Membership >── Family        family axis:   owner · parent · caregiver
  │                                   (a user can be in more than one family —
  │                                    blended families, a tutor with clients)
  └── platformRole                    platform axis: none · support · admin
Device ── learner-scoped token        the child: no password, one learner
```

### The roles

| Role | Who | In one line |
|---|---|---|
| `owner` | the parent who signed up | Everything in the family, plus deleting it and handing it over |
| `parent` | a second guardian, invited | Everything except destroying or transferring the family |
| `caregiver` | grandparent, tutor, co-parent who should only watch | Read the children and their records; change nothing |
| `child` | a kid, via a device token from a join code | Play, and write their own record. Reads family settings, changes none |
| `student` | an older learner with their own sign-in | Their own record *and* their own settings — but nobody under them |
| `support` | staff, first line | Account shape only — never a child's learning record without a grant |
| `developer` | staff, builds the product | Skills, art, menu, scoring. No family, no child's record |
| `admin` | staff, accountable | Account lifecycle, devices, deletion requests, and the content a developer manages |

`learner` was the first name for `child`; it still resolves, because a rename
must not sign anybody out.

`superadmin` is not a fourth staff tier — it is `admin` plus one permission,
`staff:manage`, held by whoever bootstraps the system. One extra tier is easier
to reason about than a hierarchy nobody remembers.

### The rights

Permissions are verb-on-resource strings, and a role is exactly a set of them.
No role is checked by name anywhere except in this table.

| Permission | owner | parent | caregiver | learner | support | admin |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `family:read` | ✓ | ✓ | ✓ | own | ✓ | ✓ |
| `family:update` | ✓ | ✓ | | | | |
| `family:delete` · `family:transfer` | ✓ | | | | | ✓ audited |
| `member:invite` | ✓ | ✓ | | | | |
| `member:list` | ✓ | ✓ | ✓ | | ✓ | ✓ |
| `member:role` · `member:remove` | ✓ | | | | | ✓ audited |
| `learner:create` · `learner:update` | ✓ | ✓ | | | | |
| `learner:delete` | ✓ | ✓ | | | | ✓ audited |
| `learner_data:read` | ✓ | ✓ | ✓ | own | grant | grant |
| `learner_data:write` | | | | own | | |
| `settings:read` | ✓ | ✓ | ✓ | ✓ | | |
| `settings:write` | ✓ | ✓ | | | | |
| `content:write` | | | | | ✓ | ✓ |
| `scoring:write` | ✓ | | | | | ✓ |
| `system:write` | | | | | | ✓ |
| `device:list` | ✓ | ✓ | ✓ | own | ✓ | ✓ |
| `device:revoke` | ✓ | ✓ | | own | | ✓ audited |
| `platform:*` | | | | | read | ✓ |

Three rows carry the product decisions worth noticing. **A learner cannot write
family settings** — plugin toggles and lesson wording are a parent's, which
means the Plugins and Art pages become parent-only on a kid's device (see *App
consequences* below). **`learner_data:read` is not something staff simply
have**: it takes a grant.

And **the shared art library is split out of `settings:write`** as
`content:write`, which no family role holds and no grant can hand out. The
collection is the deployment's, not a family's: one parent editing it would
change what every other family draws from. This is the permission the Art
nav entry names, so what the nav offers is what the API allows — before
the split the entry said `settings:write` while the routes additionally demanded
an operator, and a parent was shown an Art page they could never save from.

And **scoring and the API key are split out of `settings:write`**, because they
are not the same risk as the rest of it. Editing a skill's wording is content;
re-pricing XP changes what every star a child has already earned was worth,
retroactively and for the whole family, and the API key spends somebody's money.
Both are the owner's by default. A family that wants a second parent tuning
either grants it on the Roles page — the split is a default, not a wall.

**Menu visibility is owned by the code.** `menu_defaults.py` declares each
entry's `requires`/`roles`, and seeding is create-if-absent — which is right for
a label an operator has improved and wrong for the rule that decides who sees a
page. So startup re-applies the shipped `requires`/`roles` to every default row,
skipping any an operator has deliberately taken over through the Menu screen
(those carry `visibilityPinned`; `DELETE /v1/menu/{id}` hands the decision back).
Without this, a gate tightened in code reaches new deployments and silently
misses every existing one.

### Enforcement: two layers, and the second is the real one

```python
@router.post("/learners", dependencies=[Depends(require("learner:create"))])
async def create_learner(body: NewLearner, p: Principal = Depends(principal)):
    await db.learners.insert_one({**body.model_dump(), "familyId": p.family_id})
```

1. **The permission check** answers "may this principal do this kind of thing?"
2. **The tenancy filter** answers "to whose data?" — `familyId` comes from the
   token, *never* from the request body or a path parameter. Every query is
   built through a `scoped(principal)` helper that adds it.

Layer two is what actually keeps two families apart, and it holds even if a
permission table is wrong. A route that builds a raw query is the bug to look
for in review.

The access token carries `{sub, typ: "user"|"device", familyId, role,
learnerId?, platformRole?}`. The client reads these to decide what to *show*;
the server re-derives them to decide what to *allow*. Client-side gating is UX,
never security.

### Staff access to a child's record: the grant

An admin who can silently read any child's learning history is a liability. So
they cannot.

```
POST /v1/admin/grants { familyId, reason, hours ≤ 24 }
   → parent is notified in-app and by email, immediately
   → the grant is a row with an expiry, not a flag on a user
   → every read under it is written to the audit log with the grant id
   → the family can revoke it; it dies on its own within a day regardless
```

Account-shape work — "I can't sign in", "delete my child's account" — needs no
grant, because it touches `users`, `memberships`, `devices` and `learners`, not
events. Anything that touches a child's record does.

### Audit log

One append-only collection, no update or delete endpoint, 2-year TTL:

```python
{ ts, actor: {type: "user"|"device"|"system", id, platformRole},
  action: "learner:delete", target: {kind: "learner", id}, familyId,
  grantId: None, ip, userAgent, meta: {…} }
```

Everything on the platform axis is logged, plus family-side destructive acts
(delete, transfer, role change, device revoke). Ordinary play is not — it is
already the event stream.

### Staff accounts are provisioned, never signed up

- No public admin signup, ever. First admin comes from a CLI seed
  (`python -m app.cli create-admin --email …`) gated on an env secret; after
  that, `staff:manage` invites the rest.
- **Staff sign in through the same route as everyone else** and get a token with
  **no `familyId`**, because they are in no family. Their `role` *is* their
  platform role. Family-scoped routes then refuse them at the query layer —
  `repos/base.scoped()` raises rather than quietly returning an unscoped filter,
  which is precisely how "an admin reads one family" would otherwise become "an
  admin reads all of them by accident".
- TOTP is **mandatory** for `support` and `admin`, optional for parents.
- Admin tokens carry `aud: "admin"` and are rejected by `/v1/sync/*`; the kid app
  cannot hold one even if someone pastes it in.
- The admin console is a **separate surface** — its own route bundle, not part of
  the child PWA and not precached by the service worker.

### App consequences

| Surface | Who sees it |
|---|---|
| Learn, Dashboard, a round | Everyone, including a signed-out device |
| Plugins, lesson wording | `settings:write` — parents only |
| Art — the shared SVG library | `content:write` — a platform operator, never a family |
| Menu | `menu:manage` — a platform operator |
| System switchboard, incl. the Gemini key | `system:write` — a platform operator, never a family |
| Scoring & XP, incl. the streak rule | `scoring:write` — the owner, or a parent granted it |
| A learner's daily goal | `learner:update` — a parent for their children, a student for themselves; never a child for their own |
| Badges — what one is and what it takes | `scoring:write`, with the rest of the reward economy |
| Family, members, devices, join codes | Parents; role changes owner-only |
| A child's record | Parents and caregivers; the child sees their own |

On a shared tablet where the parent is signed in, parent areas sit behind a
**4–6 digit parent PIN** rather than a full sign-out and sign-in — the realistic
gesture when a child hands you the tablet. The PIN gates the UI; the token still
carries the rights, and the server still checks them.

Offline, the cached token's claims decide what is shown. A learner device that
has never been online has learner rights, which is exactly what it has today.

### 5a. System settings: the operator's ceiling

Everything else in this service is scoped to one family. System settings are
not: they are the deployment's own answers, they apply to every family on it,
and they are a **ceiling** — a family may switch a feature off for themselves,
but nothing they do switches on what the operator has switched off.

| Route | Who | Answers |
|---|---|---|
| `GET /v1/system` | anyone signed in | `{settingId: value}` — the effective values, so a client knows what to draw |
| `GET /v1/system/settings` | `system:write` | the rows: label, group, description, when each changed |
| `PATCH /v1/system/settings/{id}` | `system:write` | one value |

`system:write` is a **platform** right. No family role holds it, and
`effective_permissions()` strips it the way it strips `learner_data:write`, so
no per-person grant can hand it to an owner either. An owner runs their family;
an operator runs the service.

What ships in the switchboard (`server/app/system_defaults.py` — a setting needs
code behind it, the same rule the menu follows):

| Group | Settings |
|---|---|
| Ask Koda | `ai.enabled` — the master — over `ai.chat`, `ai.speech`, `ai.liveVoice`, `ai.whiteboard`, each a paid call and switched separately, plus `ai.geminiApiKey` |
| Artwork | `ai.artGeneration`, `ai.artProvider`, `ai.openaiApiKey`, `ai.anthropicApiKey` — the Art page drawing an SVG, which is not the assistant |
| Accounts & sync | `account.signupOpen`, `sync.enabled`, `system.readOnly` (maintenance), `system.notice` (a message to every device) |

**Koda's characters.** Who Koda *is* is four layers, and each owns one thing —
the split is what stops "make Ms Vega less chatty" from meaning an edit in three
routes:

| Layer | Owns | Lives in |
|---|---|---|
| Frame | the rules every teacher obeys | `tutor/persona.ts`, `FRAME` |
| Character | name, manner, voice, ages, emoji | `personas` collection, seeded from `persona_defaults.py` |
| Choice | which character this child gets | `childSettings.personaId` |
| Resolution | choice + character → prompt and voice | `tutor/persona.ts`, and only there |

Two rules hold it together. **A client sends an id, never prose** — the browser
has no idea what a prompt looks like, so nobody can type a teaching manner into
a request and have the model obey it; `resolveCharacter()` turns the id into a
character server-side from the roster. **The frame is code, the character is
data** — an operator rewords how a teacher speaks, but cannot loosen the rule
against giving answers away, change the age register, or make Koda stop being a
maths teacher. `GET /v1/personas` is the family's view (enabled only);
`/v1/personas/all` and every write are behind `system:write`.

**The Ask Koda master.** `ai.enabled` is the one switch that answers "does this
deployment have an AI coach at all", and `GET /v1/system` applies it —
`with_master_applied()` reports every capability in `KODA_CAPABILITIES` as
`false` while it is off. Composed there, once, because that response is the only
thing every device *and* the tutor proxy read: a capability cannot read `true`
anywhere while Koda is off, not even from a stale client cache. The stored rows
are untouched, so switching Koda back on restores exactly what was on before.

**The `secret` type.** `ai.geminiApiKey` is a row in this same collection, which
is only safe because of one rule: a `secret`'s value is never in a response a
browser can ask for. `GET /v1/system` omits secrets outright — not even as
`null` — and `GET /v1/system/settings` sends `value: null` with `isSet` and a
four-character `hint`. The value leaves exactly once:

`POST /v1/system/settings/ai.geminiApiKey/resolve` takes **two** credentials —
the caller's own token, because every route here needs one, and
`X-Service-Token`, which says "this is the tutor server". `system:write` is
deliberately *not* checked: any signed-in learner causes this to be called
merely by talking to Koda, so the caller's rights cannot be the bar. With
`TUTOR_SERVICE_TOKEN` unset the route is off entirely, and the tutor server
falls back to its own `GEMINI_API_KEY`.

The browser therefore never holds the key. It sends the access token it already
has to `/api/tutor/*`; the Node server resolves the key and calls Gemini. Before
this it sat in `localStorage` and rode in the body of every tutor request.

It is stored **as written, not encrypted at rest** — the database is the trust
boundary today. Envelope encryption or a secret manager is the fix when that
stops being enough.

**Where the ceiling bites.** Hiding a control is a hint; these are the rules:

- `account.signupOpen` — checked in `/auth/signup`, before the email is looked
  up, so a closed deployment does not confirm which addresses have accounts.
- `sync.enabled` and `system.readOnly` — checked in `/sync/push`. Refusing is
  safe here in a way it is not elsewhere: the client keeps its queue on a
  refusal, so a maintenance window costs a delay and never a round.
- The four AI switches — checked by the tutor server on `/api/tutor/*` and on
  the live socket, because that is what spends the money.

Values are seeded create-if-absent at startup, so a switch an operator has
thrown survives the next deploy.

---

## 6. Data model

Two kinds of data with genuinely different rules, plus rollups the server owns.

### Append-only: learning events

Immutable facts with client-generated ids. They never conflict — the merge of
two devices' events is their union — which is why they carry the record and the
counters are derived from them.

```python
# events collection
{ "_id": ObjectId, "familyId": ..., "learnerId": ..., "eventId": "e_...",  # client id
  "serverSeq": 41207, "receivedAt": ISODate, "schemaVersion": 1, "appVersion": "1.0.0",
  "deviceId": ..., "sessionId": ..., "seq": 17, "ts": ISODate,
  "type": "answer_submitted", "pluginId": "counting", "activityId": ..., "lessonId": ...,
  "conceptKey": "corresponder", "levelNumber": 3, "standards": ["CCSS.K.CC.B.4a"],
  "payload": { ... }  # the rest of the event, as sent
}
```

Index `{familyId: 1, eventId: 1}` **unique** — that one index is the whole
idempotency story: a retried batch inserts nothing twice.

### Mutable: documents

Everything a person edits — plugin toggles, lesson wording, scoring rates,
progress — is one small JSON blob. One collection handles all of them, so a new
kind of setting needs no backend change.

```python
# docs collection
{ "familyId": ..., "learnerId": ... | None, "kind": "plugin", "key": "counting",
  "body": { ... }, "rev": 7, "serverSeq": 41208,
  "updatedAt": ISODate, "updatedBy": deviceId, "deletedAt": None }
```

Index `{familyId: 1, kind: 1, key: 1}` unique, `{familyId: 1, serverSeq: 1}` for pulls.

### Derived: rollups

`concept_totals`, one document per `(learnerId, conceptKey)`, `$inc`-ed as
events land — the same shape `LearningProfile` already
has locally. Because they are only touched when an event insert was *new*, they
inherit the events' idempotency.

**They fold events exactly the way the client does, and that is a contract.**
`questionsAnswered` counts first attempts only — a retry of a question whose
answer the child has just seen measures memory, not understanding — and a
correct answer after a hint is not `correctFirstTry`. Errors count on every
attempt, because the pattern is what a recommendation reads. The rule lives in
`applyToProfile` (client) and `services/rollup.py` (server); if they drift, the
app and the parent view will quietly disagree about the same child. Building P1
found exactly that drift, and `test_sync_events.py` now pins it. They are also written back as a `profile` doc
so other devices and the parent view pull them like anything else.

### Supporting collections

| Collection | Purpose | Notes |
|---|---|---|
| `families` | one per parent signup | |
| `users` | adults — parents and staff alike | `email` unique, Argon2id hash, `platformRole`, TOTP secret |
| `learners` | children | `displayName` only — no email, no full birthdate |
| `devices` | one per install | refresh-token hash, `lastSeenAt`, `appVersion` |
| `join_codes` | code hash + learnerId | TTL index on `expiresAt` |
| `ops` | applied mutation ids | TTL 7 days; makes retries idempotent |
| `counters` | `{_id: familyId, seq: n}` | `$inc` gives the sync cursor |
| `memberships` | user ↔ family with a role | unique `(userId, familyId)` |
| `invitations` | invite a second parent or caregiver | token hash, role, TTL index |
| `grants` | time-boxed staff access to one family | TTL on `expiresAt`, referenced by audit rows |
| `audit_log` | who did what, when, why | append-only, 2-year TTL, indexed by `familyId` and by actor |
| `system_settings` | the deployment's switchboard, including the Gemini key | **global** — no `familyId` at all; see §5a |
| `skill_registry` | registration, publication and every Skills-page configuration field | **global**; seeded from manifests, managed by operators, cached offline by clients |

**Retention.** Raw events get a 400-day TTL; rollups are permanent. That keeps
"a year of practice still counts" true without an unbounded collection, and it
matches the local design where the ring is capped but the profile is not.

---

## 7. The sync protocol

A per-family monotonic integer (`counters`) is the cursor. Not a timestamp —
device clocks are wrong, and children's tablets are the worst offenders.

### Push

```http
POST /v1/sync/push
{ "deviceId": "...", "cursor": 41190,
  "events": [ { ...LearningEvent } ],                       // append-only
  "mutations": [ { "opId": "op_...", "kind": "plugin", "key": "counting",
                   "learnerId": null, "body": {...}, "baseRev": 6, "deleted": false } ] }

200 { "cursor": 41208,
      "accepted": ["e_a1", "e_a2", "op_x"],
      "conflicts": [ { "kind": "lessonContent", "key": "counting/l3", "doc": {...}, "rev": 9 } ] }
```

- Events: `insert_many(ordered=False)`, duplicates ignored by the unique index.
- Mutations: `findOneAndUpdate` guarded on `rev == baseRev`. Match → `rev + 1`,
  new `serverSeq`. No match → the server's copy comes back as a conflict and the
  client overwrites its local value. **Last write wins, server arbitrates.**
- One exception, because losing XP is the one merge people notice: `kind:
  "progress"` merges field-wise, taking `max` of the monotonic counters (`xp`,
  `problemsSolved`, `level`, `streakDays`) and last-write-wins for the rest
  (`dailyGoal`). Three lines, and it prevents the worst two-device regression.
- Limits: 500 events or 200 mutations per batch, 1 MB body. Over that, the
  client splits.

### Pull

```http
GET /v1/sync/changes?since=41190&limit=500
200 { "cursor": 41208, "docs": [ {kind, key, learnerId, body, rev, deletedAt} ], "hasMore": false }
```

Docs only. Events are never sent back down — the device that wrote them has
them, and a device that has none needs the rollup, not 40,000 taps. A fresh
install therefore restores: profile, progress, levels, plugin state, lesson
wording — everything a child would notice.

Deletes are tombstones (`deletedAt` set, body dropped), so a delete propagates
instead of resurrecting on the next push from a stale device.

### When the client syncs

App start · `online` event · 30 s timer while the outbox is non-empty ·
`visibilitychange` to hidden (catches the tablet being closed) · after a round
ends. Single-flight with exponential backoff (2 s → 60 s, full jitter) on 5xx or
network error; 401 triggers one refresh attempt then backs off quietly.

---

## 8. Client architecture

One new folder, no rewrite of the stores. Four files carry the mechanism — the
full tree, including the account screens, is in §10:

```
src/lib/sync/
  api.ts        ✅ fetch wrapper — base URL, auth header, error envelope
  session.ts    ✅ tokens, sign up / in / out, refresh-before-expiry
  useSession.ts ✅ the signed-in state, live
  outbox.ts     the queue: append, coalesce, drain, cap                (P1)
  engine.ts     when to flush, backoff, applying pulled docs, status   (P1)
```

The parts marked ✅ are built, alongside the account UI:

```
src/components/account/
  AccountForm.tsx    ✅ the credentials form — one copy, two homes
  SignInScreen.tsx   ✅ the full page, reached from the account menu
```

The screen is **not a gate**. Koda is playable with no account and no network,
so "keep playing without an account" is a first-class button on it, not fine
print — and the toolbar's account menu is where signing out lives.
Two rules it follows that the rest will too: a failed `fetch` is the *offline*
case and never signs anyone out, while a **rejected** refresh means the device
was revoked and does. Sign-out clears local state first and tells the server
after — a person pressing it on a plane means it.

**The outbox** is a `localStorage` array under `koda_outbox_v1`, capped at 2 000
entries. Mutations coalesce by `(kind, key)` — only the latest body of a doc
matters, so toggling a feature ten times offline is one op. Events do not
coalesce; they are the record. When batches get big enough that JSON-parsing the
whole queue per append hurts (roughly: art in Mongo, or a shared classroom
tablet), move this one file to IndexedDB. Not before — it would be machinery in
place of a working thing.

**Existing stores opt in with one line** in the function that already saves:

```ts
// src/lib/skillStore.ts
function saveStoredPlugins(plugins: LearningPlugin[]) {
  localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(plugins));
  Sync.record("plugin", plugins.map(...));   // ← the only new line
}
```

and the learning log needs none at all — it already has the seam:

```ts
setLearningSink(async (batch) => Sync.recordEvents(batch.events));
```

**Applying a pull** writes the doc into the same `localStorage` key the store
already reads, then calls its existing `notify()` — the UI updates by the path it
already uses.

**Status UI**: extend `PwaStatus` (it already owns the quiet corner and the
online signal) with `synced · N waiting · signed out`. Same tone as the offline
notice: never a blocking banner.

---

## 9. Offline behaviour

| Situation | What happens |
|---|---|
| No network, playing | Everything works. Events and edits queue. Nothing is lost, nothing is shown |
| No network, app restarted | Queue survives in `localStorage`, flushes when back |
| Back online | One batch push, then a pull; UI updates in place |
| Access token expired offline | Ignored — refresh happens on the next successful connection |
| Device revoked by a parent | Local play continues, queue is kept, quiet "sign in again" note |
| Two devices edited the same lesson | Server's copy wins, the loser's UI updates; XP counters merge by max |
| Never signed in, offline | **Blocked at the gate.** First sign-in is the one thing that needs a network |
| Signed in once, then offline forever | Everything works — the session is in `localStorage` and a failed check leaves it alone |
| Skill registry cannot be reached | Bundled activity code still runs; the last complete registry response supplies publication state, or the bundled manifest on first run |
| Operator edits a skill offline | The complete configuration snapshot queues locally, appears immediately, and uploads to Mongo on reconnect |

Signing in is now required to reach the app (`App.tsx`), so the table's last two
rows are the trade that was accepted: a device that has signed in once is
untouched by losing the network, and a device that never has cannot start.

Proven rather than assumed. `src/lib/sync/session.test.ts` covers the rules —
a failed `fetch` and a 503 from the proxy both keep the session, a 401 from
`/auth/me` clears it, and signing out clears this device even when the server
cannot be told. Live: with the API container stopped the app still loads and
stays signed in; with **everything** stopped, a production build boots from the
service worker cache, still signed in.

---

## 10. Project structure

### Where it sits in the repo

The Python service is a folder, not a second repository. One checkout, one
branch, one review — the wire format lives in two languages and they must move
together.

```
koda5/
├── src/                      the React app (unchanged, plus src/lib/sync/)
├── server.ts                 Express: SPA · Gemini · /api/live · /v1 proxy
├── server/                   ← the FastAPI service
├── docker-compose.yml        mongo + api for local work
└── docs/BACKEND.md           this file
```

### The service

```
server/
├── app/
│   ├── main.py               app factory, lifespan (Motor client, index sync), router mounting
│   ├── settings.py           pydantic-settings — MONGODB_URI, JWT_SECRET, TTLs, CORS, ADMIN_SEED
│   ├── db.py                 the Motor client and database handle, nothing else
│   ├── indexes.py            every index in one list, applied on startup and by `cli migrate`
│   ├── rbac.py               PERMISSIONS + ROLE_PERMISSIONS — the §5 table, and the only place roles are named
│   ├── deps.py               principal() · require(*perms) · scoped(principal) · current_family()
│   ├── errors.py             one exception → response mapping; no bare HTTPException in routers
│   ├── cli.py                create-admin · migrate · expire-grants · revoke-device · backfill-rollups
│   │
│   ├── models/               pydantic v2 — the wire, and nothing about storage
│   │   ├── common.py         ObjectId handling, timestamps, the envelope shapes
│   │   ├── auth.py           SignupIn · LoginIn · TokenPair · Principal · JoinIn
│   │   ├── family.py         Family · Membership · Invitation · Learner · Device
│   │   ├── events.py         the LearningEvent union — mirror of src/lib/learning/events.ts
│   │   ├── sync.py           PushIn · PushOut · Mutation · SyncDoc · ChangesOut
│   │   └── admin.py          Grant · AuditEntry · AdminFamilyView
│   │
│   ├── repos/                data access, one module per collection
│   │   ├── base.py           the scoped() query helper — every filter gets familyId from the principal
│   │   ├── users.py · families.py · memberships.py · learners.py · devices.py
│   │   ├── events.py · docs.py · rollups.py · counters.py
│   │   └── grants.py · audit.py · invitations.py
│   │
│   ├── services/             rules that span more than one collection
│   │   ├── tokens.py         issue · rotate · revoke · verify
│   │   ├── codes.py          join codes: mint, redeem, rate-limit
│   │   ├── sync.py           push and pull, conflict resolution, the progress max-merge
│   │   ├── rollup.py         events → concept and skill totals, and the profile doc
│   │   ├── grants.py         open · notify the family · expire
│   │   ├── audit.py          one write() call, used by every mutating admin path
│   │   └── mailer.py         invitations, grant notices, password reset (console backend in dev)
│   │
│   ├── routers/              thin: validate, call a service, return a model
│   │   ├── health.py         /v1/health — liveness and Mongo ping
│   │   ├── auth.py           signup · login · refresh · logout · join · totp
│   │   ├── family.py         family, members, invitations, ownership transfer
│   │   ├── learners.py       CRUD, join codes, profile read
│   │   ├── devices.py        list, rename, revoke
│   │   ├── sync.py           push · changes
│   │   └── admin.py          family lookup, grants, deletion requests, audit read
│   │
│   └── middleware/           request id · structured logging · rate limit
│
├── tests/
│   ├── conftest.py           app fixture, a throwaway database per run, factories
│   ├── test_auth.py          signup, login, refresh rotation, join codes, lockout
│   ├── test_rbac.py          the §5 matrix, asserted cell by cell
│   ├── test_tenancy.py       family A cannot read family B, by any route
│   ├── test_sync_events.py   idempotent replay, out-of-order batches, rollup correctness
│   ├── test_sync_docs.py     rev conflicts, tombstones, the progress merge
│   └── test_grants.py        no read without a grant, expiry, audit rows written
│
├── scripts/seed_dev.py       a family, two learners, a week of plausible events
├── pyproject.toml            deps + ruff + pytest config in one file
├── Dockerfile
└── README.md                 how to run it in four lines
```

### The layering rule

```
routers  →  services  →  repos  →  Motor
   ↑            ↑
  deps       models
```

A router never touches the driver, and a repo never imports a router. The point
is not tidiness: **`repos/base.py` is where tenancy is enforced**, so every query
in the system passes through one function that adds `familyId` from the token.
If that rule holds, a wrong permission cell leaks nothing across families.

### The client half

```
src/lib/sync/
  index.ts       the public surface: Sync.record · Sync.recordEvents · useSyncStatus
  types.ts       the wire types — the TypeScript side of models/sync.py
  session.ts     tokens, signup/login/join, current learner, sign-out
  outbox.ts      queue: append, coalesce by (kind, key), drain, cap
  api.ts         fetch wrapper — base URL, auth header, retry classification
  engine.ts      when to flush, backoff, single-flight, status subscription
  apply.ts       write a pulled doc into the store that owns it
  kinds.ts       kind → { storageKey, notify } — one table, like the plugin registry

src/components/account/
  RolesPage.tsx · MenuPage.tsx · ScoringPage.tsx · ApiKeyPage.tsx
  FamilyPanel.tsx · LearnerPicker.tsx · ParentPinGate.tsx
```

`kinds.ts` is the piece worth insisting on: without it, "apply a pulled document"
becomes a switch statement that every new setting has to remember to update.

### Tooling

| Concern | Choice | Why this one |
|---|---|---|
| Runtime | Python 3.12, FastAPI, uvicorn | Async all the way to the driver |
| Driver | Motor | The async Mongo driver; no ORM — the documents are the model |
| Validation | pydantic v2 | Already the FastAPI idiom, and it is the wire contract |
| Auth | pyjwt · argon2-cffi · pyotp | Access JWT, Argon2id passwords, TOTP for staff |
| Lint/format | ruff | One tool, configured in `pyproject.toml` |
| Tests | pytest · pytest-asyncio · httpx ASGI transport | Real routes, real Mongo, throwaway database per run |
| Migrations | `app/indexes.py` + `cli migrate` | Mongo needs index management, not schema migration |

### Running it locally

The whole stack is Docker, driven by one target:

```bash
make dev-local        # app + API + Mongo, built and running
make logs · logs-api  # follow either service
make test-api         # pytest against the compose Mongo
make lint-api         # ruff
make migrate          # apply every index
make down             # stop, keep the database
make clean            # stop and drop the database volume
```

`make dev-local` renews the anonymous `node_modules` volume, so a dependency
added since the last build is actually picked up rather than shadowed by a stale
one — the failure mode that looks like "the package is installed but not found".

`make dev-local` runs the `dev` stage of the root `Dockerfile`: the working tree
is bind-mounted, so an edit on the host reloads inside the container, while
`node_modules` stays the Linux copy baked into the image rather than the host's.
Mongo keeps its data in the `mongo-data` volume, so `make down` is not
destructive and `make clean` is.

Ports are overridable, which matters on a machine already running things:

| Service | Default | Override |
|---|---|---|
| App | 3001 | `APP_PORT=3002 make dev-local` |
| Mongo | 27017 | `MONGO_PORT=27018 make dev-local` |
| FastAPI | 8000 | `API_PORT=…` |

Those are only the *published* ports. Inside compose, containers reach each
other by service name — `mongo:27017`, `api:8000` — which is why the Node
process is told `API_URL=http://api:8000` and not a localhost address. If
another stack on the machine already holds a number, move the published one and
nothing inside changes.

### What reloads, and what needs a rebuild

Every layer watches its own files, and each watches only its own — a component
edit must not restart the Node process, or Vite's HMR is pointless.

| You edit | What happens | How |
|---|---|---|
| `src/**` — React, styles | The browser updates in place, state kept | Vite HMR through the `.:/app` mount |
| `server.ts`, `svgAssetRoutes.ts` | Node restarts in ~1s | `tsx watch`, with `src/**` ignored so it stays out of Vite's way |
| `server/app/**` — Python | uvicorn restarts in ~1s | `--reload` over the `./server/app:/srv/app` mount |
| `server/tests/**` | Nothing runs by itself | `make test-api` |

And the things a watcher cannot pick up, because they change the *image* rather
than the code inside it:

| You change | Do this |
|---|---|
| `package.json` — a new npm dependency | `make dev-local` (rebuilds, and renews the `node_modules` volume) |
| `server/pyproject.toml` — a new Python dependency | `make dev-local` |
| `Dockerfile`, `docker-compose.yml`, env vars | `make dev-local` |
| `server/app/indexes.py` — a new index | `make migrate`, or restart the API (startup applies them) |

`make dev-local` is idempotent and safe to re-run at any time: it rebuilds what
changed, leaves the database volume alone, and reprints the URLs.

Prefer running Node on the host? `docker compose up -d mongo api` for the
database and the service, then `npm run dev` in a terminal. `server/.env` holds
the service's secrets; the repo's `.env` keeps Node's.

**Model parity is the one thing that will rot.** `events.ts` and
`models/events.py` describe the same wire format in two languages. Keep
`LEARNING_SCHEMA_VERSION` honest, have the server accept unknown fields rather
than 422 on them, and reject only what it must — an older tablet must never be
locked out by a newer server.

### What exists in which phase

| Phase | Files that appear |
|---|---|
| P0 ✅ | `main` · `settings` · `db` · `indexes` · `rbac` · `deps` · `errors` · `models/{common,auth,family}` · `repos/{base,users,families,memberships,devices}` · `services/{passwords,tokens}` · `routers/{health,auth,devices}` · `middleware/requests` · `cli` · `tests/{auth,rbac,tenancy}`. Client `api`/`session` still to come |
| P1 | `models/events` · `repos/{events,rollups,counters}` · `services/{sync,rollup}` · `routers/sync` (push) · client `outbox`/`engine` |
| P2 | `models/{sync,family}` · `repos/{docs,memberships,invitations}` · `services/codes` · `routers/{family,learners,devices}` · changes endpoint · client `apply`/`kinds`/account UI |
| P2.5 | `repos/{grants,audit}` · `services/{grants,audit,mailer}` · `routers/admin` · `cli create-admin` · TOTP |
| P3 | parent view endpoints · `svg_assets` repo and router |

---

## 11. Security and privacy

- Passwords: Argon2id. Never logged, never returned.
- Refresh tokens and join codes: random 32 bytes, stored as SHA-256 hashes,
  rotated on use, revocable per device.
- Rate limits on `/auth/*`: 10/min per IP, 5/min per email or code; lockout with
  exponential delay after 10 failures on one account.
- Authorisation is §5: permissions from a single table, tenancy from the token.
  TOTP is mandatory for staff, admin tokens are rejected by `/v1/sync/*`, and
  staff cannot read a child's record without a time-boxed, audited, parent-visible grant.
- CORS locked to the app origin; behind TLS in production; Mongo reachable only
  from the API (compose network or Atlas IP allowlist with SCRAM).
- **Children's data minimisation stays a design rule, not a promise.** Events
  already carry no names, no free text a child typed, no audio. The server must
  reject unknown top-level fields on events rather than store them, so a future
  careless client cannot start uploading text.
- The Gemini key is a `secret` row in `system_settings`, reaches the tutor
  server and nothing else, and is never returned to a browser — see §5a, which
  also records that it is not encrypted at rest.
- A learner's `displayName` and optional birth *year* are the only child data.
- `DELETE /v1/learners/{id}` cascades events, docs and rollups in one call —
  build it in phase 2, not "later", because it is the thing you cannot retrofit
  under time pressure.

---

## 12. Phases

Each phase is shippable and leaves the app working if the next never happens.

**P0 — skeleton. Built.** `server/` with the layering below, Mongo indexes
applied on startup, the Express `/v1` proxy, and auth end to end: signup, login,
refresh with rotation, logout, `/auth/me`, `/devices`. The `rbac.py` table and
`require()` exist from the first route — retrofitting authorisation is what
makes it leaky — with all four family roles and both staff roles filled in, and
`tests/test_rbac.py` asserting the §5 matrix cell by cell. What is *not* here
yet: the client half (`api.ts`, `session.ts`) and any sign-in UI.
*Done when:* a parent can sign in and the app is otherwise unchanged.

**P1 — events up. Built.** `outbox.ts`, `engine.ts`, `POST /v1/sync/push`,
the rollup service and `GET /v1/sync/profile/{learnerId}`, plus a one-time
**backfill**: a device played on before it had an account hands its whole local
ring to the outbox on first install, because signing in must not restart the
record from zero.
*Done when:* play a round in airplane mode, reconnect, and the server's concept
totals match the local profile exactly. **They do** — 441 events uploaded from a
real device, 16 concepts, zero mismatches.

**P2 — documents both ways, and the family.** *Documents: built.* Mutations,
conflicts, the progress merge, tombstones, `GET /v1/sync/changes`, and the
client half — `kinds.ts`, `apply.ts`, mutations in the outbox, a pull on every
flush. The five stores (`skill`, `lessonContent`, `scoring`, `progress`,
`levels`) each record from the function that already saves them.

*Still to build:* learner records and join codes, memberships (a second parent,
a caregiver, ownership transfer), learner deletion, and the parent PIN.

*Done when:* a kid signs in on a second tablet with a code and their progress,
XP and edited lesson wording are all there — and a caregiver can see it without
being able to change a single setting.

Two things building the document half taught, both now pinned by tests:

- **A save that changes nothing is not an edit.** The app re-saves its stores on
  boot, so without a body comparison every launch bumped the revision — and a
  device that booted with stale state could overwrite a newer change with the
  same old body.
- **A conflict is not something to retry.** The server's copy is the answer, so
  the client applies it and drops its losing edit rather than resending it into a
  loop it cannot win.

**P2.5 — staff.** The audit log, grants, TOTP, `python -m app.cli create-admin`,
and a small admin console on its own surface: find a family, see account shape,
revoke a device, action a deletion request, request a grant.
*Done when:* you can answer a support email without touching Mongo directly, and
every thing you did is in the audit log.

**Art — built.** The deploy-wide SVG collection lives in Mongo's `art_assets`
collection and is managed through authenticated `GET /v1/art`, `PUT`, `PATCH`,
and `DELETE` endpoints. Only developer/admin operators can change it; signed-in
families may read it. The bundled SVG files seed an empty database once and
remain the offline snapshot, while revisions and tombstones ensure later edits
or deletes survive restarts.

A family's own SVGs are `docs` with
`kind: "art"`: same idempotency, revisions, tombstones and cursor as every other
document, so nothing new had to be invented. Two additions it needed — a 64 KB
ceiling per asset, and `GET /sync/changes?kinds=…`, so a device fetching a
toggle does not drag the picture library with it. On the client they land in
IndexedDB rather than `localStorage`, which is exactly the signal named in
`outbox.ts`; `SvgAsset` resolves bundled-first, then the family's, so a fresh
install still works offline and a family asset sharing a bundled id replaces it.

**P3 — the parent view.** A read-only parent screen over the rollups
(practised concepts, accuracy trend, time spent). The generated `SvgAssetId`
union remains a build-time snapshot so bundled lesson code stays type-safe;
Mongo-added ids are accepted as runtime strings.

**Deliberately not now:** websockets/live updates, CRDTs, per-field merge beyond
the progress rule, classroom and teacher roles (a school is a different tenancy
model, not another role), SSO, per-learner scoping of a caregiver, data export
tooling.

---

## 13. Open decisions

1. **Where it runs.** Mongo Atlas free tier + a small container host is the
   cheapest real deployment; `docker compose` locally either way.
2. **Does `learnerId` migrate or restart?** Simplest is: on first claim, the
   existing device `learnerId` becomes the server learner's id, so nothing local
   has to be rewritten. It only breaks if two children shared one device before
   signing up — worth accepting for the prototype.
3. **Do parents get their own device rows?** Yes as written (a parent phone is a
   device with family scope), which is what makes "sign out that tablet" work.
4. **Does a caregiver see every child, or named ones?** Written as every child in
   the family, because per-learner scoping doubles the permission model for a
   case that may never come up. The membership row has room for a `learnerIds`
   field when it does.
5. **Deletion is a request, not a button, for staff.** A parent deletes their own
   family outright; an admin actioning "delete my data" gets an audited,
   reason-carrying path with a 7-day soft-delete window. Confirm that window.
6. **Event volume.** ~30 events per round. A child playing daily for a year is
   roughly 300 k events — fine for Mongo, but the 400-day TTL is what keeps it
   from being a decision you have to make later under pressure.
