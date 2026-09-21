"""Atomic storage for a learner's leaderboard consent.

The row is private configuration, even when its decision is Public. Projection
routes expose only the small approved identity and must honor the exact stored
audience; a legacy opt-in is always interpreted as Buddies only.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now


async def get(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str
) -> dict[str, Any] | None:
    return await db.leaderboard_privacy.find_one(
        {"_id": learner_id, "familyId": family_id}
    )


async def set_sharing(
    db: AsyncIOMotorDatabase,
    *,
    family_id: str,
    learner_id: str,
    visibility: str,
    nickname: str | None,
    actor_id: str,
    actor_role: str,
) -> dict[str, Any]:
    """Change consent and keep the evidence in the same atomic document."""
    at = now()
    enabled = visibility != "private"
    action = "enabled" if enabled else "disabled"
    event = {
        "action": action,
        "at": at,
        "actorId": actor_id,
        "actorRole": actor_role,
        "visibility": visibility,
    }
    if enabled:
        event["nickname"] = nickname

    values: dict[str, Any] = {
        "familyId": family_id,
        "learnerId": learner_id,
        "sharingEnabled": enabled,
        "visibility": visibility,
        "updatedAt": at,
    }
    if enabled:
        values.update(
            {
                "nickname": nickname,
                "consentedAt": at,
                "consentedBy": actor_id,
                "revokedAt": None,
            }
        )
    else:
        # Keep the chosen nickname private so opting back in does not force a
        # child to remember it. It is never returned by a leaderboard query
        # while `sharingEnabled` is false.
        values["revokedAt"] = at

    return await db.leaderboard_privacy.find_one_and_update(
        {"_id": learner_id, "familyId": family_id},
        {
            "$set": values,
            "$setOnInsert": {"createdAt": at},
            # Consent is rare, but cap the audit trail so a malicious toggle
            # loop cannot grow one document without bound.
            "$push": {"consentHistory": {"$each": [event], "$slice": -100}},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


def visibility_of(row: dict[str, Any] | None) -> str:
    """Interpret pre-audience consent rows as buddies-only, never public."""
    if not row or row.get("sharingEnabled") is not True:
        return "private"
    return "public" if row.get("visibility") == "public" else "buddies"


async def public_rows(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    """Every explicitly public profile; legacy opt-ins are deliberately absent."""
    return await db.leaderboard_privacy.find(
        {"sharingEnabled": True, "visibility": "public"},
        {"familyId": 1, "learnerId": 1, "nickname": 1},
    ).to_list(length=None)


async def remove(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> None:
    await db.leaderboard_privacy.delete_one(
        {"_id": learner_id, "familyId": family_id}
    )
