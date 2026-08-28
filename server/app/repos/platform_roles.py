from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now
from app.role_defaults import DEFAULT_PLATFORM_ROLES, DEFAULT_PLATFORM_ROLES_BY_ID
from app.security import policy


async def seed_default(db: AsyncIOMotorDatabase, role: dict[str, Any]) -> int:
    timestamp = now()
    result = await db.platform_roles.update_one(
        {"roleId": role["roleId"]},
        {"$setOnInsert": {**role, "createdAt": timestamp, "updatedAt": timestamp}},
        upsert=True,
    )
    return int(result.upserted_id is not None)


async def ensure_defaults(db: AsyncIOMotorDatabase) -> None:
    for role in DEFAULT_PLATFORM_ROLES:
        await seed_default(db, role)


async def all_roles(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    await ensure_defaults(db)
    rows = await db.platform_roles.find({}).sort([("builtIn", -1), ("name", 1)]).to_list(200)
    # Core roles are code-owned. Merge their current definitions so a newly
    # introduced permission reaches an existing database without overwriting
    # custom roles or relying on a destructive migration.
    return [
        {**row, **DEFAULT_PLATFORM_ROLES_BY_ID[row["roleId"]]}
        if row["roleId"] in DEFAULT_PLATFORM_ROLES_BY_ID else row
        for row in rows
    ]


async def by_id(db: AsyncIOMotorDatabase, role_id: str) -> dict[str, Any] | None:
    if role_id in DEFAULT_PLATFORM_ROLES_BY_ID:
        row = await db.platform_roles.find_one({"roleId": role_id}) or {}
        return {**row, **DEFAULT_PLATFORM_ROLES_BY_ID[role_id]}
    return await db.platform_roles.find_one({"roleId": role_id})


async def permissions_for(db: AsyncIOMotorDatabase, role_id: str) -> set[str]:
    if role_id == "none":
        return set()
    role = await by_id(db, role_id)
    if role:
        return {
            permission for permission in role.get("permissions", [])
            if permission in policy.PERMISSIONS and permission not in policy.GRANT_ONLY
        }
    # Backward-compatible while a deployment is starting its first migration.
    return set(policy.PLATFORM_PERMISSIONS.get(role_id, set())) - policy.GRANT_ONLY


async def create(
    db: AsyncIOMotorDatabase,
    role_id: str,
    name: str,
    description: str,
    permissions: list[str],
    created_by: str,
) -> dict[str, Any]:
    timestamp = now()
    row = {
        "roleId": role_id,
        "name": name,
        "description": description,
        "permissions": permissions,
        "builtIn": False,
        "createdBy": created_by,
        "createdAt": timestamp,
        "updatedAt": timestamp,
    }
    await db.platform_roles.insert_one(row)
    return row


async def update(
    db: AsyncIOMotorDatabase, role_id: str, patch: dict[str, Any]
) -> dict[str, Any] | None:
    return await db.platform_roles.find_one_and_update(
        {"roleId": role_id, "builtIn": False},
        {"$set": {**patch, "updatedAt": now()}},
        return_document=ReturnDocument.AFTER,
    )


async def delete(db: AsyncIOMotorDatabase, role_id: str) -> bool:
    result = await db.platform_roles.delete_one({"roleId": role_id, "builtIn": False})
    return result.deleted_count == 1
