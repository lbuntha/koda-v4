"""Weekly leaderboard projection over private, append-only learning events.

The client reports outcomes, not currency. XP is derived here from the same
deployment scoring rules used by the app, so changing an ``xpEarned`` extra in
a sync payload cannot buy a leaderboard position.
"""

import math
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase


@dataclass(frozen=True)
class ScoringRules:
    two_star_share: float = 0.7
    one_star_share: float = 0.4
    xp_per_level: int = 20
    three_star_at: float = 0.9
    two_star_at: float = 0.6


DEFAULT_RULES = ScoringRules()


def _number(value: Any, fallback: float) -> float:
    if isinstance(value, bool):
        return fallback
    try:
        number = float(value)
    except (TypeError, ValueError):
        return fallback
    return number if math.isfinite(number) else fallback


def _clamp(value: float, low: float, high: float) -> float:
    return min(high, max(low, value))


def sanitise_rules(raw: dict[str, Any] | None) -> ScoringRules:
    """Mirror the browser's scoring bounds while failing safely on bad data."""
    value = raw or {}
    two_star_at = _clamp(
        _number(value.get("twoStarAt"), DEFAULT_RULES.two_star_at), 0, 1
    )
    one_star_share = _clamp(
        _number(value.get("oneStarShare"), DEFAULT_RULES.one_star_share), 0, 1
    )
    two_star_share = _clamp(
        _number(value.get("twoStarShare"), DEFAULT_RULES.two_star_share),
        one_star_share,
        1,
    )
    xp_value = value.get("xpPerLevel", value.get("defaultLessonXp"))
    xp_per_level = int(
        _clamp(math.floor(_number(xp_value, DEFAULT_RULES.xp_per_level) + 0.5), 0, 500)
    )
    three_star_at = _clamp(
        _number(value.get("threeStarAt"), DEFAULT_RULES.three_star_at),
        two_star_at,
        1,
    )
    return ScoringRules(
        two_star_share=two_star_share,
        one_star_share=one_star_share,
        xp_per_level=xp_per_level,
        three_star_at=three_star_at,
        two_star_at=two_star_at,
    )


def week_bounds(at: datetime, tz_offset_minutes: int) -> tuple[date, date]:
    """The Monday-to-Sunday week containing ``at`` in the requested offset."""
    if at.tzinfo is None:
        at = at.replace(tzinfo=UTC)
    local_day = (at.astimezone(UTC) + timedelta(minutes=tz_offset_minutes)).date()
    start = local_day - timedelta(days=local_day.weekday())
    return start, start + timedelta(days=6)


def xp_for_event(event: dict[str, Any], rules: ScoringRules) -> int:
    questions = event.get("questionsAnswered")
    correct = event.get("correctFirstTry")
    if isinstance(questions, bool) or not isinstance(questions, (int, float)):
        return 0
    if isinstance(correct, bool) or not isinstance(correct, (int, float)):
        return 0
    if not math.isfinite(float(questions)) or not math.isfinite(float(correct)):
        return 0
    total = max(0, int(questions))
    if total == 0:
        accuracy = 0
    else:
        accuracy = min(total, max(0, int(correct))) / total
    if accuracy >= rules.three_star_at:
        share = 1
    elif accuracy >= rules.two_star_at:
        share = rules.two_star_share
    else:
        share = rules.one_star_share
    # JavaScript Math.round for a non-negative reward, rather than Python's
    # ties-to-even round, keeps this projection identical to scoreRound.ts.
    return math.floor(rules.xp_per_level * share + 0.5)


async def weekly_xp(
    db: AsyncIOMotorDatabase,
    subjects: list[tuple[str, str]],
    start: date,
    end: date,
) -> dict[tuple[str, str], int]:
    """Return totals keyed by ``(family id, learner id)`` for exact subjects."""
    totals = {subject: 0 for subject in subjects}
    if not subjects:
        return totals

    scoring = await db.defaults.find_one({"_id": "scoring"}, {"value": 1})
    rules = sanitise_rules(scoring.get("value") if scoring else None)
    projection = {
        "familyId": 1,
        "learnerId": 1,
        "questionsAnswered": 1,
        "correctFirstTry": 1,
    }
    # Public boards can contain many learners. Chunk the exact tenant/learner
    # pairs so one large public opt-in set never creates an oversized Mongo
    # query document.
    for offset in range(0, len(subjects), 200):
        query = {
            "type": "lesson_completed",
            "localDay": {"$gte": start.isoformat(), "$lte": end.isoformat()},
            "$or": [
                {"familyId": family_id, "learnerId": learner_id}
                for family_id, learner_id in subjects[offset : offset + 200]
            ],
        }
        async for event in db.events.find(query, projection):
            key = (event.get("familyId"), event.get("learnerId"))
            if key in totals:
                totals[key] += xp_for_event(event, rules)
    return totals
