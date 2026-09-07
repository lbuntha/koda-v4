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


#: The event that means a round was finished, rather than merely started.
#:
#: Everything the notification layer asks about practice is asked in these
#: terms: a lesson opened and abandoned is not a day's practice, and counting
#: `answer_submitted` would make one long round look like a fortnight of them.
COMPLETED = "lesson_completed"


async def latest_tz_offset(db: AsyncIOMotorDatabase, family_id: str) -> int | None:
    """Minutes east of UTC, as the family's own device last reported it.

    There is no timezone field on a family, and this is deliberately not a
    reason to add one: every learning event already carries the offset the
    browser was in when it was recorded, because mastery counts days in the
    child's day rather than the server's. A scheduled job asking "is it six in
    the evening where they are?" is asking the same question the log already
    answers.

    An *offset* rather than an IANA zone, so it is worth being plain about the
    limit: it is the offset that was true when they last practised, which a
    daylight-saving change can leave an hour stale until the next round is
    played. An hour of drift on a Sunday summary is not worth a new field on
    every device registration to prevent — and a family who has not practised
    since the clocks changed has no summary to be sent anyway.

    `None` means nobody in this family has ever practised, which every caller
    reads as "nothing to say" rather than as an error.
    """
    row = await db.events.find_one(
        {"familyId": family_id, "tzOffsetMinutes": {"$ne": None}},
        {"tzOffsetMinutes": 1},
        sort=[("receivedAt", -1)],
    )
    if row is None:
        return None
    offset = row.get("tzOffsetMinutes")
    # A device is entitled to be wrong about itself; a job is not entitled to
    # crash because of it. Real offsets run from -12:00 to +14:00.
    return offset if isinstance(offset, int) and -840 <= offset <= 840 else None


async def days_practised(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, days: list[str]
) -> int:
    """How many of these local days this learner finished something on.

    The days are passed in rather than derived from a range here, because the
    caller is the only thing that knows where the learner's week starts — and a
    string comparison over `localDay` would quietly include a day the caller did
    not mean the moment one client writes the field in another format.
    """
    if not days:
        return 0
    found = await db.events.distinct(
        "localDay",
        {
            "familyId": family_id,
            "learnerId": learner_id,
            "type": COMPLETED,
            "localDay": {"$in": days},
        },
    )
    return len(found)


async def completed_on(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, local_day: str
) -> int:
    """Rounds this learner finished on one of their own days."""
    return await db.events.count_documents(
        {
            "familyId": family_id,
            "learnerId": learner_id,
            "type": COMPLETED,
            "localDay": local_day,
        }
    )


async def practised_on(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, local_day: str
) -> bool:
    """Whether this learner finished anything on one of their own days.

    A boolean rather than `completed_on(...) > 0` at the call site, because the
    reminder asks a yes/no question and counting rows to answer it reads the
    whole day when the first document would do.
    """
    return (
        await db.events.find_one(
            {
                "familyId": family_id,
                "learnerId": learner_id,
                "type": COMPLETED,
                "localDay": local_day,
            },
            {"_id": 1},
        )
        is not None
    )


async def practice_days(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, *, limit: int = 400
) -> list[str]:
    """Every local day this learner finished something on, newest first.

    Distinct days rather than events: a streak counts days, and a child who did
    nine rounds on Tuesday had one Tuesday. Bounded because the events
    collection ages out at 400 days anyway, so a longer answer would be a
    promise the data cannot keep.
    """
    days = await db.events.distinct(
        "localDay",
        {"familyId": family_id, "learnerId": learner_id, "type": COMPLETED},
    )
    return sorted((day for day in days if isinstance(day, str)), reverse=True)[:limit]
