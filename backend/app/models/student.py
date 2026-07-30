"""Student (kid) accounts — provisioned by a parent, no email required (COPPA-friendly)."""

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Student(Document):
    name: str
    avatar: str | None = None
    grade_level: str | None = "grade_1"
    primary_subject: str | None = "math"
    # Optional 4-digit PIN (hashed). Required for independent sign-in; a
    # parent-launched session doesn't need it.
    pin_hash: str | None = None
    # String ids of the parent User(s) who guard this child.
    guardian_parent_ids: list[str] = Field(default_factory=list)
    birth_year: int | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "students"
        indexes = [IndexModel("guardian_parent_ids")]
