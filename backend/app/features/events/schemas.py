"""Request models for the events feature."""

from typing import Any

from pydantic import BaseModel, Field


class EventsIn(BaseModel):
    events: list[dict[str, Any]] = Field(min_length=1, max_length=100)
