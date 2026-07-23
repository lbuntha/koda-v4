"""Teacher authorization scope (Phase 0, item 6).

A teacher may read a student ONLY through an active enrollment in a classroom the
teacher owns. This replaces the previous "any teacher can read any student" rule.
Admins still see everyone; parents still see their guardianed children.
"""

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Classroom(Document):
    owner_teacher_id: str
    name: str
    archived_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "classrooms"
        indexes = [IndexModel([("owner_teacher_id", 1), ("archived_at", 1)])]


class ClassEnrollment(Document):
    classroom_id: str
    student_id: str
    status: str = "active"  # active | removed
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "class_enrollments"
        indexes = [
            IndexModel([("classroom_id", 1), ("student_id", 1)], unique=True),
            # "which classrooms is this student actively in?" — the authorization query
            IndexModel([("student_id", 1), ("status", 1)]),
        ]
