"""Request/response models for the family feature."""

from pydantic import BaseModel, Field


class ChildIn(BaseModel):
    name: str
    avatar: str | None = None
    pin: str | None = Field(default=None, min_length=4, max_length=8)


class ChildOut(BaseModel):
    id: str
    name: str
    avatar: str | None = None
    has_pin: bool
