"""Learning events: append-only, and idempotent by construction.

Every event carries an id the client generated, and `(familyId, eventId)` is a
unique index — so a batch that is sent twice inserts nothing the second time and
the rollup is never double-counted. That single index is the whole replay story.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import UpdateOne

from app.models.common import now
from app.models.events import LearningEvent


def to_document(
    event: LearningEvent, *, family_id: str, device_id: str | None, server_seq: int
) -> dict[str, Any]:
    doc = event.model_dump(by_alias=True, exclude_none=True)
    doc.update(event.extra)
    doc.update(
        {
            "eventId": event.id,
            "familyId": family_id,
            "deviceId": device_id,
            "serverSeq": server_seq,
            "receivedAt": now(),
        }
    )
    doc.pop("id", None)
    return doc


async def insert_many(
    db: AsyncIOMotorDatabase, documents: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], int]:
    """Insert what is new. Returns (inserted, duplicates).

    An upsert keyed on the unique pair, rather than `insert_many(ordered=False)`
    and reading the error list: the count of what was actually new is what the
    rollup must be driven by, and it should not come out of an exception.
    """
    if not documents:
        return [], 0

    operations = [
        UpdateOne(
            {"familyId": doc["familyId"], "eventId": doc["eventId"]},
            {"$setOnInsert": doc},
            upsert=True,
        )
        for doc in documents
    ]
    result = await db.events.bulk_write(operations, ordered=False)

    inserted_ids = set(result.upserted_ids.values()) if result.upserted_ids else set()
    inserted = [
        doc
        for index, doc in enumerate(documents)
        if result.upserted_ids and index in result.upserted_ids
    ]
    return inserted, len(documents) - len(inserted_ids)


async def count_for_learner(db: AsyncIOMotorDatabase, family_id: str, learner_id: str) -> int:
    return await db.events.count_documents({"familyId": family_id, "learnerId": learner_id})


async def conversations_for_learner(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, *, limit: int = 100
) -> list[dict[str, Any]]:
    """A learner's conversations with Koda, newest first.

    Read from the server's copy rather than the device's, because the device
    keeps a capped ring and the point of these is the long view: "she has asked
    about teen numbers on four different days" is not a question a single
    tablet's recent history can answer.

    Scoped to the family as every read here is — tenancy is a filter, not a
    permission, so a query that forgot it returns another family's children.
    """
    rows = await (
        db.events.find(
            {"familyId": family_id, "learnerId": learner_id, "type": "koda_conversation"},
            {"_id": 0, "familyId": 0},
        )
        .sort("ts", -1)
        .limit(max(1, min(limit, 500)))
        .to_list(length=500)
    )
    return rows
