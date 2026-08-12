"""Reusable mascot style templates owned by an authoring account."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class MascotStyle(Document):
    owner_id: str
    style_id: str
    name: str
    document: dict[str, Any]
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "mascot_styles"
        indexes = [
            IndexModel([("owner_id", ASCENDING), ("style_id", ASCENDING)], unique=True),
            IndexModel([("owner_id", ASCENDING), ("updated_at", DESCENDING)]),
        ]
