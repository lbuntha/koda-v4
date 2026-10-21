"""What a client may send to a Rebus Rush group room."""

from typing import Literal

from pydantic import Field

from app.models.common import Model


class RoomCreateIn(Model):
    category: str = Field(min_length=2, max_length=24)
    count: int = Field(default=5, ge=3, le=10)
    #: Only puzzles of this difficulty (1 easy to 3 hard), or any.
    difficulty: Literal[1, 2, 3] | None = None
    name: str = Field(min_length=2, max_length=30)
    avatar: str = Field(min_length=2, max_length=20)
    #: The host's language: in Khmer, only puzzles that can be played in Khmer are dealt.
    language: Literal["en", "km"] = "en"


class RoomJoinIn(Model):
    name: str = Field(min_length=2, max_length=30)
    avatar: str = Field(min_length=2, max_length=20)


class SolveIn(Model):
    #: Which puzzle the player says they solved; a claim for one that is over is refused.
    index: int = Field(ge=0, le=50)
    #: How many hints the player took, which lowers the points (never below 1).
    hints: int = Field(default=0, ge=0, le=3)


class LockIn(Model):
    locked: bool


class KickIn(Model):
    pid: str = Field(min_length=2, max_length=20)


class AnswerIn(Model):
    """The host's answer to someone at the door."""

    pid: str = Field(min_length=2, max_length=20)
