"""Request models for the content feature."""

from typing import Any

from pydantic import BaseModel


class CurriculumIn(BaseModel):
    tree: dict[str, Any]


class QuestionsIn(BaseModel):
    questions: list[dict[str, Any]]
