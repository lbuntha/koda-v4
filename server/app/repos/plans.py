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
    """Create a shipped plan if it is not there, and carry a new feature onto it.

    `$setOnInsert` alone is how a paying family loses something they bought.
    `course.premium` was added to the Family plan in code long after the first
    rows were written, so every deployment seeded before that day went on
    selling Family without it: the plan screen promised every lesson and the
    padlock on lesson eleven said otherwise.

    Adding anything the shipped list has grown would fight the operator who
    deliberately dropped a feature, so `knownFeatures` records what this row has
    already been offered. A feature arrives exactly once; removing it afterwards
    is a decision, and it stays removed.

    Returns whether the plan was created, which is what the startup log counts.
    """
    seeded = {**plan, "knownFeatures": list(plan.get("features") or [])}
    result = await db.plans.update_one(
        {"_id": plan["planId"]},
        {"$setOnInsert": {**seeded, "createdAt": now(), "updatedAt": now()}},
        upsert=True,
    )
    if result.upserted_id is not None:
        return True

    row = await db.plans.find_one({"_id": plan["planId"]}) or {}
    known = set(row.get("knownFeatures") or [])
    fresh = [feature for feature in plan.get("features") or [] if feature not in known]
    if fresh:
        await db.plans.update_one(
            {"_id": plan["planId"]},
            {
                "$addToSet": {"features": {"$each": fresh}, "knownFeatures": {"$each": fresh}},
                "$set": {"updatedAt": now()},
            },
        )
    return False


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
