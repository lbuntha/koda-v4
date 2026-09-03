"""The words a notification uses, when an operator has changed them.

Overrides only. `push_defaults.py` holds what every kind says out of the box,
and a row exists here solely because somebody edited one — which makes "reset
to default" a delete rather than a second copy of the shipped wording, and
means a release that improves the default copy reaches every deployment that
never touched it.

The same split the switchboard makes, for the same reason: the code says what a
thing *is*, the database holds the decisions somebody made about it.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def overrides(db: AsyncIOMotorDatabase) -> dict[str, dict[str, Any]]:
    rows = await db.push_templates.find({}).to_list(length=100)
    return {row["_id"]: row for row in rows}


async def get(db: AsyncIOMotorDatabase, kind: str) -> dict[str, Any] | None:
    return await db.push_templates.find_one({"_id": kind})


async def set_wording(
    db: AsyncIOMotorDatabase, kind: str, *, title: str, body: str, updated_by: str | None
) -> None:
    await db.push_templates.update_one(
        {"_id": kind},
        {"$set": {"title": title, "body": body, "updatedAt": now(), "updatedBy": updated_by}},
        upsert=True,
    )


async def reset(db: AsyncIOMotorDatabase, kind: str) -> bool:
    """Back to what the code ships. Deleting the row *is* the reset."""
    result = await db.push_templates.delete_one({"_id": kind})
    return result.deleted_count > 0
