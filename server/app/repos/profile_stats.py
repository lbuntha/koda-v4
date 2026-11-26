"""The numbers a profile prints, as a stored row rather than a calculation.

Every figure on the profile page used to be worked out at render time — stars
counted out of the device's completed-levels map, children counted out of the
`/learners` response, XP read from a `localStorage` blob. That is fine until the
first question anybody asks of a statistic: *what was it yesterday?* A derived
number has no history, no owner and no way to be corrected, and two screens
deriving it slightly differently disagree with no way to say which is right.

So each subject — one adult account, or one child — gets one row here, and the
profile reads the row. Nothing in this file computes a statistic; it stores
them. Filling them from real play is a separate job, and until that job exists
every row is seeded from `PLACEHOLDERS` and says so through `source`, so a
sample number is never mistaken for a measured one.
"""

import math
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now

#: Every recordable figure, and the sample value a fresh row carries.
#:
#: One flat shape for all three readings of the profile — a child's streak, a
#: parent's child count, an operator's permission count — because "which fields
#: exist" should not depend on who is looking. A reading that does not print a
#: field simply does not print it.
PLACEHOLDERS: dict[str, Any] = {
    # Learner figures.
    "dayStreak": 0,
    # The best run ever, beside the current one: a badge stands on the record
    # rather than on today, so a bad week never takes one back.
    "longestStreak": 0,
    "totalXp": 0,
    "level": 1,
    "starsEarned": 0,
    "lessonsMastered": 0,
    "lessonsAvailable": 0,
    "dailyGoal": 5,
    "dailySolved": 0,
    "topThreeFinishes": 0,
    "league": None,
    # A list, but still a recorded field: the profile must not invent badges
    # from whatever it can see locally.
    "badges": [],
    # Family figures, for the parent reading.
    "childrenCount": 0,
    "codesWaiting": 0,
    # Platform figures, for the staff reading.
    "permissionsCount": 0,
}

#: The names a writer is allowed to set. Anything else in a patch is ignored,
#: so a client cannot invent a field and have it stored beside the real ones.
FIELDS = frozenset(PLACEHOLDERS)

#: Lifetime figures a write may raise but never lower.
#:
#: A device that has not pulled the child's record yet — a new tablet, or one
#: just signed in — publishes its empty local copy, and a plain `$set` wrote
#: that 0 over 2,000 real XP until sync caught up. The `progress` document
#: already merges these with `max()`; this row has to agree with it. A real
#: reset still works: every reset deletes the row rather than writing to it.
NEVER_LOWER = frozenset({"totalXp", "longestStreak", "starsEarned", "lessonsMastered"})

#: Each level needs this much more XP than the one before (src/lib/level.ts).
LEVEL_STEP = 100


def level_from_xp(xp: Any) -> int:
    """The level a lifetime XP total reads as — the app's rule, in one place here.

    Level 2 at 100 XP, 3 at 300, 4 at 600, 5 at 1,000. Stored levels are never
    trusted: a level is a reading of XP, so it is worked out from the XP this
    row keeps, and a device on an older rule cannot write its old reading back.
    """
    try:
        total = max(0.0, float(xp))
    except (TypeError, ValueError):
        return 1
    if total != total:  # NaN
        return 1
    start = lambda level: LEVEL_STEP // 2 * level * (level - 1)  # noqa: E731
    level = max(1, int((1 + math.sqrt(1 + 8 * total / LEVEL_STEP)) // 2))
    while start(level + 1) <= total:
        level += 1
    while level > 1 and start(level) > total:
        level -= 1
    return level


async def ensure(db: AsyncIOMotorDatabase, subject_id: str, kind: str) -> dict[str, Any]:
    """The subject's row, created from the placeholders if it is not there yet.

    `$setOnInsert` throughout: a row that has been written by the real scorer
    must not be reset to samples by the next read.
    """
    return await db.profile_stats.find_one_and_update(
        {"_id": subject_id},
        {
            "$setOnInsert": {
                **PLACEHOLDERS,
                "kind": kind,
                # Flips to "recorded" the first time anything writes a real
                # figure. The page shows a sample badge while it says this.
                "source": "placeholder",
                "createdAt": now(),
                "updatedAt": now(),
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


async def record(
    db: AsyncIOMotorDatabase, subject_id: str, kind: str, patch: dict[str, Any]
) -> dict[str, Any]:
    """Write some of a subject's figures. The seam the real scorer will use.

    Partial by design — whatever measures the streak has no opinion about the
    number of children, and should not have to send one to avoid clobbering it.
    """
    known = {key: value for key, value in patch.items() if key in FIELDS}
    await ensure(db, subject_id, kind)
    if not known:
        return await ensure(db, subject_id, kind)
    raised = {key: value for key, value in known.items() if key in NEVER_LOWER}
    replaced = {key: value for key, value in known.items() if key not in NEVER_LOWER}
    update: dict[str, Any] = {"$set": {**replaced, "source": "recorded", "updatedAt": now()}}
    replaced.pop("level", None)
    if raised:
        update["$max"] = raised
    row = await db.profile_stats.find_one_and_update(
        {"_id": subject_id},
        update,
        return_document=ReturnDocument.AFTER,
    )
    level = level_from_xp(row.get("totalXp", 0))
    if row.get("level") != level:
        row = await db.profile_stats.find_one_and_update(
            {"_id": subject_id}, {"$set": {"level": level}}, return_document=ReturnDocument.AFTER
        )
    return row
