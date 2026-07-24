from typing import Literal

from pydantic import BaseModel, Field


class SessionStartIn(BaseModel):
    source: Literal["independent", "parent_launch"] = "independent"


class SessionEndIn(BaseModel):
    session_id: str = Field(min_length=1, max_length=120)


class RecommendationSkipIn(BaseModel):
    assignment_id: str = Field(min_length=1, max_length=120)
    skill_id: str = Field(min_length=1, max_length=120)
