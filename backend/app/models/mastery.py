"""Cached proficiency projection per (student, curriculum, skill) — Phase 0/3.

A projection (cache) of the scoring engine over the verified learning-event log.
The event log is the source of truth; this is recomputable at any time (that's
what makes the replay command rollback-safe). Stored so "which skills are due?"
and "what's the rank?" are cheap queries, and so a promotion is stable enough to
celebrate. Stamped with the engine + scoring-config revision that produced it.
"""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MasteryState(Document):
    student_id: str
    skill_id: str
    curriculum_id: str | None = None

    level: str = "not_started"
    score: float = 0.0
    components: dict[str, Any] = Field(default_factory=dict)

    plays: int = 0
    sessions: int = 0
    distinct_days: int = 0
    hard_plays: int = 0

    last_practiced_at: str | None = None
    last_successful_review_at: str | None = None
    last_review_outcome: str | None = None
    recent_score: float = 0.0
    next_review_at: datetime | None = None   # THE scheduler field — query "due" off this
    promoted_at: datetime | None = None
    highest_earned_level: str = "not_started"  # retained trophy, even when review is due

    scoring_revision: int = 1
    engine_revision: str = ""
    last_event_id: str | None = None
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "mastery_states"
        indexes = [
            IndexModel([("student_id", 1), ("curriculum_id", 1), ("skill_id", 1)], unique=True),
            IndexModel([("student_id", 1), ("next_review_at", 1)]),
        ]
