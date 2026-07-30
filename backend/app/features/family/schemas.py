"""Request/response models for the family feature."""

from datetime import datetime

from pydantic import BaseModel, Field


class ChildIn(BaseModel):
    name: str
    avatar: str | None = None
    grade_level: str | None = "grade_1"
    primary_subject: str | None = "math"
    profile_gender: str | None = Field(default=None, pattern="^(boy|girl)$")
    learning_goals: list[str] = Field(default_factory=list, max_length=12)
    placement_required: bool = True
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    pin: str | None = Field(default=None, min_length=4, max_length=8)


class ChildUpdate(BaseModel):
    name: str | None = None
    avatar: str | None = None
    grade_level: str | None = None
    primary_subject: str | None = None
    profile_gender: str | None = Field(default=None, pattern="^(boy|girl)$")
    learning_goals: list[str] | None = Field(default=None, max_length=12)
    birth_year: int | None = Field(default=None, ge=1900, le=2100)
    pin: str | None = Field(default=None, min_length=4, max_length=8)


class ChildOut(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    grade_level: str | None = "grade_1"
    primary_subject: str | None = "math"
    profile_gender: str | None = None
    learning_goals: list[str] = Field(default_factory=list)
    birth_year: int | None = None
    has_pin: bool
    #: Set while too many wrong PINs have locked this child out. The lock expires on its own;
    #: without surfacing it here the child simply cannot sign in and no adult is told why.
    pin_locked_until: datetime | None = None
