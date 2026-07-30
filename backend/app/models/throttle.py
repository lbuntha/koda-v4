"""Persisted login-failure counters.

In Mongo rather than in memory so a restart cannot reset an attacker's budget and every
replica sees the same count. Rows expire on their own — a counter is worth keeping only while
it can still deny something.
"""

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class LoginThrottle(Document):
    #: Scoped key, e.g. "adult:someone@example.com", "pin:<student_id>", "ip:203.0.113.4".
    #: Kept opaque so the collection never becomes a directory of who has an account.
    key: str
    attempts: int = 0
    window_started_at: datetime = Field(default_factory=_now)
    locked_until: datetime | None = None
    updated_at: datetime = Field(default_factory=_now)
    #: Swept by Mongo once the row can no longer deny anything.
    expires_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "login_throttles"
        indexes = [
            IndexModel([("key", ASCENDING)], unique=True),
            IndexModel([("expires_at", ASCENDING)], expireAfterSeconds=0),
        ]
