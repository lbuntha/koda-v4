from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class ScopeIn(BaseModel):
    kind: Literal["all", "grades", "units", "skills"] = "all"
    ids: list[str] = Field(default_factory=list, max_length=250)


class AssignmentIn(BaseModel):
    student_id: str = Field(min_length=1, max_length=120)
    curriculum_id: str = Field(min_length=1, max_length=120)
    release_id: str = Field(min_length=1, max_length=120)
    grade_id: str = Field(min_length=1, max_length=120)
    subject_id: str | None = Field(default=None, min_length=1, max_length=120)
    scope: ScopeIn = Field(default_factory=ScopeIn)
    mode: Literal["scheduled", "self_paced"] = "scheduled"
    schedule: dict[str, Any] | None = None
    priority: int = Field(default=100, ge=0, le=1000)
    placement_required: bool = True

    @field_validator("student_id", "curriculum_id", "release_id", "grade_id", "subject_id")
    @classmethod
    def clean_ids(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None


class AssignmentStatusIn(BaseModel):
    """Both edits an adult may make to a live assignment.

    `release_id` is the explicit upgrade path required by docs/progression-design.md §13.3:
    releases stay immutable, so newly published content (a skill's artwork, a new question)
    only reaches a learner when an authorized adult moves the assignment onto it. Historical
    events keep the release that served them.
    """

    status: Literal["active", "paused", "completed", "archived"] | None = None
    release_id: str | None = Field(default=None, min_length=1, max_length=120)

    @field_validator("release_id")
    @classmethod
    def clean_release_id(cls, value: str | None) -> str | None:
        return value.strip() if value else None


class PlacementSubmitIn(BaseModel):
    responses: list[dict[str, Any]] = Field(min_length=0, max_length=100)
