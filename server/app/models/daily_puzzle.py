"""Daily puzzles on the wire: what the Puzzle Studio sends."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.models.common import Model

Lang = Literal["km", "en"]
#: A drawing (`rebus-cat`), any Art library id (`kit-sun`), or an uploaded photo (`photo-<sha256>`); "" for none.
PICTURE = r"^([a-z0-9][a-z0-9-]{0,79})?$"
Category = Literal["animal", "food", "home", "nature", "body", "travel", "school", "family", "colour", "number", "time", "action"]


class Clue(Model):
    km: str = Field(default="", max_length=120)
    en: str = Field(default="", max_length=120)


class WordGuessIn(Model):
    lang: Lang
    word: str = Field(min_length=1, max_length=40)
    category: Category
    clue: Clue = Field(default_factory=Clue)
    picture: str = Field(default="", max_length=80, pattern=PICTURE)


class WordGuessPatch(Model):
    word: str | None = Field(default=None, min_length=1, max_length=40)
    category: Category | None = None
    clue: Clue | None = None
    picture: str | None = Field(default=None, max_length=80, pattern=PICTURE)


class StatusIn(Model):
    status: Literal["draft", "review", "published", "retired"]
    note: str = Field(default="", max_length=240)


class CalendarIn(Model):
    #: None takes the day back to "Koda picks".
    puzzle_id: str | None = Field(default=None, alias="puzzleId", max_length=64)
