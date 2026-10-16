"""Pictures from photos: how many a family has used this month.

One document per family per calendar month (UTC), `{_id: "<family>|<YYYY-MM>", used}`.
A new month is a new document, so nothing has to run at midnight to reset it.
"""

from __future__ import annotations

from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.models.common import now


def month_of(when: datetime | None = None) -> str:
    return (when or now()).strftime("%Y-%m")


def _key(family_id: str, month: str) -> str:
    return f"{family_id}|{month}"


async def used(db: AsyncIOMotorDatabase, family_id: str, month: str | None = None) -> int:
    doc = await db.photo_credits.find_one({"_id": _key(family_id, month or month_of())})
    return int(doc["used"]) if doc else 0


async def spend(db: AsyncIOMotorDatabase, family_id: str, limit: int, month: str | None = None) -> int | None:
    """Take one, if any are left: the new count, or None when the month's are gone.

    Atomic: the increment only matches while `used` is under the limit, so two
    tablets asking at once cannot both take the last one.
    """
    key = _key(family_id, month or month_of())
    if limit <= 0:
        return None
    try:
        await db.photo_credits.insert_one({"_id": key, "familyId": family_id, "used": 0})
    except DuplicateKeyError:
        pass
    doc = await db.photo_credits.find_one_and_update(
        {"_id": key, "used": {"$lt": limit}},
        {"$inc": {"used": 1}},
        return_document=True,
    )
    return int(doc["used"]) if doc else None


async def refund(db: AsyncIOMotorDatabase, family_id: str, month: str | None = None) -> None:
    """Give one back — the AI failed after it was taken. Never below zero."""
    await db.photo_credits.update_one({"_id": _key(family_id, month or month_of()), "used": {"$gt": 0}}, {"$inc": {"used": -1}})
