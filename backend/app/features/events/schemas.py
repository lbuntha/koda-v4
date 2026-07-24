"""Request models for the events feature."""

from typing import Any

from typing import Literal

from pydantic import BaseModel, Field


class EventsIn(BaseModel):
    events: list[dict[str, Any]] = Field(min_length=1, max_length=100)


class RecommendationSkipEventIn(BaseModel):
    recommendation_run_id: str = Field(min_length=1, max_length=120)
    skill_id: str = Field(min_length=1, max_length=120)
    source: Literal["recommendation"] = Field(default="recommendation", alias="from")
