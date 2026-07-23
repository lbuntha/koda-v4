"""Canonical academic catalogs referenced by authored curricula."""

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Grade(Document):
    key: str
    code: str
    name: str
    description: str = ""
    age_range: str = ""
    order: int = 1
    active: bool = True
    revision: int = 1
    created_by: str
    updated_by: str
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "grades"
        indexes = [
            IndexModel("key", unique=True),
            IndexModel("code", unique=True),
            IndexModel([("active", 1), ("order", 1)]),
        ]


class Subject(Document):
    key: str
    grade_id: str
    code: str
    name: str
    description: str = ""
    icon: str = ""
    color: str = "#534AB7"
    order: int = 1
    active: bool = True
    revision: int = 1
    created_by: str
    updated_by: str
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "subjects"
        indexes = [
            IndexModel("key", unique=True),
            IndexModel([("grade_id", 1), ("code", 1)], unique=True),
            IndexModel([("grade_id", 1), ("active", 1), ("order", 1)]),
        ]
