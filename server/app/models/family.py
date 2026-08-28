"""Family-side documents: the family, who belongs to it, and their devices."""

from datetime import datetime

from pydantic import Field

from app.models.common import Model


class Family(Model):
    id: str
    name: str
    owner_id: str = Field(alias="ownerId")
    created_at: datetime = Field(alias="createdAt")


class Membership(Model):
    user_id: str = Field(alias="userId")
    family_id: str = Field(alias="familyId")
    role: str
    created_at: datetime = Field(alias="createdAt")


class Device(Model):
    id: str
    family_id: str = Field(alias="familyId")
    name: str
    kind: str
    user_id: str | None = Field(default=None, alias="userId")
    learner_id: str | None = Field(default=None, alias="learnerId")
    last_seen_at: datetime | None = Field(default=None, alias="lastSeenAt")
    revoked_at: datetime | None = Field(default=None, alias="revokedAt")
