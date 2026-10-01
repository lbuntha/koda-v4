"""Koda Trace in MongoDB.

trace_items         one row per item: its draft (strokes, writing steps and the
                    author's tests). Items are made once and used in any number
                    of collections.
trace_collections   one row per collection: its draft (title, the ordered item
                    ids) and a copy of the revision children currently play.
trace_revisions     every published revision of a collection, immutable, with
                    its items frozen inside — a device that started on
                    revision 2 can still be answered about revision 2.
"""

from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

# ------------------------------------------------------------------ items


async def list_items(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.trace_items.find({"deletedAt": None}, {"_id": 0}).sort("updatedAt", -1)
    return await cursor.to_list(length=5000)


async def get_item(db: AsyncIOMotorDatabase, item_id: str) -> dict[str, Any] | None:
    return await db.trace_items.find_one({"id": item_id, "deletedAt": None}, {"_id": 0})


async def get_items(db: AsyncIOMotorDatabase, ids: list[str]) -> dict[str, dict[str, Any]]:
    rows = await db.trace_items.find({"id": {"$in": ids}, "deletedAt": None}, {"_id": 0}).to_list(length=len(ids) + 1)
    return {r["id"]: r for r in rows}


async def save_item(db: AsyncIOMotorDatabase, item_id: str, draft: dict[str, Any], by: str | None) -> dict[str, Any]:
    t = now()
    await db.trace_items.update_one(
        {"id": item_id},
        {"$set": {"draft": draft, "updatedAt": t, "updatedBy": by, "deletedAt": None}, "$setOnInsert": {"id": item_id, "createdAt": t}},
        upsert=True,
    )
    row = await get_item(db, item_id)
    assert row is not None
    return row


async def delete_item(db: AsyncIOMotorDatabase, item_id: str, by: str | None) -> bool:
    r = await db.trace_items.update_one({"id": item_id, "deletedAt": None}, {"$set": {"deletedAt": now(), "updatedBy": by}})
    return r.modified_count > 0


# ------------------------------------------------------------ collections


async def list_collections(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.trace_collections.find({"deletedAt": None}, {"_id": 0}).sort("updatedAt", -1)
    return await cursor.to_list(length=2000)


async def list_published(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.trace_collections.find({"deletedAt": None, "published": {"$ne": None}}, {"_id": 0, "published": 1}).sort(
        "published.order", 1
    )
    return [r["published"] for r in await cursor.to_list(length=2000)]


async def get_collection(db: AsyncIOMotorDatabase, collection_id: str) -> dict[str, Any] | None:
    return await db.trace_collections.find_one({"id": collection_id, "deletedAt": None}, {"_id": 0})


async def save_collection(db: AsyncIOMotorDatabase, collection_id: str, draft: dict[str, Any], by: str | None) -> dict[str, Any]:
    t = now()
    await db.trace_collections.update_one(
        {"id": collection_id},
        {
            "$set": {"draft": draft, "updatedAt": t, "updatedBy": by, "deletedAt": None},
            "$setOnInsert": {"id": collection_id, "createdAt": t, "rev": 0, "published": None},
        },
        upsert=True,
    )
    row = await get_collection(db, collection_id)
    assert row is not None
    return row


async def publish(db: AsyncIOMotorDatabase, collection_id: str, bundle: dict[str, Any], by: str | None) -> dict[str, Any]:
    """Freeze `bundle` (the collection with its items inside) as the next revision and make it live."""
    row = await get_collection(db, collection_id)
    assert row is not None
    rev = int(row.get("rev") or 0) + 1
    t = now()
    frozen = {**bundle, "id": collection_id, "rev": rev, "publishedAt": t.isoformat()}
    await db.trace_revisions.insert_one({"collectionId": collection_id, "rev": rev, "bundle": frozen, "publishedAt": t, "publishedBy": by})
    await db.trace_collections.update_one(
        {"id": collection_id},
        {"$set": {"published": frozen, "rev": rev, "publishedAt": t, "updatedAt": t, "updatedBy": by}},
    )
    out = await get_collection(db, collection_id)
    assert out is not None
    return out


async def unpublish(db: AsyncIOMotorDatabase, collection_id: str, by: str | None) -> dict[str, Any] | None:
    await db.trace_collections.update_one(
        {"id": collection_id, "deletedAt": None}, {"$set": {"published": None, "updatedAt": now(), "updatedBy": by}}
    )
    return await get_collection(db, collection_id)


async def delete_collection(db: AsyncIOMotorDatabase, collection_id: str, by: str | None) -> bool:
    r = await db.trace_collections.update_one(
        {"id": collection_id, "deletedAt": None}, {"$set": {"deletedAt": now(), "published": None, "updatedBy": by}}
    )
    return r.modified_count > 0


# ------------------------------------------------------------------ reports
#
# A learner (or a parent) flags an item; a creator reads the flag and resolves
# it. Who reported is kept so a creator can follow up; nothing else about them.

REPORT_REASONS = {"strokes_wrong", "too_hard", "not_for_children", "other"}


async def add_report(db: AsyncIOMotorDatabase, report: dict[str, Any]) -> dict[str, Any]:
    row = {**report, "createdAt": now(), "resolvedAt": None}
    await db.trace_reports.insert_one(row)
    row.pop("_id", None)
    return row


async def open_reports(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    cursor = db.trace_reports.find({"resolvedAt": None}, {"_id": 0}).sort("createdAt", -1)
    return await cursor.to_list(length=1000)


async def resolve_report(db: AsyncIOMotorDatabase, report_id: str, by: str | None) -> bool:
    r = await db.trace_reports.update_one({"id": report_id, "resolvedAt": None}, {"$set": {"resolvedAt": now(), "resolvedBy": by}})
    return r.modified_count > 0
