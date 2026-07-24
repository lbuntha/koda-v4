"""Learning events — mirrors the frontend `LearningEvent` (services/logSchema.ts),
which was already DB-row-shaped. `extra="allow"` keeps every field the client
sends without a lockstep schema migration; `student_id` is always set server-side
from the authenticated student token (never trusted from the client)."""

from datetime import datetime, timezone

from beanie import Document
from pydantic import ConfigDict, Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LearningEvent(Document):
    model_config = ConfigDict(extra="allow")

    # Authoritative owner — set from the token, not the payload.
    student_id: str
    # The client's own event id (from analyticsLogger), kept for idempotency/debug.
    client_id: str | None = None

    # ── Canonical, correctness-critical columns (normalized by events/contract.py).
    # `verified` events are the only ones the scoring/recommendation engines replay;
    # diagnostic camelCase extras still ride along via extra="allow".
    schema_version: int | None = None
    session_id: str | None = None
    occurred_at: str | None = None            # client ISO string, kept as-is
    client_timestamp_ms: int | None = None
    event_type: str | None = None
    outcome: str | None = None
    attempt_number: int | None = None
    hint_used_before_attempt: bool | None = None
    time_on_task_ms: int | None = None
    question_id: str | None = None
    technique: str | None = None
    subject_area: str | None = None
    difficulty: str | None = None
    curriculum_skill_id: str | None = None
    curriculum_id: str | None = None
    curriculum_revision: int | None = None
    release_id: str | None = None
    assignment_id: str | None = None
    recommendation_run_id: str | None = None
    slide_index: int | None = None
    total_slides: int | None = None
    verified: bool = False
    verification_error: str | None = None

    received_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "learning_events"
        indexes = [
            IndexModel([("student_id", 1), ("client_timestamp_ms", -1)]),
            # Per-skill replay: the scoring engine reads one skill's verified
            # attempts in time order.
            IndexModel([("student_id", 1), ("curriculum_skill_id", 1), ("client_timestamp_ms", 1)]),
            IndexModel(
                [("student_id", 1), ("client_id", 1)],
                unique=True,
                partialFilterExpression={"client_id": {"$type": "string"}},
            ),
        ]
