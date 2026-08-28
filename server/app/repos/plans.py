"""The plan catalogue: what each plan costs and includes.

One row per plan in `DEFAULT_PLANS`, seeded create-if-absent so an operator's
edited price survives every deploy — the same bargain the menu makes.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now
from app.plan_defaults import EDITABLE_PLAN_FIELDS


async def seed_default(db: AsyncIOMotorDatabase, plan: dict[str, Any]) -> bool:
    """Create a shipped plan if it is not there. Never overwrites an edit."""
    result = await db.plans.update_one(
        {"_id": plan["planId"]},
        {"$setOnInsert": {**plan, "createdAt": now(), "updatedAt": now()}},
        upsert=True,
    )
    return result.upserted_id is not None


async def listing(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    return await db.plans.find({}).sort("order", 1).to_list(length=50)


async def by_id(db: AsyncIOMotorDatabase, plan_id: str) -> dict[str, Any] | None:
    return await db.plans.find_one({"_id": plan_id})


async def update(
    db: AsyncIOMotorDatabase, plan_id: str, patch: dict[str, Any]
) -> dict[str, Any] | None:
    """Change a plan's numbers. Anything not in `EDITABLE_PLAN_FIELDS` is ignored."""
    known = {key: value for key, value in patch.items() if key in EDITABLE_PLAN_FIELDS}
    if not known:
        return await by_id(db, plan_id)
    return await db.plans.find_one_and_update(
        {"_id": plan_id},
        {"$set": {**known, "updatedAt": now()}},
        return_document=ReturnDocument.AFTER,
    )
