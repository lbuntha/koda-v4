"""Koda Library books in MongoDB.

Two collections, because a draft and a published book are different promises:

  library_books      one row per book: the working draft an author edits, and a
                     copy of the revision children currently read (or none).
  library_revisions  every published revision, immutable. A device that started a
                     book on revision 2 can still be answered about revision 2
                     after revision 3 ships, and a mistake can be traced to the
                     exact text that was live.

Publishing is the only way a draft becomes something a child sees, and it goes
through `library_verify` first — see the router.
"""

from __future__ import annotations

import hashlib
import re
import secrets
from typing import Any

from bson import Binary
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


PUBLISHED = {"deletedAt": None, "published": {"$ne": None}}

#: Most books one batch request may ask for. A device fetches a big shelf in
#: several of these rather than one response it may not finish on a slow line.
BATCH_MAX = 100


async def list_published(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    """Every published book's whole row — for the content pack, which needs it all."""
    cursor = db.library_books.find(PUBLISHED).sort("id", 1)
    return await cursor.to_list(length=None)


async def published_shelf(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    """Every published book, live revision only — the whole shelf in one answer.

    Kept for devices still running a build from before the index. Reads only
    the published copy (never the draft beside it), and has no ceiling: the old
    2,000-row cap would have hidden every book after it without a word.
    """
    cursor = db.library_books.find(PUBLISHED, {"_id": 0, "published": 1}).sort("id", 1)
    return [row["published"] async for row in cursor]


async def published_index(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    """`{id, rev}` for every published book, in shelf order — a few bytes a book.

    What a device compares against what it holds, so it downloads only the
    books that are new or changed instead of the whole shelf every time.
    """
    cursor = db.library_books.find(PUBLISHED, {"_id": 0, "id": 1, "published.rev": 1}).sort("id", 1)
    return [{"id": row["id"], "rev": int((row.get("published") or {}).get("rev") or 0)} async for row in cursor]


async def published_by_ids(db: AsyncIOMotorDatabase, ids: list[str]) -> list[dict[str, Any]]:
    """The live revision of each named book that is still published."""
    if not ids:
        return []
    cursor = db.library_books.find({**PUBLISHED, "id": {"$in": ids[:BATCH_MAX]}}, {"_id": 0, "published": 1}).sort("id", 1)
    return [row["published"] async for row in cursor]


# ------------------------------------------------------------------ the studio list
#
# The studio lists books a page at a time, searched, filtered and sorted in the
# database, so it stays quick with thousands of books. Each row is a summary —
# the title and counts, never the story — and the full book is loaded only when
# someone opens it. A book's facts are read from its draft, falling back to its
# published revision, so rows saved before these fields existed list correctly.

STUDIO_SORTS: dict[str, list[tuple[str, int]]] = {
    "updated": [("updatedAt", -1), ("id", 1)],
    "title": [("titleKey", 1), ("id", 1)],
    "created": [("createdAt", -1), ("id", 1)],
    "published": [("publishedAt", -1), ("id", 1)],
}
STUDIO_STATUSES = ("draft", "published", "changed", "reported")


def _either(field: str, default: Any = None) -> dict[str, Any]:
    return {"$ifNull": [f"$draft.{field}", {"$ifNull": [f"$published.{field}", default]}]}


# Only what a summary needs leaves the collection: never the sentences' text.
_SUMMARY_PROJECTION: dict[str, Any] = {
    "_id": 0, "id": 1, "rev": 1, "createdAt": 1, "updatedAt": 1, "publishedAt": 1, "ownerId": 1,
    **{f"{side}.{f}": 1 for side in ("draft", "published") for f in ("title", "language", "band", "category", "picture")},
    **{f"{side}.{f}.id": 1 for side in ("draft", "published") for f in ("sentences", "questions")},
    "hasPublished": {"$ne": [{"$ifNull": ["$published", None]}, None]},
}


def _summary_stages(owner: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    return [
        {"$match": {"deletedAt": None, **(owner or {})}},
        {"$project": _SUMMARY_PROJECTION},
        {"$addFields": {
            "title": _either("title", "$id"),
            "language": _either("language", "en"),
            "band": _either("band", "A"),
            "category": _either("category"),
            "picture": _either("picture", "book"),
            "sentences": {"$size": _either("sentences", [])},
            "questions": {"$size": _either("questions", [])},
            "status": {"$cond": ["$hasPublished", "published", "draft"]},
            # Saved since it was published: children still read the older revision.
            "changed": {"$and": ["$hasPublished", {"$gt": ["$updatedAt", {"$ifNull": ["$publishedAt", "$updatedAt"]}]}]},
        }},
        {"$addFields": {"titleKey": {"$toLower": "$title"}}},
        {"$project": {"draft": 0, "published": 0, "hasPublished": 0}},
    ]


async def studio_page(
    db: AsyncIOMotorDatabase,
    *,
    query: str = "",
    status: str | None = None,
    language: str | None = None,
    band: str | None = None,
    category: str | None = None,
    sort: str = "updated",
    page: int = 1,
    page_size: int = 25,
    owner: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """One page of book summaries, plus counts per status for the same search.

    `owner` narrows it to one person's books (security.ownership.scope).
    """
    reported = await db.library_reports.distinct("bookId", {"resolvedAt": None})
    count_pipeline = [
        {"$match": {"resolvedAt": None}},
        {"$group": {"_id": "$bookId", "n": {"$sum": 1}}},
    ]
    open_counts = {
        row["_id"]: row["n"]
        for row in await db.library_reports.aggregate(count_pipeline).to_list(length=None)
    }

    narrow: dict[str, Any] = {}
    if query.strip():
        pattern = {"$regex": re.escape(query.strip()), "$options": "i"}
        narrow["$or"] = [{"title": pattern}, {"id": pattern}]
    if language:
        narrow["language"] = language
    if band:
        narrow["band"] = band
    if category:
        narrow["category"] = category

    by_status: dict[str, dict[str, Any]] = {
        "draft": {"status": "draft"},
        "published": {"status": "published"},
        "changed": {"changed": True},
        "reported": {"id": {"$in": reported}},
    }
    pick = by_status.get(status or "", {})
    order = STUDIO_SORTS.get(sort, STUDIO_SORTS["updated"])

    pipeline = [
        *_summary_stages(owner),
        *([{"$match": narrow}] if narrow else []),
        {"$facet": {
            "items": [{"$match": pick}, {"$sort": dict(order)}, {"$skip": (page - 1) * page_size}, {"$limit": page_size}],
            "total": [{"$match": pick}, {"$count": "n"}],
            "stats": [{"$group": {
                "_id": None,
                "all": {"$sum": 1},
                "draft": {"$sum": {"$cond": [{"$eq": ["$status", "draft"]}, 1, 0]}},
                "published": {"$sum": {"$cond": [{"$eq": ["$status", "published"]}, 1, 0]}},
                "changed": {"$sum": {"$cond": ["$changed", 1, 0]}},
                "reported": {"$sum": {"$cond": [{"$in": ["$id", reported]}, 1, 0]}},
            }}],
        }},
    ]
    out = (await db.library_books.aggregate(pipeline).to_list(length=1))[0]
    items = out["items"]
    for row in items:
        row["reports"] = open_counts.get(row["id"], 0)
        row.pop("titleKey", None)
    stats = out["stats"][0] if out["stats"] else {}
    stats.pop("_id", None)
    return {
        "items": items,
        "total": out["total"][0]["n"] if out["total"] else 0,
        "stats": {k: int(stats.get(k, 0)) for k in ("all", *STUDIO_STATUSES)},
    }


async def studio_facets(db: AsyncIOMotorDatabase, owner: dict[str, Any] | None = None) -> dict[str, list[dict[str, Any]]]:
    """The languages, levels and categories books actually have, with counts — the filter options."""
    group = lambda field: [{"$group": {"_id": f"${field}", "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]  # noqa: E731
    out = (await db.library_books.aggregate([
        *_summary_stages(owner),
        {"$facet": {"languages": group("language"), "bands": group("band"), "categories": group("category")}},
    ]).to_list(length=1))[0]
    return {k: [{"value": row["_id"], "count": row["count"]} for row in v if row["_id"] is not None] for k, v in out.items()}


async def spelling_words(db: AsyncIOMotorDatabase, language: str) -> list[str]:
    """Every spelling word of every book in a language, drafts and published revisions alike."""
    words: set[str] = set()
    fields = {
        "_id": 0,
        "draft.language": 1,
        "draft.questions": 1,
        "published.language": 1,
        "published.questions": 1,
    }
    cursor = db.library_books.find({"deletedAt": None}, fields)
    async for row in cursor:
        for side in ("draft", "published"):
            book = row.get(side) or {}
            if book.get("language") != language:
                continue
            for q in book.get("questions") or []:
                if q.get("kind") == "spell" and q.get("word"):
                    words.add(str(q["word"]))
    return sorted(words)


async def get(db: AsyncIOMotorDatabase, book_id: str) -> dict[str, Any] | None:
    return await db.library_books.find_one({"id": book_id, "deletedAt": None})


async def get_any(db: AsyncIOMotorDatabase, book_id: str) -> dict[str, Any] | None:
    """The row for an id even once deleted: an id stays its owner's, so a save cannot take it over."""
    return await db.library_books.find_one({"id": book_id})


async def save_draft(
    db: AsyncIOMotorDatabase,
    book_id: str,
    draft: dict[str, Any],
    meta: dict[str, Any],
    updated_by: str | None,
    owner_id: str | None = None,
) -> dict[str, Any]:
    timestamp = now()
    await db.library_books.update_one(
        {"id": book_id},
        {
            "$set": {"draft": draft, **meta, "updatedAt": timestamp, "updatedBy": updated_by, "deletedAt": None},
            # The person who first saves a book owns it; later editors do not.
            "$setOnInsert": {"id": book_id, "createdAt": timestamp, "rev": 0, "published": None, "ownerId": owner_id},
        },
        upsert=True,
    )
    row = await get(db, book_id)
    assert row is not None
    return row


async def publish(db: AsyncIOMotorDatabase, book_id: str, passage: dict[str, Any], published_by: str | None) -> dict[str, Any]:
    """Freeze `passage` as the next revision and make it the live one."""
    row = await get(db, book_id)
    assert row is not None
    rev = int(row.get("rev") or 0) + 1
    frozen = {**passage, "id": book_id, "rev": rev}
    timestamp = now()
    await db.library_revisions.insert_one(
        {"bookId": book_id, "rev": rev, "passage": frozen, "publishedAt": timestamp, "publishedBy": published_by}
    )
    await db.library_books.update_one(
        {"id": book_id},
        {"$set": {"published": frozen, "rev": rev, "publishedAt": timestamp, "updatedAt": timestamp, "updatedBy": published_by}},
    )
    out = await get(db, book_id)
    assert out is not None
    return out


async def unpublish(db: AsyncIOMotorDatabase, book_id: str, by: str | None) -> dict[str, Any] | None:
    await db.library_books.update_one(
        {"id": book_id, "deletedAt": None},
        {"$set": {"published": None, "updatedAt": now(), "updatedBy": by}},
    )
    return await get(db, book_id)


async def delete(db: AsyncIOMotorDatabase, book_id: str, by: str | None) -> bool:
    result = await db.library_books.update_one(
        {"id": book_id, "deletedAt": None},
        {"$set": {"deletedAt": now(), "published": None, "updatedBy": by}},
    )
    return result.modified_count > 0


async def revisions(db: AsyncIOMotorDatabase, book_id: str) -> list[dict[str, Any]]:
    cursor = db.library_revisions.find({"bookId": book_id}).sort("rev", -1)
    return await cursor.to_list(length=500)


# --------------------------------------------------------------------- reports
#
# A reader flags a book; an author reads the flag and resolves it. The reporter is
# kept so an operator can follow up, and nothing else about the child is.

REPORT_REASONS = {"wrong_in_story", "wrong_question", "not_for_children", "other"}


async def add_report(db: AsyncIOMotorDatabase, book_id: str, rev: int, reason: str, note: str, by: str | None) -> dict[str, Any]:
    row = {
        "id": secrets.token_hex(8),
        "bookId": book_id,
        "rev": rev,
        "reason": reason,
        "note": note,
        "by": by,
        "createdAt": now(),
        "resolvedAt": None,
    }
    await db.library_reports.insert_one(row)
    return row


async def open_reports(db: AsyncIOMotorDatabase, book_id: str | None = None) -> list[dict[str, Any]]:
    match: dict[str, Any] = {"resolvedAt": None, **({"bookId": book_id} if book_id else {})}
    return await db.library_reports.find(match).sort("createdAt", -1).to_list(length=500)


async def report_by_id(db: AsyncIOMotorDatabase, report_id: str) -> dict[str, Any] | None:
    return await db.library_reports.find_one({"id": report_id, "resolvedAt": None})


async def owned_ids(db: AsyncIOMotorDatabase, owner_id: str) -> list[dict[str, Any]]:
    return await db.library_books.find({"ownerId": owner_id, "deletedAt": None}, {"_id": 0, "id": 1}).to_list(length=None)


async def resolve_report(db: AsyncIOMotorDatabase, report_id: str, by: str | None) -> bool:
    result = await db.library_reports.update_one({"id": report_id, "resolvedAt": None}, {"$set": {"resolvedAt": now(), "resolvedBy": by}})
    return result.modified_count > 0


# ------------------------------------------------------------------ photos
#
# The same content addressing as recordings: a photo's id is the SHA-256 of its
# bytes, so a device may cache it for ever and a published book's pictures
# cannot change under it.


async def put_image(
    db: AsyncIOMotorDatabase, data: bytes, mime: str, by: str | None, *, source: str | None = None, prompt: str | None = None
) -> str:
    """Keep a photo. A made-with-AI one also keeps what it was asked for, so it can be found again.

    The label is `$set`, not `$setOnInsert`: the same bytes uploaded first as a
    plain photo and later marked as made by AI still show up among AI pictures.
    """
    image_id = hashlib.sha256(data).hexdigest()
    update: dict[str, Any] = {
        "$setOnInsert": {"id": image_id, "mime": mime, "data": Binary(data), "bytes": len(data), "createdAt": now(), "createdBy": by}
    }
    if source:
        update["$set"] = {"source": source, "prompt": prompt or "", "madeAt": now()}
    await db.library_images.update_one({"id": image_id}, update, upsert=True)
    return image_id


async def list_images(
    db: AsyncIOMotorDatabase, *, source: str, query: str = "", limit: int = 60, made_by: str | None = None
) -> list[dict[str, Any]]:
    """Photos newest first, without their bytes. `query` matches the description.

    `source="ai"` is the pictures made with AI; `"all"` is every stored photo,
    which is how a picture made before pictures were labelled is found again.
    """
    match: dict[str, Any] = {} if source == "all" else {"source": source}
    if made_by:
        match["createdBy"] = made_by
    if query:
        match["prompt"] = {"$regex": re.escape(query), "$options": "i"}
    order = "createdAt" if source == "all" else "madeAt"
    cursor = db.library_images.find(match, {"_id": 0, "id": 1, "prompt": 1, "bytes": 1}).sort(order, -1).limit(limit)
    return await cursor.to_list(length=limit)


async def get_image(db: AsyncIOMotorDatabase, image_id: str) -> dict[str, Any] | None:
    return await db.library_images.find_one({"id": image_id})


async def missing_images(db: AsyncIOMotorDatabase, image_ids: set[str]) -> set[str]:
    if not image_ids:
        return set()
    found = await db.library_images.find({"id": {"$in": list(image_ids)}}, {"id": 1}).to_list(length=len(image_ids))
    return image_ids - {row["id"] for row in found}


# ------------------------------------------------------------ Khmer unit names
#
# One recording per spelling unit (ក, ◌្ម, ◌ែ …) saying its classroom name, so a
# child hears "ជើងម" and not a machine guessing. Keyed by the unit itself, not
# its name: names may be corrected after review, the unit never changes.


async def unit_voices(db: AsyncIOMotorDatabase) -> dict[str, str]:
    rows = await db.library_unit_voices.find({}, {"_id": 0, "unit": 1, "clip": 1}).to_list(length=1000)
    return {row["unit"]: row["clip"] for row in rows}


async def set_unit_voice(db: AsyncIOMotorDatabase, unit: str, clip: str | None, by: str | None) -> None:
    if clip is None:
        await db.library_unit_voices.delete_one({"unit": unit})
        return
    await db.library_unit_voices.update_one(
        {"unit": unit},
        {"$set": {"unit": unit, "clip": clip, "updatedAt": now(), "updatedBy": by}},
        upsert=True,
    )
