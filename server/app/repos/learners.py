"""Family-scoped child profiles and one-time device join codes."""

from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now


async def create(
    db: AsyncIOMotorDatabase,
    family_id: str,
    display_name: str,
    birth_year: int | None = None,
) -> dict[str, Any]:
    row = {
        "_id": f"l_{uuid4().hex[:20]}",
        "familyId": family_id,
        "displayName": display_name.strip(),
        "avatarSeed": f"a_{uuid4().hex[:20]}",
        "birthYear": birth_year,
        "createdAt": now(),
        "updatedAt": now(),
    }
    await db.learners.insert_one(row)
    return row


async def ensure_avatar_seed(
    db: AsyncIOMotorDatabase, learner_id: str, family_id: str
) -> str:
    """Backfill one stable, opaque DiceBear seed for older child profiles."""
    seed = f"a_{uuid4().hex[:20]}"
    row = await db.learners.find_one_and_update(
        {
            "_id": learner_id,
            "familyId": family_id,
            "$or": [
                {"avatarSeed": {"$exists": False}},
                {"avatarSeed": None},
                {"avatarSeed": ""},
            ],
        },
        {"$set": {"avatarSeed": seed, "updatedAt": now()}},
        return_document=ReturnDocument.AFTER,
    )
    if row:
        return row["avatarSeed"]
    existing = await by_id(db, learner_id, family_id)
    return existing.get("avatarSeed", seed) if existing else seed


async def by_id(db: AsyncIOMotorDatabase, learner_id: str, family_id: str) -> dict[str, Any] | None:
    return await db.learners.find_one({"_id": learner_id, "familyId": family_id})


async def for_family(db: AsyncIOMotorDatabase, family_id: str) -> list[dict[str, Any]]:
    return await db.learners.find({"familyId": family_id}).sort("createdAt", 1).to_list(length=100)


async def update(
    db: AsyncIOMotorDatabase,
    learner_id: str,
    family_id: str,
    patch: dict[str, Any],
) -> dict[str, Any] | None:
    return await db.learners.find_one_and_update(
        {"_id": learner_id, "familyId": family_id},
        {"$set": {**patch, "updatedAt": now()}},
        return_document=ReturnDocument.AFTER,
    )


async def remove(db: AsyncIOMotorDatabase, learner_id: str, family_id: str) -> bool:
    result = await db.learners.delete_one({"_id": learner_id, "familyId": family_id})
    if result.deleted_count:
        await db.skill_registrations.delete_many(
            {"ownerType": "learner", "ownerId": learner_id}
        )
    return result.deleted_count == 1


async def issue_code(
    db: AsyncIOMotorDatabase,
    learner_id: str,
    family_id: str,
    code_hash: str,
    expires_at,
) -> dict[str, Any] | None:
    return await db.learners.find_one_and_update(
        {"_id": learner_id, "familyId": family_id},
        {
            "$set": {
                "joinCodeHash": code_hash,
                "joinCodeExpiresAt": expires_at,
                "updatedAt": now(),
            }
        },
        return_document=ReturnDocument.AFTER,
    )


async def claim_code(db: AsyncIOMotorDatabase, code_hash: str, at) -> dict[str, Any] | None:
    """Atomically consume a valid code so two tablets cannot claim it."""
    return await db.learners.find_one_and_update(
        {"joinCodeHash": code_hash, "joinCodeExpiresAt": {"$gt": at}},
        {"$unset": {"joinCodeHash": "", "joinCodeExpiresAt": ""}},
        return_document=ReturnDocument.BEFORE,
    )
