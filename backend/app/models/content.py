"""Authored content owned per adult account: curriculum, question deck, and
SVG library. Whole documents mirror the frontend state and keep persistence
boundaries simple for editors and reusable components."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Curriculum(Document):
    curriculum_id: str | None = None
    owner_id: str
    tree: dict[str, Any]
    revision: int = 0
    published: bool = False
    archived_at: datetime | None = None
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "curriculum"
        indexes = [
            IndexModel("curriculum_id", unique=True),
            IndexModel([("owner_id", 1), ("updated_at", -1)]),
        ]


class QuestionDeck(Document):
    owner_id: str
    questions: list[dict[str, Any]] = Field(default_factory=list)
    revision: int = 0
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "question_decks"
        indexes = [IndexModel("owner_id", unique=True)]


class SvgLibrary(Document):
    """Custom SVG assets and built-in overrides owned by one adult account."""

    owner_id: str
    assets: list[dict[str, Any]] = Field(default_factory=list)
    overrides: dict[str, dict[str, Any]] = Field(default_factory=dict)
    revision: int = 0
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "svg_libraries"
        indexes = [IndexModel("owner_id", unique=True)]


class SystemSettings(Document):
    key: str = "global"
    sound_enabled: bool = True
    ai_model: str = "gpt-4o-mini"
    openai_api_key_encrypted: str | None = None
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "system_settings"
        indexes = [IndexModel("key", unique=True)]
