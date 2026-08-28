"""Per-learner/user enrollment in published skills."""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now


async def list_for_owner(
    db: AsyncIOMotorDatabase, owner_type: str, owner_id: str
) -> list[dict[str, Any]]:
    return await db.skill_registrations.find(
        {"ownerType": owner_type, "ownerId": owner_id, "removedAt": None}
    ).sort("registeredAt", -1).to_list(length=1000)


async def register(
    db: AsyncIOMotorDatabase,
    *,
    owner_type: str,
    owner_id: str,
    family_id: str | None,
    skill_id: str,
) -> dict[str, Any]:
    timestamp = now()
    return await db.skill_registrations.find_one_and_update(
        {"ownerType": owner_type, "ownerId": owner_id, "skillId": skill_id},
        {
            "$set": {
                "familyId": family_id,
                "removedAt": None,
                "updatedAt": timestamp,
            },
            # Re-registering restores the original enrollment time only after
            # an explicit removal; the branch below handles that case.
            "$setOnInsert": {
                "ownerType": owner_type,
                "ownerId": owner_id,
                "skillId": skill_id,
                "registeredAt": timestamp,
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


async def refresh_registration_time(
    db: AsyncIOMotorDatabase, owner_type: str, owner_id: str, skill_id: str
) -> dict[str, Any] | None:
    """Put a restored registration at the top of the user's LIFO list."""
    timestamp = now()
    return await db.skill_registrations.find_one_and_update(
        {"ownerType": owner_type, "ownerId": owner_id, "skillId": skill_id},
        {"$set": {"registeredAt": timestamp, "updatedAt": timestamp, "removedAt": None}},
        return_document=ReturnDocument.AFTER,
    )


async def remove(
    db: AsyncIOMotorDatabase, owner_type: str, owner_id: str, skill_id: str
) -> bool:
    result = await db.skill_registrations.update_one(
        {
            "ownerType": owner_type,
            "ownerId": owner_id,
            "skillId": skill_id,
            "removedAt": None,
        },
        {"$set": {"removedAt": now(), "updatedAt": now()}},
    )
    return result.modified_count > 0


async def get(
    db: AsyncIOMotorDatabase, owner_type: str, owner_id: str, skill_id: str
) -> dict[str, Any] | None:
    return await db.skill_registrations.find_one(
        {"ownerType": owner_type, "ownerId": owner_id, "skillId": skill_id}
    )
