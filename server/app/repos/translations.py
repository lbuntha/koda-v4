"""Corrections to the bundled language files. One row per (language, key).

The catalogs ship inside the app (`src/lib/i18n/locales/*.json`); these rows
sit on top of them. Rows rather than one document per language, for the reason
the menu and the switchboard are rows: two people correcting two lines at the
same moment should not overwrite each other, and `updatedBy` says who wrote it.

The server does not know the catalogs, so it cannot check a key exists — the
editor only offers keys the app has. A row for a key the app later drops is
simply never read.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def all_rows(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    return await db.translation_overrides.find({}, {"_id": 0}).to_list(length=None)


async def put(
    db: AsyncIOMotorDatabase, lang: str, key: str, text: str | dict[str, str], updated_by: str | None
) -> dict[str, Any]:
    row = {"lang": lang, "key": key, "text": text, "updatedAt": now(), "updatedBy": updated_by}
    await db.translation_overrides.update_one({"lang": lang, "key": key}, {"$set": row}, upsert=True)
    return row


async def remove(db: AsyncIOMotorDatabase, lang: str, key: str) -> bool:
    result = await db.translation_overrides.delete_one({"lang": lang, "key": key})
    return result.deleted_count > 0


async def last_change(db: AsyncIOMotorDatabase) -> str | None:
    row = await db.translation_overrides.find_one({}, sort=[("updatedAt", -1)])
    return row["updatedAt"].isoformat() if row else None
