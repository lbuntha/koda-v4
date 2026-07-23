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
    scope: ScopeIn = Field(default_factory=ScopeIn)
    mode: Literal["scheduled", "self_paced"] = "scheduled"
    schedule: dict[str, Any] | None = None
    priority: int = Field(default=100, ge=0, le=1000)
    placement_required: bool = True

    @field_validator("student_id", "curriculum_id", "release_id", "grade_id")
    @classmethod
    def clean_ids(cls, value: str) -> str:
        return value.strip()


class AssignmentStatusIn(BaseModel):
    status: Literal["active", "paused", "completed", "archived"]


class PlacementSubmitIn(BaseModel):
    responses: list[dict[str, Any]] = Field(min_length=0, max_length=100)
