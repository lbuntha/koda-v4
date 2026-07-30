"""Request/response models for the family feature."""

from datetime import datetime

from pydantic import BaseModel, Field


class ChildIn(BaseModel):
    name: str
    avatar: str | None = None
    grade_level: str | None = "grade_1"
    primary_subject: str | None = "math"
    pin: str | None = Field(default=None, min_length=4, max_length=8)


class ChildUpdate(BaseModel):
    name: str | None = None
    avatar: str | None = None
    grade_level: str | None = None
    primary_subject: str | None = None
    pin: str | None = Field(default=None, min_length=4, max_length=8)


class ChildOut(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    grade_level: str | None = "grade_1"
    primary_subject: str | None = "math"
    has_pin: bool
    #: Set while too many wrong PINs have locked this child out. The lock expires on its own;
    #: without surfacing it here the child simply cannot sign in and no adult is told why.
    pin_locked_until: datetime | None = None
