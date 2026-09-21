"""Privacy choices for buddies-only and public leaderboards.

No score or buddy is part of this model. Phase 1 owns one question only:
which audience a learner has explicitly agreed may see the small leaderboard
identity. Missing state always means private.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.models.common import Model

LeaderboardVisibility = Literal["private", "buddies", "public"]


class LeaderboardPrivacyIn(Model):
    # A true legacy value always means buddies-only. Public must be named and
    # confirmed explicitly, so an old client can never broaden the audience.
    sharing_enabled: bool | None = Field(default=None, alias="sharingEnabled")
    visibility: LeaderboardVisibility | None = None
    nickname: str | None = Field(default=None, min_length=2, max_length=24)
    confirmed: bool = False
    public_confirmed: bool = Field(default=False, alias="publicConfirmed")

    @field_validator("nickname")
    @classmethod
    def safe_nickname(cls, value: str | None) -> str | None:
        if value is None:
            return None
        nickname = " ".join(value.split())
        if "@" in nickname:
            raise ValueError("A leaderboard nickname cannot be an email address.")
        if any(ord(char) < 32 for char in nickname):
            raise ValueError("A leaderboard nickname cannot contain control characters.")
        if len(nickname) < 2:
            raise ValueError("A leaderboard nickname must contain at least two characters.")
        return nickname

    @model_validator(mode="after")
    def explicit_opt_in(self):
        if self.visibility is None:
            self.visibility = "buddies" if self.sharing_enabled else "private"
        enabled = self.visibility != "private"
        if self.sharing_enabled is False and enabled:
            raise ValueError("Private sharing cannot name a wider visibility.")
        if enabled and not self.confirmed:
            raise ValueError("Confirm sharing before enabling the leaderboard.")
        if enabled and not self.nickname:
            raise ValueError("Choose a leaderboard nickname before sharing.")
        if self.visibility == "public" and not self.public_confirmed:
            raise ValueError("Confirm the public audience before joining the public leaderboard.")
        self.sharing_enabled = enabled
        return self


class LeaderboardPrivacyOut(Model):
    learner_id: str = Field(alias="learnerId")
    sharing_enabled: bool = Field(alias="sharingEnabled")
    visibility: LeaderboardVisibility = "private"
    nickname: str | None = None
    consented_at: str | None = Field(default=None, alias="consentedAt")
    revoked_at: str | None = Field(default=None, alias="revokedAt")


class BuddyAcceptIn(Model):
    learner_id: str = Field(min_length=3, max_length=80, alias="learnerId")
    code: str = Field(
        min_length=11,
        max_length=11,
        pattern=r"(?i)^KODA-[A-HJ-NP-Z2-9]{6}$",
    )


class BuddyInviteOut(Model):
    id: str
    expires_at: str = Field(alias="expiresAt")
    # Returned only once, when generated. Stored invitations contain its hash.
    code: str | None = None


class BuddyOut(Model):
    relationship_id: str = Field(alias="relationshipId")
    nickname: str | None = None
    avatar_seed: str | None = Field(default=None, alias="avatarSeed")
    sharing_enabled: bool = Field(alias="sharingEnabled")
    connected_at: str = Field(alias="connectedAt")


class BuddiesOut(Model):
    buddies: list[BuddyOut]


class LeaderboardRow(Model):
    rank: int = Field(ge=1)
    is_you: bool = Field(alias="isYou")
    nickname: str
    avatar_seed: str | None = Field(default=None, alias="avatarSeed")
    weekly_xp: int = Field(ge=0, alias="weeklyXp")


class LeaderboardOut(Model):
    scope: Literal["buddies", "public"] = "buddies"
    sharing_enabled: bool = Field(alias="sharingEnabled")
    week_start: date = Field(alias="weekStart")
    week_end: date = Field(alias="weekEnd")
    generated_at: datetime = Field(alias="generatedAt")
    rows: list[LeaderboardRow]
