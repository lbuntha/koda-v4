"""How many days in a row, and whether today is the day it breaks.

Its own module because a streak is a *rule*, not a number, and the rule is the
whole of what `streak_ending` sends. Two decisions carry it:

**A streak counted from the server's copy, not reported by a device.** The
client keeps its own (`src/App.tsx` publishes `dayStreak` to `profile_stats`),
and `routers/profile.py` says out loud what that is worth: those figures are
*reported*, not observed, and deriving them server-side is the fix when a figure
has to be defensible. A notification is exactly that case — telling a parent
their child's four-day streak ends today, on a number the tablet made up, is
worse than not telling them.

**Yesterday still counts; today does not break it yet.** A streak is live if the
last practice was today or yesterday, and it is *ending* only when the last was
yesterday and nothing has happened today. Counting a streak as broken at
midnight would make every reminder a bereavement notice, and counting today as
required would send "your streak ends today" at nine in the morning to a child
who always practises after school.
"""

from datetime import date, timedelta

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repos import events as events_repo


def _as_date(day: str) -> date | None:
    try:
        return date.fromisoformat(day)
    except (TypeError, ValueError):
        # A client is entitled to write nonsense into its own field; a job is
        # not entitled to crash because of it.
        return None


def run_length(days: list[str], *, today: str) -> int:
    """Consecutive days ending today or yesterday. `days` is newest first.

    Returns 0 when the last practice is older than yesterday — that streak is
    over and counting it would be describing the past.
    """
    anchor = _as_date(today)
    if anchor is None:
        return 0

    seen = {parsed for parsed in (_as_date(day) for day in days) if parsed is not None}
    if not seen:
        return 0

    # Where the run has to start: today if they have practised, else yesterday.
    cursor = anchor if anchor in seen else anchor - timedelta(days=1)
    if cursor not in seen:
        return 0

    length = 0
    while cursor in seen:
        length += 1
        cursor -= timedelta(days=1)
    return length


async def for_learner(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, *, today: str
) -> int:
    days = await events_repo.practice_days(db, family_id, learner_id)
    return run_length(days, today=today)


def days_away(days: list[str], *, today: str) -> int | None:
    """Whole days since the last practice, or `None` if there has never been one.

    `None` rather than a large number, because "has not practised for 4,000
    days" is a sentence about a child who signed up this morning. The two cases
    are different facts and the caller has to word them differently.
    """
    anchor = _as_date(today)
    if anchor is None:
        return None
    seen = sorted(
        (parsed for parsed in (_as_date(day) for day in days) if parsed is not None),
        reverse=True,
    )
    if not seen:
        return None
    # Never negative: a device whose clock is ahead can write tomorrow's day
    # key, and "practised -1 days ago" is not a thing to put on a lock screen.
    return max(0, (anchor - seen[0]).days)


def ending(days: list[str], *, today: str) -> int:
    """The streak that lapses tonight, or 0 if there is nothing at stake.

    "At stake" is the precise thing: a streak that already includes today is not
    ending, and a run of one day is not a streak worth defending — a child who
    practised once yesterday has not built anything that a notification about
    losing it would be honest about.
    """
    if today in days:
        return 0
    length = run_length(days, today=today)
    return length if length >= 2 else 0


async def ending_today(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, *, today: str
) -> int:
    """`ending`, for a caller that holds a database rather than a list of days."""
    return ending(await events_repo.practice_days(db, family_id, learner_id), today=today)


async def for_reminder(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, *, today: str
) -> tuple[int, int | None]:
    """What tonight's reminder needs to know, in one read: at stake, and away for.

    One function because it is one query. `practice_days` is a `distinct` over
    the events collection — the most expensive thing the reminder job does — and
    asking it twice per learner per evening, once for the streak and once for
    the gap, would double the cost of the job to learn two facts that are in the
    same list of days.
    """
    days = await events_repo.practice_days(db, family_id, learner_id)
    return ending(days, today=today), days_away(days, today=today)
