"""Editable SVG mascot documents owned by an authoring account."""

from datetime import datetime, timezone
from typing import Any

from beanie import Document
from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Mascot(Document):
    owner_id: str
    mascot_id: str
    purpose: str = "custom"
    name: str
    slug: str
    document: dict[str, Any]
    starter_version: int = 0
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)

    class Settings:
        name = "mascots"
        indexes = [
            IndexModel([("owner_id", ASCENDING), ("mascot_id", ASCENDING)], unique=True),
            IndexModel([("owner_id", ASCENDING), ("updated_at", DESCENDING)]),
            IndexModel([("owner_id", ASCENDING), ("purpose", ASCENDING)]),
        ]
