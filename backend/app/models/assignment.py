"""Immutable-release assignment and placement projections (Phase 1)."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Assignment(Document):
    owner_id: str
    student_id: str
    curriculum_id: str
    release_id: str
    grade_id: str
    scope: dict[str, Any] = Field(default_factory=lambda: {"kind": "all", "ids": []})
    mode: str = "scheduled"
    schedule: dict[str, Any] | None = None
    priority: int = 100
    placement_required: bool = True
    status: str = "active"
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "assignments"
        indexes = [
            IndexModel([("student_id", 1), ("status", 1), ("priority", 1)]),
            IndexModel([("owner_id", 1), ("updated_at", -1)]),
            IndexModel(
                [("student_id", 1), ("release_id", 1), ("scope", 1)],
                unique=True,
                partialFilterExpression={"status": "active"},
            ),
        ]


class Placement(Document):
    student_id: str
    assignment_id: str
    grade_id: str
    curriculum_id: str
    release_id: str
    generator_revision: int
    scoring_revision: int
    status: str = "pending"
    item_manifest: list[dict[str, Any]] = Field(default_factory=list)
    responses: list[dict[str, Any]] = Field(default_factory=list)
    score_by_skill: dict[str, float] = Field(default_factory=dict)
    frontier_skill_id: str | None = None
    eligible_skill_ids: list[str] = Field(default_factory=list)
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "placements"
        indexes = [
            IndexModel([("student_id", 1), ("assignment_id", 1)], unique=True),
            IndexModel([("student_id", 1), ("status", 1)]),
        ]


class ProgressionState(Document):
    student_id: str
    assignment_id: str
    curriculum_id: str
    release_id: str
    frontier_skill_id: str | None = None
    eligible_skill_ids: list[str] = Field(default_factory=list)
    placement_id: str | None = None
    placement_status: str = "pending"
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "progression_states"
        indexes = [IndexModel([("student_id", 1), ("assignment_id", 1)], unique=True)]
