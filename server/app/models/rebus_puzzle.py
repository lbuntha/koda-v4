"""Rebus puzzles on the wire: what the Studio sends, and what a device is given."""
from __future__ import annotations

from typing import Annotated, Literal

from pydantic import Field

from app.models.common import Model


class IconPiece(Model):
    kind: Literal["icon"]
    id: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=40)
    scale: Literal["big", "small"] | None = None


class PhotoPiece(Model):
    """A photo an author uploaded (kept with the library's photos), drawn like a picture."""

    kind: Literal["photo"]
    #: `photo-` and the SHA-256 of the stored bytes, which is also its address.
    id: str = Field(pattern=r"^photo-[0-9a-f]{64}$")
    name: str = Field(min_length=1, max_length=40)
    scale: Literal["big", "small"] | None = None


class WordPiece(Model):
    kind: Literal["word"]
    #: A rebus word is short, but a worked question is a sentence.
    text: str = Field(min_length=1, max_length=240)
    style: Literal["plain", "cut", "small", "big", "upside-down", "reversed", "spaced", "underlined", "crossed"] | None = None


class StackPiece(Model):
    kind: Literal["stack"]
    top: str = Field(min_length=1, max_length=40)
    bottom: str = Field(min_length=1, max_length=40)


class OpPiece(Model):
    kind: Literal["op"]
    op: Literal["+", "&", "-"]


Piece = Annotated[IconPiece | PhotoPiece | WordPiece | StackPiece | OpPiece, Field(discriminator="kind")]


class MathSpecIn(Model):
    """The numbers of a math question. Loose here (a draft has to be savable); `rebus_math.problem` says what is wrong."""

    a: int
    op: Literal["+", "−", "×", "÷"]
    b: int
    unknown: Literal["result", "a", "b"] = "result"


class ChoiceSpecIn(Model):
    """The answers of a multiple-choice question. Loose here; `rebus_choice.problem` says what is wrong."""

    options: list[str] = Field(max_length=8)
    correct: int = 0


class KhmerIn(Model):
    """The same question in Khmer: its pieces and its explanation. The answer, the numbers and the pictures are shared."""

    pieces: list[Piece] | None = Field(default=None, max_length=12)
    explanation: str | None = Field(default=None, max_length=300)
    #: The answer in Khmer, for a puzzle typed in either language.
    answer: str | None = Field(default=None, max_length=60)
    #: Multiple choice: the answers in Khmer, in the same order as the English ones.
    options: list[Annotated[str, Field(min_length=1, max_length=40)]] | None = Field(default=None, max_length=4)


class PuzzleIn(Model):
    """A puzzle as an author writes it. May be wrong: a draft has to be savable.

    `category`, `ages` and `difficulty` are deliberately loose here. The rules
    that decide whether a puzzle may be approved live in `rebus_verify`, so one
    list of codes tells the author what to fix instead of a refusal to save.
    """

    category: str = Field(max_length=24)
    ages: list[int] = Field(max_length=2)
    difficulty: int
    trick: Literal["compound", "sound-alike", "position", "size", "style", "add-remove"]
    #: "picture" (pieces add up to a typed answer) or "math" (numbers, with the prompt and answer worked out from them).
    kind: Literal["picture", "math", "choice", "quiz"] = "picture"
    math: MathSpecIn | None = None
    choice: ChoiceSpecIn | None = None
    km: KhmerIn | None = None
    #: Written in Khmer for Khmer players: never dealt to a child reading English.
    onlyIn: Literal["km"] | None = None
    pieces: list[Piece] = Field(default_factory=list, max_length=12)
    answer: str = Field(default="", max_length=80)
    accepts: list[Annotated[str, Field(max_length=80)]] = Field(default_factory=list, max_length=8)
    explanation: str = Field(default="", max_length=200)
    #: Where it came from. A person writes "official"; the Studio saves a model's
    #: candidates as "ai" with the checks the model's batch already ran.
    source: Literal["official", "ai"] = "official"
    checks: dict | None = None
    runId: str | None = Field(default=None, max_length=40)
    promptVersion: int | None = Field(default=None, ge=0, le=100000)
    model: str | None = Field(default=None, max_length=60)
    #: Save and approve in one step. Only takes effect when the puzzle passes every
    #: check; otherwise it is saved as a draft and the response says what is wrong.
    approve: bool = False


class PuzzlePatch(Model):
    category: str | None = Field(default=None, max_length=24)
    ages: list[int] | None = Field(default=None, max_length=2)
    difficulty: int | None = None
    trick: Literal["compound", "sound-alike", "position", "size", "style", "add-remove"] | None = None
    math: MathSpecIn | None = None
    choice: ChoiceSpecIn | None = None
    km: KhmerIn | None = None
    #: Written in Khmer for Khmer players: never dealt to a child reading English.
    onlyIn: Literal["km"] | None = None
    pieces: list[Piece] | None = Field(default=None, max_length=12)
    answer: str | None = Field(default=None, max_length=80)
    accepts: list[Annotated[str, Field(max_length=80)]] | None = Field(default=None, max_length=8)
    explanation: str | None = Field(default=None, max_length=200)


class StatusIn(Model):
    status: Literal["draft", "approved", "rejected", "retired", "published"]
    note: str = Field(default="", max_length=300)


class PublishIn(Model):
    note: str = Field(default="", max_length=300)


class ApproveAllIn(Model):
    #: Only drafts in this category; all of them when absent.
    category: str | None = Field(default=None, max_length=24)


class PromptIn(Model):
    text: str = Field(min_length=20, max_length=8000)
