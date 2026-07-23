"""Immutable authoring audit records for server-backed content changes."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


class ContentAuditEvent(Document):
    actor_id: str
    actor_role: str
    owner_id: str = ""
    resource_type: str
    curriculum_id: str | None = None
    action: str
    revision: int = 0
    summary: dict[str, Any] = Field(default_factory=dict)
    # Broadened audit fields (Phase 0, item 7) — sensitive mutations (assignments,
    # rosters, scoring config, releases, manual progression overrides) record the
    # exact change and why. Secrets must never be placed in before/after.
    reason: str | None = None
    before: dict[str, Any] | None = None
    after: dict[str, Any] | None = None
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Settings:
        name = "content_audit_events"
        indexes = [
            IndexModel([("owner_id", 1), ("occurred_at", -1)]),
            IndexModel([("actor_id", 1), ("occurred_at", -1)]),
            IndexModel([("owner_id", 1), ("curriculum_id", 1), ("occurred_at", -1)]),
            IndexModel([("resource_type", 1), ("occurred_at", -1)]),
        ]
