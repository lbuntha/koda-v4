"""What a parent sees first on Home: each child's day, week and gap, in one read.

Computed from the learning log rather than from `profile_stats`, for the reason
`streaks.py` gives: those figures are reported by whichever device last played,
and a parent's "12 minutes today" should stand on what the server received.

The one thing worth drawing a parent's eye to — a child away longer than the
operator's absence threshold — comes back already worded, in the absence kind's
own push wording, so an admin who rewords that message rewords this too.
"""

from datetime import timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now as utc_now
from app.repos import events as events_repo
from app.repos import learners as learners_repo
from app.repos import notify_jobs, notify_schedule
from app.services import milestones, push, streaks

ABSENCE = "learn.absence"


def _away_text(away: int) -> str:
    return "a day" if away <= 1 else f"{away} days"


async def for_family(db: AsyncIOMotorDatabase, family_id: str, user_id: str | None) -> dict[str, Any]:
    at = utc_now()
    # The parent's own clock first — they are the one reading "today" — and the
    # family's learning log when their browser never said.
    offset = (await notify_schedule.for_user(db, user_id))["tzOffsetMinutes"] if user_id else None
    if offset is None:
        offset = await events_repo.latest_tz_offset(db, family_id)
    local = at + timedelta(minutes=offset or 0)
    today = local.date().isoformat()
    week = {(local.date() - timedelta(days=back)).isoformat() for back in range(7)}
    threshold = (await notify_jobs.get(db, "absence-check"))["days"]

    children: list[dict[str, Any]] = []
    attention: dict[str, Any] | None = None
    for learner in await learners_repo.for_family(db, family_id):
        learner_id = learner["_id"]
        name = learner.get("displayName") or "Your child"
        days = await events_repo.practice_days(db, family_id, learner_id)
        rounds, spent_ms = await events_repo.rounds_and_time(db, family_id, learner_id, [today])
        goal = await milestones.goal_for(db, family_id, learner_id)
        away = streaks.days_away(days, today=today)

        children.append(
            {
                "id": learner_id,
                "displayName": name,
                "avatarSeed": learner.get("avatarSeed") or learner_id,
                "today": {
                    "rounds": rounds,
                    "minutes": round(spent_ms / 60_000),
                    "goal": goal,
                    "goalMet": rounds >= goal,
                },
                "streak": streaks.run_length(days, today=today),
                "daysAway": away,
                "daysThisWeek": len(week.intersection(days)),
            }
        )

        if attention is None and away is not None and away >= threshold:
            title, body = await push.wording(db, ABSENCE, {"learner": name, "away": _away_text(away)})
            attention = {"learnerId": learner_id, "kind": ABSENCE, "title": title, "body": body}

    return {
        "children": children,
        "attention": attention,
        "generatedAt": at.isoformat(),
        "absenceDays": threshold,
    }
