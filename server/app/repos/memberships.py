from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def add(db: AsyncIOMotorDatabase, user_id: str, family_id: str, role: str) -> dict[str, Any]:
    doc = {
        "userId": user_id,
        "familyId": family_id,
        "role": role,
        # Exceptions to the role, both empty for almost everybody.
        "extraPermissions": [],
        "deniedPermissions": [],
        "createdAt": now(),
    }
    await db.memberships.insert_one(doc)
    return doc


async def for_user(db: AsyncIOMotorDatabase, user_id: str) -> list[dict[str, Any]]:
    return await db.memberships.find({"userId": user_id}).to_list(length=20)


async def role_in(db: AsyncIOMotorDatabase, user_id: str, family_id: str) -> str | None:
    doc = await db.memberships.find_one({"userId": user_id, "familyId": family_id})
    return doc["role"] if doc else None


async def for_family(db: AsyncIOMotorDatabase, family_id: str) -> list[dict[str, Any]]:
    cursor = db.memberships.find({"familyId": family_id}).sort("createdAt", 1)
    return await cursor.to_list(length=50)


async def set_role(db: AsyncIOMotorDatabase, user_id: str, family_id: str, role: str) -> None:
    await db.memberships.update_one(
        {"userId": user_id, "familyId": family_id}, {"$set": {"role": role}}
    )


async def get(db: AsyncIOMotorDatabase, user_id: str, family_id: str) -> dict[str, Any] | None:
    return await db.memberships.find_one({"userId": user_id, "familyId": family_id})


async def set_rights(
    db: AsyncIOMotorDatabase,
    user_id: str,
    family_id: str,
    extra: list[str],
    denied: list[str],
) -> None:
    await db.memberships.update_one(
        {"userId": user_id, "familyId": family_id},
        {"$set": {"extraPermissions": extra, "deniedPermissions": denied}},
    )


async def remove(db: AsyncIOMotorDatabase, user_id: str, family_id: str) -> bool:
    result = await db.memberships.delete_one({"userId": user_id, "familyId": family_id})
    return result.deleted_count > 0
