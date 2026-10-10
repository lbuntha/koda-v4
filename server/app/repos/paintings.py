"""Children's finished paintings: one row per child per picture.

The PNG itself is in `painting_store` (a folder, or the cloud bucket); the row
holds whose it is, which picture, how it went, and the file's id. A newer
painting of the same picture replaces the row; the file it pointed at is
deleted when nothing else names it.
"""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

FIELDS = {"_id": 0}


async def save(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, item_id: str, fields: dict[str, Any]
) -> tuple[dict[str, Any], str | None]:
    """Keep this painting; returns the row and the file id it replaced (if any)."""
    key = {"familyId": family_id, "learnerId": learner_id, "itemId": item_id}
    old = await db.trace_paintings.find_one(key, {"imageId": 1})
    row = {**key, **fields, "updatedAt": now()}
    await db.trace_paintings.update_one(key, {"$set": row}, upsert=True)
    replaced = old.get("imageId") if old and old.get("imageId") != fields.get("imageId") else None
    return row, replaced


async def for_learner(db: AsyncIOMotorDatabase, family_id: str, learner_id: str, limit: int = 200) -> list[dict[str, Any]]:
    cursor = db.trace_paintings.find({"familyId": family_id, "learnerId": learner_id}, FIELDS).sort("paintedAt", -1).limit(limit)
    return await cursor.to_list(length=limit)


async def get(db: AsyncIOMotorDatabase, family_id: str, learner_id: str, item_id: str) -> dict[str, Any] | None:
    return await db.trace_paintings.find_one({"familyId": family_id, "learnerId": learner_id, "itemId": item_id}, FIELDS)


async def remove(db: AsyncIOMotorDatabase, family_id: str, learner_id: str, item_id: str) -> str | None:
    """Forget a painting; returns its file id when no other row names the file."""
    row = await db.trace_paintings.find_one_and_delete({"familyId": family_id, "learnerId": learner_id, "itemId": item_id})
    if not row:
        return None
    return row["imageId"] if not await image_in_use(db, row["imageId"]) else None


async def image_in_use(db: AsyncIOMotorDatabase, image_id: str) -> bool:
    return await db.trace_paintings.count_documents({"imageId": image_id}, limit=1) > 0
