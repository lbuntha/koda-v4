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
    event_type: str | None = None
    slide_index: int | None = None
    client_timestamp_ms: int | None = None
    received_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "learning_events"
        indexes = [
            IndexModel([("student_id", 1), ("client_timestamp_ms", -1)]),
        ]
