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
    # The curriculum subject this assignment teaches. Older rows may not have
    # this yet; the backfill script infers it from their immutable release.
    subject_id: str | None = None
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
            IndexModel([("student_id", 1), ("grade_id", 1), ("subject_id", 1), ("status", 1)]),
            IndexModel([("owner_id", 1), ("updated_at", -1)]),
            IndexModel(
                [("student_id", 1), ("release_id", 1), ("subject_id", 1), ("scope", 1)],
                unique=True,
                partialFilterExpression={"status": "active"},
                name="student_release_subject_scope_active_unique",
            ),
        ]


class CurriculumOffering(Document):
    """The published curriculum used for one grade/subject combination.

    Assignments stay pinned to the release they started with. Updating an
    offering therefore changes provisioning for new learners without silently
    moving existing learners onto different content.
    """

    grade_id: str
    subject_id: str
    curriculum_id: str
    release_id: str
    active: bool = True
    # Explicit subject progression. A curriculum can be terminal (both null), and
    # subjects advance independently rather than changing Student.grade_level.
    successor_grade_id: str | None = None
    successor_subject_id: str | None = None
    # Admin-selected evidence required before parents receive a promotion card.
    # Existing offerings intentionally inherit the least surprising rule.
    promotion_completion_rule: str = "activities_completed"
    promotion_placement_required: bool = True
    revision: int = 1
    created_by: str
    updated_by: str
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "curriculum_offerings"
        indexes = [
            IndexModel([("grade_id", 1), ("subject_id", 1)], unique=True),
            IndexModel([("active", 1), ("grade_id", 1), ("subject_id", 1)]),
            IndexModel([("release_id", 1)]),
        ]


class CurriculumPromotion(Document):
    """One durable, parent-decided transition from a completed assignment."""

    owner_id: str
    student_id: str
    subject_id: str
    from_assignment_id: str
    from_curriculum_id: str
    from_release_id: str
    from_grade_id: str
    to_grade_id: str | None = None
    to_subject_id: str | None = None
    to_curriculum_id: str | None = None
    to_release_id: str | None = None
    to_assignment_id: str | None = None
    status: str = "pending"
    detected_at: datetime = Field(default_factory=_now)
    deferred_until: datetime | None = None
    decided_at: datetime | None = None
    decided_by: str | None = None

    class Settings:
        name = "curriculum_promotions"
        indexes = [
            IndexModel("from_assignment_id", unique=True),
            IndexModel([("owner_id", 1), ("status", 1), ("detected_at", -1)]),
            IndexModel([("student_id", 1), ("subject_id", 1), ("status", 1)]),
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
