"""Global reset generations and the destructive maintenance operations.

The generation numbers are part of the reset.  Deleting Mongo rows alone is
not enough in an offline-first app: a tablet can otherwise upload its old
outbox on the next connection and recreate the data an operator removed.
"""

from pymongo import ReturnDocument

from app.models.common import now

STATE_ID = "global"


async def state(db) -> dict[str, int]:
    row = await db.maintenance_state.find_one({"_id": STATE_ID}) or {}
    return {
        "learningVersion": int(row.get("learningVersion", 0)),
        "registrationsVersion": int(row.get("registrationsVersion", 0)),
    }


async def _advance(db, field: str, actor_id: str) -> dict:
    other_field = "registrationsVersion" if field == "learningVersion" else "learningVersion"
    return await db.maintenance_state.find_one_and_update(
        {"_id": STATE_ID},
        {
            "$inc": {field: 1},
            "$set": {"updatedAt": now(), "updatedBy": actor_id},
            "$setOnInsert": {other_field: 0},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


async def reset_learning(db, actor_id: str) -> tuple[dict[str, int], dict[str, int]]:
    # Advance first. Devices that reconnect while deletion is underway discard
    # their old queues instead of racing the reset by uploading them again.
    row = await _advance(db, "learningVersion", actor_id)
    events = await db.events.delete_many({})
    concepts = await db.concept_totals.delete_many({})
    documents = await db.docs.delete_many({"kind": {"$in": ["progress", "levels"]}})
    profiles = await db.profile_stats.delete_many({})
    versions = {
        "learningVersion": int(row.get("learningVersion", 0)),
        "registrationsVersion": int(row.get("registrationsVersion", 0)),
    }
    return versions, {
        "events": events.deleted_count,
        "conceptTotals": concepts.deleted_count,
        "progressDocuments": documents.deleted_count,
        "profileStats": profiles.deleted_count,
    }


async def reset_registrations(db, actor_id: str) -> tuple[dict[str, int], dict[str, int]]:
    row = await _advance(db, "registrationsVersion", actor_id)
    registrations = await db.skill_registrations.delete_many({})
    versions = {
        "learningVersion": int(row.get("learningVersion", 0)),
        "registrationsVersion": int(row.get("registrationsVersion", 0)),
    }
    return versions, {"skillRegistrations": registrations.deleted_count}
