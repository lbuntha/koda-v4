"""Canonical academic catalogs referenced by authored curricula."""

from datetime import datetime, timezone

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


# Student-page layout bands (see docs/student-page-redesign.md). The layout for
# each band is code; which band a grade uses is admin-authored data.
LAYOUT_BANDS = ("kid", "student", "focus")


def default_band_for_order(order: int) -> str:
    """Fallback band when a grade has no explicit ``layout_band``.

    Heuristic on the grade's sequence: 1–6 → kid, 7–9 → student, 10+ → focus.
    Admins override per grade via ``Grade.layout_band``.
    """
    if order <= 6:
        return "kid"
    if order <= 9:
        return "student"
    return "focus"


def resolve_layout_band(grade: "Grade") -> str:
    """The effective band for a grade: its explicit choice, else the default."""
    if grade.layout_band in LAYOUT_BANDS:
        return grade.layout_band
    return default_band_for_order(grade.order)


class Grade(Document):
    key: str
    code: str
    name: str
    description: str = ""
    age_range: str = ""
    order: int = 1
    # None ⇒ auto-derive from `order` (see default_band_for_order); an explicit
    # value in LAYOUT_BANDS pins the student-page layout for this grade.
    layout_band: str | None = None
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
    icon_asset: dict | None = None
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
