"""What the Studio sends to add or change a Rebus Rush category."""

from __future__ import annotations

from pydantic import Field, field_validator

from app.models.common import Model
from app.repos.rebus_categories import ID_PATTERN, MAX_NAME, TONES
from app.topics import TOPICS


def _clean_names(value: dict[str, str]) -> dict[str, str]:
    names = {lang: str(text).strip() for lang, text in value.items() if lang in ("en", "km") and str(text).strip()}
    if "en" not in names:
        raise ValueError("Give the category an English name; it is what every other language falls back to.")
    if any(len(text) > MAX_NAME for text in names.values()):
        raise ValueError(f"A name is at most {MAX_NAME} characters.")
    return names


class CategoryIn(Model):
    id: str
    names: dict[str, str]
    tone: str = "indigo"
    topic: str = "logic"

    @field_validator("id")
    @classmethod
    def _id(cls, value: str) -> str:
        if not ID_PATTERN.fullmatch(value):
            raise ValueError("The id is 2 to 24 lowercase letters, numbers or dashes, starting with a letter.")
        return value

    @field_validator("names")
    @classmethod
    def _names(cls, value: dict[str, str]) -> dict[str, str]:
        return _clean_names(value)

    @field_validator("tone")
    @classmethod
    def _tone(cls, value: str) -> str:
        if value not in TONES:
            raise ValueError(f"Pick a colour from: {', '.join(TONES)}.")
        return value

    @field_validator("topic")
    @classmethod
    def _topic(cls, value: str) -> str:
        if value not in TOPICS:
            raise ValueError("Pick one of Koda's topics.")
        return value


class CategoryPatch(Model):
    names: dict[str, str] | None = None
    tone: str | None = None
    topic: str | None = None
    enabled: bool | None = None

    @field_validator("names")
    @classmethod
    def _names(cls, value: dict[str, str] | None) -> dict[str, str] | None:
        return None if value is None else _clean_names(value)

    @field_validator("tone")
    @classmethod
    def _tone(cls, value: str | None) -> str | None:
        if value is not None and value not in TONES:
            raise ValueError(f"Pick a colour from: {', '.join(TONES)}.")
        return value

    @field_validator("topic")
    @classmethod
    def _topic(cls, value: str | None) -> str | None:
        if value is not None and value not in TOPICS:
            raise ValueError("Pick one of Koda's topics.")
        return value


class ReorderIn(Model):
    order: list[str] = Field(min_length=1, max_length=100)
