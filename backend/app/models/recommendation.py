"""Phase 2 recommendation decisions and student login sessions."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RecommendationRun(Document):
    run_id: str
    student_id: str
    session_id: str
    sequence: int = 1
    assignment_release_ids: list[str] = Field(default_factory=list)
    scoring_revision: int = 1
    engine_revision: str
    candidates: list[dict[str, Any]] = Field(default_factory=list)
    served_items: list[dict[str, Any]] = Field(default_factory=list)
    decisions: list[dict[str, Any]] = Field(default_factory=list)
    invalidated_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "recommendation_runs"
        indexes = [
            IndexModel("run_id", unique=True),
            IndexModel([("student_id", 1), ("session_id", 1), ("sequence", 1)], unique=True),
            IndexModel([("student_id", 1), ("created_at", -1)]),
        ]


class StudentSession(Document):
    session_id: str
    student_id: str
    source: str
    started_at: datetime = Field(default_factory=_now)
    ended_at: datetime | None = None
    events_count: int = 0
    last_seen_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "student_sessions"
        indexes = [
            IndexModel("session_id", unique=True),
            IndexModel([("student_id", 1), ("started_at", -1)]),
        ]
