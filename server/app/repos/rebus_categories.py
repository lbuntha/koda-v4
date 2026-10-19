"""Rebus Rush categories: what a puzzle is about, managed in the Studio.

A category used to be a word in the code, so adding Math meant a release. It is
data now: an id (its address, never changed), a name in each language, a colour,
the Koda topic it files under, an order and an on/off switch. The eight that
shipped are created here once, create-if-absent, so an owner's later edits
(a renamed category, a different colour, one switched off) survive a restart.

A category is never deleted while a puzzle uses it. It is switched off instead:
its puzzles stay safe, and nobody can pick it.
"""

from __future__ import annotations

import re
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

COLLECTION = "rebus_categories"

#: The colours a category may wear: the six that icons can show (see the web app's `only-six-icon-tones`).
TONES = ("indigo", "purple", "pink", "cyan", "emerald")
LANGUAGES = ("en", "km")
ID_PATTERN = re.compile(r"^[a-z][a-z0-9-]{1,23}$")
#: What the app files a category under for recommendations (`app.topics.TOPICS`).
MAX_NAME = 30

BUILT_IN: tuple[dict[str, Any], ...] = (
    {"id": "countries", "names": {"en": "Countries", "km": "ប្រទេស"}, "tone": "indigo", "topic": "places"},
    {"id": "food", "names": {"en": "Food", "km": "អាហារ"}, "tone": "pink", "topic": "food"},
    {"id": "sayings", "names": {"en": "Sayings", "km": "ពាក្យពេចន៍"}, "tone": "purple", "topic": "words"},
    {"id": "animals", "names": {"en": "Animals", "km": "សត្វ"}, "tone": "emerald", "topic": "animals"},
    {"id": "sports", "names": {"en": "Sports", "km": "កីឡា"}, "tone": "cyan", "topic": "health"},
    {"id": "school", "names": {"en": "School", "km": "សាលា"}, "tone": "indigo", "topic": "school"},
    {"id": "science", "names": {"en": "Science", "km": "វិទ្យាសាស្ត្រ"}, "tone": "cyan", "topic": "nature"},
    {"id": "khmer", "names": {"en": "Khmer words", "km": "ពាក្យខ្មែរ"}, "tone": "purple", "topic": "words"},
    {"id": "math", "names": {"en": "Math", "km": "គណិតវិទ្យា"}, "tone": "cyan", "topic": "numbers"},
)


def public(row: dict[str, Any]) -> dict[str, Any]:
    """What a device (and the Studio) is told about a category."""
    return {
        "id": row["_id"],
        "names": row["names"],
        "tone": row["tone"],
        "topic": row["topic"],
        "order": row["order"],
        "enabled": bool(row.get("enabled", True)),
    }


async def ensure_seed(db: AsyncIOMotorDatabase) -> int:
    """Create the built-in categories that are not here yet. Returns how many."""
    created = 0
    for order, item in enumerate(BUILT_IN):
        if await db[COLLECTION].find_one({"_id": item["id"]}, {"_id": 1}):
            continue
        stamp = now()
        await db[COLLECTION].insert_one(
            {"_id": item["id"], "names": item["names"], "tone": item["tone"], "topic": item["topic"], "order": order, "enabled": True,
             "builtIn": True, "createdAt": stamp, "updatedAt": stamp}
        )
        created += 1
    return created


async def all_rows(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    return await db[COLLECTION].find({}).sort([("order", 1), ("_id", 1)]).to_list(length=None)


async def enabled(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    return [public(r) for r in await all_rows(db) if r.get("enabled", True)]


async def ids(db: AsyncIOMotorDatabase, *, only_enabled: bool = False) -> frozenset[str]:
    rows = await all_rows(db)
    return frozenset(r["_id"] for r in rows if r.get("enabled", True) or not only_enabled)


async def get(db: AsyncIOMotorDatabase, category_id: str) -> dict[str, Any] | None:
    return await db[COLLECTION].find_one({"_id": category_id})


async def create(db: AsyncIOMotorDatabase, *, category_id: str, names: dict[str, str], tone: str, topic: str) -> dict[str, Any]:
    stamp = now()
    last = await db[COLLECTION].find_one({}, sort=[("order", -1)])
    row = {"_id": category_id, "names": names, "tone": tone, "topic": topic, "order": (last["order"] + 1) if last else 0,
           "enabled": True, "builtIn": False, "createdAt": stamp, "updatedAt": stamp}
    await db[COLLECTION].insert_one(row)
    return row


async def update(db: AsyncIOMotorDatabase, category_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    return await db[COLLECTION].find_one_and_update(
        {"_id": category_id}, {"$set": {**fields, "updatedAt": now()}}, return_document=True
    )


async def reorder(db: AsyncIOMotorDatabase, order: list[str]) -> None:
    """Put the categories in this order. Any not named keep their place after the named ones."""
    rest = [r["_id"] for r in await all_rows(db) if r["_id"] not in order]
    for position, category_id in enumerate([*order, *rest]):
        await db[COLLECTION].update_one({"_id": category_id}, {"$set": {"order": position}})


async def puzzle_count(db: AsyncIOMotorDatabase, category_id: str) -> int:
    return await db.rebus_puzzles.count_documents({"category": category_id})


async def delete(db: AsyncIOMotorDatabase, category_id: str) -> bool:
    return (await db[COLLECTION].delete_one({"_id": category_id})).deleted_count > 0
