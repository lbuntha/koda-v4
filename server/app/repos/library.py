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

#: A book children can read. `live` is kept on the row by `refresh_summary`
#: (true exactly while it is published and not deleted) so the shelf can be
#: answered from an index instead of opening every book.
PUBLISHED = {"live": True}

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
    # Covered by the `library_book_live` index: no book is opened to answer it.
    cursor = db.library_books.find(PUBLISHED, {"_id": 0, "id": 1, "liveRev": 1}).sort("id", 1)
    return [{"id": row["id"], "rev": int(row.get("liveRev") or 0)} async for row in cursor]


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


def _pick(row: dict[str, Any], field: str, default: Any = None) -> Any:
    """A book's fact from its draft, falling back to its published revision."""
    for side in ("draft", "published"):
        value = (row.get(side) or {}).get(field)
        if value is not None:
            return value
    return default


def summary_of(row: dict[str, Any]) -> dict[str, Any]:
    """What the Studio list shows of a book, worked out once when the book changes.

    Stored on the row as `summary` so a page of the list is an indexed query on
    small fields, rather than opening every book to work out its title and
    counts on every request — which grew with the library.
    """
    published = row.get("published") is not None
    title = _pick(row, "title", row.get("id"))
    updated, published_at = row.get("updatedAt"), row.get("publishedAt")
    return {
        "title": title,
        "titleKey": str(title).lower(),
        "language": _pick(row, "language", "en"),
        "band": _pick(row, "band", "A"),
        "category": _pick(row, "category"),
        "picture": _pick(row, "picture", "book"),
        "sentences": len(_pick(row, "sentences", []) or []),
        "questions": len(_pick(row, "questions", []) or []),
        "status": "published" if published else "draft",
        # Saved since it was published: children still read the older revision.
        "changed": bool(published and updated and published_at and updated > published_at),
    }


async def refresh_summary(db: AsyncIOMotorDatabase, book_id: str) -> None:
    """Recompute a book's stored summary and whether children can read it."""
    row = await db.library_books.find_one({"id": book_id})
    if row is None:
        return
    live = row.get("deletedAt") is None and row.get("published") is not None
    await db.library_books.update_one(
        {"id": book_id},
        {"$set": {
            "summary": summary_of(row),
            "live": live,
            "liveRev": int((row.get("published") or {}).get("rev") or 0) if live else 0,
            # What the summary was made from, so a row edited behind the repo's
            # back (a seed script, a copy between servers) is redone at start.
            "summaryAt": row.get("updatedAt"),
        }},
    )


async def backfill_summaries(db: AsyncIOMotorDatabase) -> int:
    """Redo the summary of every row that has none, or changed since it was made. Runs at start."""
    stale = {"$or": [
        {"summary": {"$exists": False}},
        {"$expr": {"$ne": [{"$ifNull": ["$updatedAt", None]}, {"$ifNull": ["$summaryAt", None]}]}},
    ]}
    done = 0
    async for row in db.library_books.find(stale, {"id": 1}):
        await refresh_summary(db, row["id"])
        done += 1
    return done


STUDIO_SORTS: dict[str, list[tuple[str, int]]] = {
    "updated": [("updatedAt", -1), ("id", 1)],
    "title": [("summary.titleKey", 1), ("id", 1)],
    "created": [("createdAt", -1), ("id", 1)],
    "published": [("publishedAt", -1), ("id", 1)],
}
STUDIO_STATUSES = ("draft", "published", "changed", "reported")

_ROW_FIELDS = {"_id": 0, "id": 1, "rev": 1, "createdAt": 1, "updatedAt": 1, "publishedAt": 1, "ownerId": 1, "summary": 1}


def _row(doc: dict[str, Any]) -> dict[str, Any]:
    summary = dict(doc.get("summary") or {})
    summary.pop("titleKey", None)
    return {**{k: v for k, v in doc.items() if k != "summary"}, **summary}


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

    `owner` narrows it to one person's books (security.ownership.scope). Only
    the page's own rows are read in full; the counts are index counts.
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

    narrow: dict[str, Any] = {"deletedAt": None, **(owner or {})}
    if query.strip():
        pattern = {"$regex": re.escape(query.strip().lower())}
        narrow["$or"] = [{"summary.titleKey": pattern}, {"id": {"$regex": re.escape(query.strip()), "$options": "i"}}]
    if language:
        narrow["summary.language"] = language
    if band:
        narrow["summary.band"] = band
    if category:
        narrow["summary.category"] = category

    by_status: dict[str, dict[str, Any]] = {
        "draft": {"summary.status": "draft"},
        "published": {"summary.status": "published"},
        "changed": {"summary.changed": True},
        "reported": {"id": {"$in": reported}},
    }
    pick = by_status.get(status or "", {})
    order = STUDIO_SORTS.get(sort, STUDIO_SORTS["updated"])

    cursor = (
        db.library_books.find({**narrow, **pick}, _ROW_FIELDS)
        .sort(order)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = [_row(doc) async for doc in cursor]
    for row in items:
        row["reports"] = open_counts.get(row["id"], 0)
    stats = {"all": await db.library_books.count_documents(narrow)}
    for name, extra in by_status.items():
        stats[name] = await db.library_books.count_documents({**narrow, **extra})
    return {
        "items": items,
        "total": stats["all"] if not pick else stats[status or ""],
        "stats": {k: int(stats.get(k, 0)) for k in ("all", *STUDIO_STATUSES)},
    }


async def studio_facets(db: AsyncIOMotorDatabase, owner: dict[str, Any] | None = None) -> dict[str, list[dict[str, Any]]]:
    """The languages, levels and categories books actually have, with counts — the filter options."""
    group = lambda field: [{"$group": {"_id": f"$summary.{field}", "count": {"$sum": 1}}}, {"$sort": {"_id": 1}}]  # noqa: E731
    out = (await db.library_books.aggregate([
        {"$match": {"deletedAt": None, **(owner or {})}},
        {"$project": {"_id": 0, "summary.language": 1, "summary.band": 1, "summary.category": 1}},
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
    await refresh_summary(db, book_id)
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
    await refresh_summary(db, book_id)
    out = await get(db, book_id)
    assert out is not None
    return out


async def unpublish(db: AsyncIOMotorDatabase, book_id: str, by: str | None) -> dict[str, Any] | None:
    await db.library_books.update_one(
        {"id": book_id, "deletedAt": None},
        {"$set": {"published": None, "updatedAt": now(), "updatedBy": by}},
    )
    await refresh_summary(db, book_id)
    return await get(db, book_id)


async def delete(db: AsyncIOMotorDatabase, book_id: str, by: str | None) -> bool:
    result = await db.library_books.update_one(
        {"id": book_id, "deletedAt": None},
        {"$set": {"deletedAt": now(), "published": None, "updatedBy": by}},
    )
    await refresh_summary(db, book_id)
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
