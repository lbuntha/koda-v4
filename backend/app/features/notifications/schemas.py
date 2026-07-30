"""Request/response models for the notifications feature."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

NotificationChannel = Literal["in_app", "email"]
NotificationAudience = Literal["parents", "students", "all", "user", "student"]


class ComposeNotificationIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=4000)
    audience: NotificationAudience
    target_user_id: str | None = None
    target_student_id: str | None = None
    channels: list[NotificationChannel] = Field(default_factory=lambda: ["in_app"])
    scheduled_for: datetime | None = None

    @model_validator(mode="after")
    def target_matches_audience(self):
        if self.audience == "user" and not self.target_user_id:
            raise ValueError("audience 'user' requires target_user_id")
        if self.audience == "student" and not self.target_student_id:
            raise ValueError("audience 'student' requires target_student_id")
        if "email" in self.channels and self.audience in ("students", "student"):
            raise ValueError("students have no email address; remove the email channel")
        return self


class NotificationOut(BaseModel):
    id: str
    kind: str
    title: str
    body: str
    audience: str
    channels: list[str]
    created_by: str | None = None
    scheduled_for: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime
    recipient_count: int = 0


class NotificationStatsOut(BaseModel):
    recipients: int
    read: int
    email_sent: int


class InboxItemOut(BaseModel):
    id: str  # receipt id
    notification_id: str
    kind: str
    title: str
    body: str
    created_at: datetime
    read_at: datetime | None = None


class InboxOut(BaseModel):
    items: list[InboxItemOut]
    unread_count: int
