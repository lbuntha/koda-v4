# Rewards — how XP, levels and badges actually reach a learner

**One place to set the numbers, one path from an authored curriculum to a child's screen.**

---

## 1. Where the numbers live

Set **once**, in Settings → Progression & mastery, alongside the streak and recommendation
settings. Every curriculum inherits them:

| | Default | Why |
|---|---|---|
| Correct answer | 4 XP | |
| First-try bonus | 2 XP | Rewards thinking before answering, not persistence alone |
| Activity completion | 12 XP | Finishing is worth more than any single answer |
| XP per level | 120 | See below |

A curriculum can override any of these if a course genuinely needs different economics. It
inherits everything it does not mention — it can no longer end up with zeros by omission.

**Why 120 per level:**

```
5 questions × (4 correct + 2 first-try) + 12 completion  =  42 XP per skill
× 3 activities per session                               = 126 XP per session
                                                         →   1 level per completed quest
                                                         ≈  10 levels per 30-skill year
```

One level per *completed* quest. Frequent enough that a six-year-old feels it, and it still
requires finishing all three activities. At 100 they would level up without finishing; at 200
a good session gets two-thirds of the way and feels flat.

---

## 2. The flow

```
   Settings                Curriculum Studio              Assignments            Learner
   ────────                ─────────────────              ───────────            ───────
   set XP + level   ──┐    author units & skills
   (once, system)     │    add questions per skill
                      │              │
                      │              ▼
                      └────► ✱ PUBLISH A RELEASE ────►  assign learner  ────►  play
                             snapshots tree + questions   to that release       earn XP
                             + any curriculum override                          level up
                                                                                earn badges
```

**The step that is easy to miss is marked ✱.**

Rewards and questions reach a learner **only through a release**. Editing the draft changes
nothing for anyone already assigned — releases are immutable by design, so a learner's history
cannot be rewritten under them.

This has bitten already: `Grade 1 Mathematics` had rewards written to its draft while its only
release still carried none, so a learner assigned to that release would have earned nothing.

**Rule of thumb: if you changed the curriculum and want learners to see it, publish.**

System-level settings are the exception — they are read live, so changing the XP values in
Settings applies everywhere immediately, including to past events, because XP is replayed
from events rather than stored as a counter.

---

## 3. What a learner sees

- **XP** — recomputed from verified events every time, never stored as a counter, so it cannot
  drift. Duplicate awards collapse: re-answering the same question in the same session does
  not pay twice.
- **Level** — `totalXp ÷ xpPerLevel`, with progress toward the next.
- **Badges** — nine by default, with every skill-based target derived from the curriculum's
  real size, so the same ladder lands sensibly on a 3-skill course and a 30-skill one.

Badges use the **longest** streak, not the current one. A badge is not revoked because a child
missed a day.

---

## 4. When it does not work

Curriculum health (studio sidebar) flags all of these:

| Symptom | Cause |
|---|---|
| "no rewards are configured" | Only possible if system settings are empty too |
| "every XP award is 0" | Someone set them to zero explicitly |
| "no XP-per-level threshold" | Learners earn XP but never level up |
| "…can never be earned" | A badge needs more skills than the curriculum has |

Not yet flagged, and the one to watch: **a curriculum whose draft differs from its published
release.** That is the ✱ step above, and today nothing warns you about it.

---

## 5. Checking a real learner

```bash
docker compose exec api python -c "
import asyncio
from app.core.db import init_db
from app.models.student import Student
from app.features.progression.service import build_progress
async def main():
    await init_db()
    s = [x for x in await Student.find_all().to_list() if x.name == 'Jutta'][0]
    p = await build_progress(str(s.id))
    print(p['rewardProfile']['totalXp'], p['rewardProfile']['level'])
asyncio.run(main())"
```

If XP is 0 and the learner has played, check in this order: does the **release** carry rewards
(not the draft), are the events `verified`, and do they carry a `release_id`.
