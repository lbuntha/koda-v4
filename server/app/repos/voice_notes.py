"""A child reading a book aloud, recorded for their parents to hear.

One row per recording. The audio itself lives in `audio_store` beside the
books' own recordings (content-addressed M4A); this keeps who read what, when,
and whether a grown-up has listened yet. Every query is scoped to one family.
"""

from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from app.models.common import now

#: Kept per child; the oldest goes when another arrives. A list a parent scrolls,
#: not an archive — and a child's voice is not something to hoard.
KEEP_PER_LEARNER = 60


async def add(
    db: AsyncIOMotorDatabase,
    *,
    family_id: str,
    learner_id: str,
    book_id: str,
    book_title: str,
    pages: list[int],
    clip_id: str,
    duration_ms: int,
) -> dict[str, Any]:
    doc = {
        "_id": f"vn_{uuid4().hex[:20]}",
        "familyId": family_id,
        "learnerId": learner_id,
        "bookId": book_id,
        "bookTitle": book_title,
        "pages": pages,
        "clipId": clip_id,
        "durationMs": duration_ms,
        "createdAt": now(),
        "heardAt": None,
        "heardBy": None,
    }
    await db.voice_notes.insert_one(doc)
    stale = await db.voice_notes.find(
        {"familyId": family_id, "learnerId": learner_id}, {"_id": 1}
    ).sort("createdAt", DESCENDING).skip(KEEP_PER_LEARNER).to_list(None)
    if stale:
        await db.voice_notes.delete_many({"_id": {"$in": [row["_id"] for row in stale]}})
    return doc


async def for_learner(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> list[dict[str, Any]]:
    return await db.voice_notes.find({"familyId": family_id, "learnerId": learner_id}).sort(
        "createdAt", DESCENDING
    ).to_list(KEEP_PER_LEARNER)


async def sent_since(db: AsyncIOMotorDatabase, family_id: str, learner_id: str, since) -> int:
    return await db.voice_notes.count_documents(
        {"familyId": family_id, "learnerId": learner_id, "createdAt": {"$gte": since}}
    )


async def by_id(db: AsyncIOMotorDatabase, family_id: str, note_id: str) -> dict[str, Any] | None:
    return await db.voice_notes.find_one({"_id": note_id, "familyId": family_id})


async def mark_heard(db: AsyncIOMotorDatabase, family_id: str, note_id: str, user_id: str) -> bool:
    result = await db.voice_notes.update_one(
        {"_id": note_id, "familyId": family_id, "heardAt": None},
        {"$set": {"heardAt": now(), "heardBy": user_id}},
    )
    return result.matched_count > 0 or await by_id(db, family_id, note_id) is not None


async def remove(db: AsyncIOMotorDatabase, family_id: str, note_id: str) -> bool:
    return (await db.voice_notes.delete_one({"_id": note_id, "familyId": family_id})).deleted_count > 0
