"""The deploy-wide SVG library stored in MongoDB."""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def list_all(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.art_assets.find({"deletedAt": None}).sort("id", 1)
    return await cursor.to_list(length=5000)


async def get(db: AsyncIOMotorDatabase, asset_id: str) -> dict[str, Any] | None:
    return await db.art_assets.find_one({"id": asset_id, "deletedAt": None})


async def put(
    db: AsyncIOMotorDatabase, asset_id: str, category: str, markup: str, updated_by: str | None
) -> tuple[dict[str, Any], bool, bool]:
    existing = await db.art_assets.find_one({"id": asset_id})
    created = existing is None or existing.get("deletedAt") is not None
    moved = bool(existing and existing.get("category") != category)
    timestamp = now()
    await db.art_assets.update_one(
        {"id": asset_id},
        {
            "$set": {
                "category": category,
                "markup": markup,
                "updatedAt": timestamp,
                "updatedBy": updated_by,
                "deletedAt": None,
            },
            "$setOnInsert": {"id": asset_id, "createdAt": timestamp},
            "$inc": {"rev": 1},
        },
        upsert=True,
    )
    row = await db.art_assets.find_one({"id": asset_id})
    assert row is not None
    return row, created, moved


async def move(
    db: AsyncIOMotorDatabase,
    asset_id: str,
    to_id: str,
    category: str,
    updated_by: str | None,
) -> dict[str, Any] | None:
    existing = await get(db, asset_id)
    if existing is None:
        return None

    timestamp = now()
    if to_id == asset_id:
        await db.art_assets.update_one(
            {"id": asset_id, "deletedAt": None},
            {
                "$set": {"category": category, "updatedAt": timestamp, "updatedBy": updated_by},
                "$inc": {"rev": 1},
            },
        )
        return await get(db, asset_id)

    # Keep a tombstone at the old id so startup seeding never resurrects a
    # renamed bundled asset. The new row carries the same markup and a fresh id.
    await db.art_assets.update_one(
        {"id": asset_id},
        {
            "$set": {"deletedAt": timestamp, "updatedAt": timestamp, "updatedBy": updated_by},
            "$inc": {"rev": 1},
        },
    )
    await db.art_assets.update_one(
        {"id": to_id},
        {
            "$set": {
                "category": category,
                "markup": existing["markup"],
                "updatedAt": timestamp,
                "updatedBy": updated_by,
                "deletedAt": None,
            },
            "$setOnInsert": {"id": to_id, "createdAt": timestamp},
            "$inc": {"rev": 1},
        },
        upsert=True,
    )
    return await get(db, to_id)


async def delete(db: AsyncIOMotorDatabase, asset_id: str, updated_by: str | None) -> bool:
    timestamp = now()
    result = await db.art_assets.update_one(
        {"id": asset_id, "deletedAt": None},
        {
            "$set": {"deletedAt": timestamp, "updatedAt": timestamp, "updatedBy": updated_by},
            "$inc": {"rev": 1},
        },
    )
    return result.modified_count > 0


async def seed_default(db: AsyncIOMotorDatabase, asset: dict[str, Any]) -> bool:
    """Create a bundled asset once; edits and tombstones always survive restarts."""
    timestamp = now()
    result = await db.art_assets.update_one(
        {"id": asset["id"]},
        {
            "$setOnInsert": {
                **asset,
                "rev": 1,
                "createdAt": timestamp,
                "updatedAt": timestamp,
                "updatedBy": "seed",
                "deletedAt": None,
            }
        },
        upsert=True,
    )
    return result.upserted_id is not None
