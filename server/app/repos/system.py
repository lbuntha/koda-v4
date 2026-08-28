"""The deployment's own settings. One row per setting, no family in sight.

Rows rather than one blob, for the reason the menu is rows: two admins changing
two different switches at the same moment should not overwrite each other, and
`updatedBy` on the row is what makes "who turned this off?" answerable.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now

#: Fields that describe a setting rather than record a decision about it.
#:
#: These come from the code and are refreshed on every boot: renaming a label or
#: correcting a description is a deploy, and a row seeded once would otherwise
#: keep the first wording it ever had for the life of the database.
PRESENTATION_FIELDS = ("group", "label", "description", "type", "order")


async def seed_default(db: AsyncIOMotorDatabase, item: dict[str, Any]) -> bool:
    """Insert a shipped default if it is absent. True if it was new.

    `value` is `$setOnInsert`: a switch an operator has thrown must survive the
    next deploy, or every release would quietly turn the lights back on. The
    wording around it is not a decision anybody made here, so it is `$set` — the
    split is "what the operator chose" against "what the code says it is".
    """
    presentation = {key: item[key] for key in PRESENTATION_FIELDS if key in item}
    result = await db.system_settings.update_one(
        {"settingId": item["settingId"]},
        {
            "$setOnInsert": {
                "settingId": item["settingId"],
                "value": item["value"],
                "updatedAt": now(),
                "updatedBy": None,
            },
            "$set": presentation,
        },
        upsert=True,
    )
    return result.upserted_id is not None


async def all_settings(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    rows = db.system_settings.find({}).sort("order", 1)
    return await rows.to_list(length=200)


async def set_value(
    db: AsyncIOMotorDatabase, setting_id: str, value: Any, updated_by: str | None
) -> dict[str, Any] | None:
    return await db.system_settings.find_one_and_update(
        {"settingId": setting_id},
        {"$set": {"value": value, "updatedAt": now(), "updatedBy": updated_by}},
        return_document=ReturnDocument.AFTER,
    )


async def value_of(db: AsyncIOMotorDatabase, setting_id: str, default: Any) -> Any:
    """One setting, for a route that has to obey it.

    Read per call rather than cached: an operator throwing the maintenance
    switch expects the next request to feel it, not the one after a cache
    expires. These are single-document lookups on a unique index, on a
    collection with eight rows in it.
    """
    row = await db.system_settings.find_one({"settingId": setting_id})
    return row.get("value", default) if row else default
