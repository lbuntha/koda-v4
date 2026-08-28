"""The signed-in account's own recorded figures.

Same rule as `PATCH /auth/me`: no permission is named, because the token — not
the request — decides which row is reached. A child's read and write land on
their learner row, an adult's on their user row, and neither can name the other.

The write is what fills the row from real play: a learner's device sends its
own figures — streak, XP, level, stars, lessons — after every round it records,
and the row stops being the seeded sample. See `publishLearnerFigures` on the
client.

Worth being plain about what that means: these are *reported*, not observed.
The device is the only thing that saw the round, so a tampered client can claim
a streak it did not earn — the same trust the synced `progress` document
already carries. Deriving them server-side from the learning events is the fix
when a figure has to be defensible; nothing here has to change for it, because
the page only ever reads the row.
"""

from fastapi import APIRouter

from app.deps import AUTHENTICATED, CurrentPrincipal, Db
from app.models.profile import ProfileStatsIn, ProfileStatsOut
from app.repos import profile_stats

router = APIRouter(prefix="/profile", tags=["profile"], dependencies=[AUTHENTICATED])


def _subject(p: CurrentPrincipal) -> tuple[str, str]:
    """Whose figures these are. A child is their learner; anyone else is their
    account, falling back to the device for a session with neither."""
    if p.learner_id:
        return p.learner_id, "learner"
    if p.kind == "user":
        return p.subject_id, "user"
    return p.subject_id, "device"


def _out(row: dict) -> ProfileStatsOut:
    updated = row.get("updatedAt")
    return ProfileStatsOut(
        source=row.get("source", "placeholder"),
        updatedAt=updated.isoformat() if updated else None,
        dayStreak=row["dayStreak"],
        # `.get`: a row seeded before this figure existed has no key for it.
        longestStreak=row.get("longestStreak", 0),
        totalXp=row["totalXp"],
        level=row["level"],
        starsEarned=row["starsEarned"],
        lessonsMastered=row["lessonsMastered"],
        lessonsAvailable=row["lessonsAvailable"],
        dailyGoal=row["dailyGoal"],
        dailySolved=row["dailySolved"],
        topThreeFinishes=row["topThreeFinishes"],
        league=row.get("league"),
        badges=row.get("badges", []),
        childrenCount=row["childrenCount"],
        codesWaiting=row["codesWaiting"],
        permissionsCount=row["permissionsCount"],
    )


@router.get("/stats")
async def my_stats(p: CurrentPrincipal, db: Db) -> ProfileStatsOut:
    subject_id, kind = _subject(p)
    return _out(await profile_stats.ensure(db, subject_id, kind))


@router.patch("/stats")
async def record_my_stats(body: ProfileStatsIn, p: CurrentPrincipal, db: Db) -> ProfileStatsOut:
    subject_id, kind = _subject(p)
    # `exclude_unset`: "not mentioned" and "set to zero" are different requests,
    # and a partial write must not read the model's absent defaults as zeroes.
    patch = body.model_dump(by_alias=True, exclude_unset=True)
    return _out(await profile_stats.record(db, subject_id, kind, patch))
