# Security

Everything that decides whether a request may happen lives in one package,
`server/app/security/`. This file is the model it implements; `docs/BACKEND.md`
§5 is the role table it enforces.

The service holds children's learning records. That shapes every choice below:
the interesting failure is not an outage, it is one family reading another's
child, or an operator quietly reading everyone's.

---

## 1. Four layers, and why each exists

```
request
   │
   ├─ 1. authentication   who is calling?          security/permissions.principal
   │        401 without a valid bearer token
   │
   ├─ 2. authorization    may they do this kind    security/permissions.require
   │        403           of thing?                security/policy (the table)
   │
   ├─ 3. tenancy          to whose data?           security/tenancy.scoped
   │        the query itself carries familyId
   │
   └─ 4. rate limiting    how often may they try?  security/rate_limit
            429           guessable things only
```

**Layers 2 and 3 are a pair, and that is the point.** A permission check alone
would let a wrong table entry read another family. A scoped query alone would
let any signed-in person do anything within their own family. Both hold, so
either one being wrong is contained by the other.

| Module | Owns |
|---|---|
| `scheme.py` | The `HTTPBearer` scheme — declared, so /docs shows Authorize and every guarded route shows a lock |
| `permissions.py` | `principal` · `AUTHENTICATED` · `require(...)` |
| `policy.py` | The permission strings, the role table, `effective_permissions` |
| `tenancy.py` | `scoped()` — the only place a `familyId` filter is built |
| `tokens.py` | Issue, read, rotate; refresh hashing |
| `passwords.py` | Argon2id, and nothing else |
| `rate_limit.py` | Attempt budgets, in Mongo with a TTL |

Nothing outside this package reads a token, hashes a password or writes a
`familyId` filter by hand.

---

## 2. Authentication

Every router lists the guard **once**:

```python
router = APIRouter(prefix="/devices", tags=["devices"], dependencies=[AUTHENTICATED])
```

Not per handler. A guard you have to remember on each new route is a guard that
will eventually be forgotten, and the forgotten one is the one that matters.

**The only unauthenticated routes**, each with a reason it cannot be otherwise:

| Route | Why |
|---|---|
| `GET /v1/health` | Liveness, before anyone has signed in |
| `POST /v1/auth/signup` | There is no token before an account exists |
| `POST /v1/auth/login` | Ditto |
| `POST /v1/auth/refresh` | Carries its own credential in the body |

`tests/test_guarded.py` sweeps the OpenAPI schema and asserts **401** for every
route not on that list — so a route added next month is covered the day it is
added, and adding a public one means editing the list, in a diff, on purpose.

**Tokens.** Access: JWT, 15 minutes, carrying `familyId`, `role`, `platformRole`
and the effective permission set. Refresh: 32 random bytes, 60 days, rotated on
use, stored only as SHA-256 — a leaked database cannot be replayed as a session,
and "sign this tablet out" is one field cleared.

**In production the OpenAPI schema is off.** It was the one thing answering
without a token; a map of every route and body shape is not something to hand
out for free.

---

## 3. Authorization

The role is the base and stays what you reason about. Per-person exceptions live
on the membership row (`extraPermissions`, `deniedPermissions`) and only the
*difference* is stored, so changing someone's role later still moves everything
else. `effective_permissions()` folds the three together, and the result rides
on the access token — a check costs no round trip, and a change reaches a device
within the token's fifteen minutes.

Two rules the table cannot be talked out of:

- **`learner_data:write` is nobody's.** Rewriting a child's record would make it
  fiction. It is stripped from every effective set, including an owner's, even
  when explicitly granted.
- **Staff hold nothing over a child's record by role.** `GRANT_ONLY` keeps
  `learner_data:*` out of every platform role; reaching it takes a time-boxed,
  audited, parent-visible grant (P2.5).

---

## 4. Tenancy

```python
await db.learners.insert_one({**body.model_dump(), "familyId": p.family_id})
#                                                              ↑ from the token
```

`familyId` comes from the token, never from a path or body. `scoped()` raises
for a principal with no family rather than returning an unscoped filter —
because that is precisely how "an admin reads one family" becomes "an admin
reads all of them".

`tests/test_tenancy.py` proves it from the outside: family A cannot list, read
or delete family B's rows, and a borrowed id comes back 404 rather than acting.

---

## 5. Rate limiting

Two windows, because they stop different attacks: **per IP** catches one machine
grinding through accounts; **per account** catches a distributed attempt at one
account, which the IP limit alone never sees.

| Route | Budget |
|---|---|
| `POST /auth/login` | 20/min per IP · 10/min per email |
| `POST /auth/signup` | 5 per 5 min per IP |

A correct password clears the account's budget, so somebody who mistyped twice
is not still counted against. Counters live in Mongo with a TTL index, not in
memory: two containers behind a load balancer must share one count, and a
limiter that resets on deploy is one an attacker waits out.

Join codes get the same treatment when they land — an eight-character code
without a limiter is a script away.

---

## 6. Data handling

- **Passwords**: Argon2id. Never logged, never returned, rehash on parameter change.
- **Refresh tokens and join codes**: random, stored as hashes, rotated, revocable.
- **Children's data minimisation is a design rule, not a promise.** Events carry
  no names, no typed text, no audio. A display name and an optional birth *year*
  are the only child data. The event model keeps unknown fields rather than
  rejecting them — so the rule is enforced by what clients *send*, and is worth
  re-checking whenever a new event type appears.
- **Secrets**: `JWT_SECRET` from the environment; the service refuses to start in
  production while it still holds the development default.

---

## 7. Known gaps

Written down rather than implied, because a gap you have not named is one you
will be surprised by.

| Gap | Where it bites |
|---|---|
| No audit log yet | Nothing records what an admin did. Required before staff touch real families (P2.5) |
| No grants yet | So today staff simply *cannot* reach a child's record — the safe failure, but not the intended one |
| No TOTP yet | `totpSecret` exists on the user; nothing issues or checks it |
| No account lockout beyond the rate limit | A slow, patient attacker is only slowed |
| Device revocation is manual | No "sign out everywhere" button, though the CLI can do it |
| CORS is a config list | Correct for one origin; revisit before a second front end exists |
