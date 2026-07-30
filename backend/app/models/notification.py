"""Notifications: one authored `Notification` (an admin broadcast, or a
system-generated achievement/streak/digest) plus one `NotificationReceipt` per
recipient. Fan-out is materialized at send time — a receipt row per recipient —
rather than the bell computing audience membership on every read.

Automated notifications are deduplicated by `idempotency_key`, enforced by the
unique partial index below: the generator inserts and lets a `DuplicateKeyError`
signal "already sent", the same race-handling shape `runtime_settings
.get_system_settings` already uses for its own singleton document.
"""

from datetime import datetime, timezone
from typing import Literal

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


NotificationKind = Literal[
    "broadcast", "announcement",
    "auto_achievement", "auto_streak", "auto_digest",
    "auto_review", "auto_inactivity", "auto_pin_lockout",
    "auto_curriculum_completion",
]
NotificationAudience = Literal["parents", "students", "all", "user", "student"]
NotificationChannel = Literal["in_app", "email"]


class Notification(Document):
    kind: NotificationKind
    title: str
    body: str
    audience: NotificationAudience
    # Set only when audience == "user" / "student" respectively.
    target_user_id: str | None = None
    target_student_id: str | None = None
    channels: list[NotificationChannel] = Field(default_factory=lambda: ["in_app"])
    # Admin User._id for a compose action; None for system-generated notifications.
    created_by: str | None = None
    # None for admin broadcasts, which may legitimately be resent.
    idempotency_key: str | None = None
    scheduled_for: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "notifications"
        indexes = [
            IndexModel([("kind", 1), ("created_at", -1)]),
            IndexModel(
                "idempotency_key",
                unique=True,
                partialFilterExpression={"idempotency_key": {"$type": "string"}},
            ),
            # Due-job scan: scheduled broadcasts not yet fanned out.
            IndexModel([("scheduled_for", 1), ("sent_at", 1)]),
        ]


class NotificationReceipt(Document):
    notification_id: str
    recipient_type: Literal["user", "student"]
    recipient_id: str
    read_at: datetime | None = None
    # None if this receipt has no email channel (e.g. a student, or in-app-only send).
    email_sent_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "notification_receipts"
        indexes = [
            IndexModel([("recipient_type", 1), ("recipient_id", 1), ("created_at", -1)]),
            IndexModel([("recipient_type", 1), ("recipient_id", 1), ("read_at", 1)]),
            IndexModel("notification_id"),
        ]
