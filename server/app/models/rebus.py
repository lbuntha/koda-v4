"""Rebus Rush's owner settings, validated.

Mirrors `src/rebus/settings.ts`. The client clamps whatever it receives, so a
stale value can never break a game; the server is stricter and refuses a value
outside the range at the door, so an operator is told when a number is not
allowed instead of having it quietly changed.
"""
from typing import Literal

from pydantic import Field, field_validator

from app.models.common import Model


class RebusSettings(Model):
    #: Seconds before a hint unlocks, and again between hints.
    hintDelaySec: int = Field(default=15, ge=3, le=60)
    #: Seconds a puzzle lasts before the answer is shown and nobody scores.
    puzzleLimitSec: int = Field(default=60, ge=30, le=120)
    #: How many hints a puzzle offers: 1 category, 2 letters, 3 the pictures' names.
    hintRungs: int = Field(default=3, ge=1, le=3)
    #: Most players in one group room.
    maxPlayers: int = Field(default=4, ge=2, le=6)
    #: Whether someone without a Koda account may join a room. Off: only signed-in players.
    guestsAllowed: bool = True
    #: "free" lets the child pick the Machine's level; 0 easy, 1 medium, 2 hard fixes it.
    machineLock: Literal["free", 0, 1, 2] = "free"
    #: Letter tiles instead of a keyboard, for the youngest.
    letterTiles: bool = False
    #: How many puzzles a round can have.
    questionChoices: list[int] = Field(default_factory=lambda: [5, 7, 10], min_length=1, max_length=6)
    #: Points for a win with no hints: what a child and the Machine race for inside a round.
    pointsPerPuzzle: int = Field(default=3, ge=1, le=10)
    #: Taken off a win for each hint used (a win is never worth less than 1).
    hintCost: int = Field(default=1, ge=0, le=5)
    #: What the Machine scores for a puzzle it wins.
    machinePoints: int = Field(default=3, ge=1, le=10)
    #: XP for a perfect round, or null to follow the deployment's "XP per level"
    #: in Scoring & XP like lessons and books. Stars and shares always come from there.
    xpPerRound: int | None = Field(default=None, ge=0, le=200)

    @field_validator("pointsPerPuzzle", "hintCost", "machinePoints", "xpPerRound", mode="before")
    @classmethod
    def not_a_boolean(cls, value):
        if isinstance(value, bool):
            raise ValueError("That is a number, not a switch.")
        return value

    @field_validator("machineLock", mode="before")
    @classmethod
    def lock_is_not_a_boolean(cls, value):
        if isinstance(value, bool):
            raise ValueError("The Machine's level is free, 0, 1 or 2.")
        return value

    @field_validator("questionChoices")
    @classmethod
    def choices(cls, value: list[int]) -> list[int]:
        if any(isinstance(n, bool) or not 5 <= n <= 10 for n in value):
            raise ValueError("A round is 5 to 10 puzzles.")
        return sorted(set(value))


DEFAULT_REBUS_SETTINGS = RebusSettings()
