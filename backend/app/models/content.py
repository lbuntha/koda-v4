"""Authored content, owned per adult account: the curriculum tree and the
question deck. Stored as whole documents to mirror how the frontend keeps them
(one CurriculumTree / one questions array), making the localStorage->API swap 1:1."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Curriculum(Document):
    owner_id: str
    tree: dict[str, Any]
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "curriculum"
        indexes = [IndexModel("owner_id", unique=True)]


class QuestionDeck(Document):
    owner_id: str
    questions: list[dict[str, Any]] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "question_decks"
        indexes = [IndexModel("owner_id", unique=True)]
