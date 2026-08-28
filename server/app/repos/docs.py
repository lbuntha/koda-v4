"""The one collection every mutable setting lives in.

Keyed by `(familyId, kind, key)`. A document belonging to one child carries a
`learnerId` as well, but the key is still what identifies it — two children's
progress documents differ by key, not by collection.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def get(
    db: AsyncIOMotorDatabase, family_id: str, kind: str, key: str
) -> dict[str, Any] | None:
    return await db.docs.find_one({"familyId": family_id, "kind": kind, "key": key})


async def put(
    db: AsyncIOMotorDatabase,
    *,
    family_id: str,
    kind: str,
    key: str,
    learner_id: str | None,
    body: dict[str, Any],
    rev: int,
    server_seq: int,
    device_id: str | None,
    deleted: bool = False,
) -> dict[str, Any]:
    doc = {
        "familyId": family_id,
        "kind": kind,
        "key": key,
        "learnerId": learner_id,
        "body": {} if deleted else body,
        "rev": rev,
        "serverSeq": server_seq,
        "updatedAt": now(),
        "updatedBy": device_id,
        # A tombstone, not a removal: a delete has to reach the other devices,
        # and a row that is simply gone cannot.
        "deletedAt": now() if deleted else None,
    }
    await db.docs.replace_one({"familyId": family_id, "kind": kind, "key": key}, doc, upsert=True)
    return doc


async def since(
    db: AsyncIOMotorDatabase,
    family_id: str,
    cursor: int,
    limit: int,
    kinds: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Changes after `cursor`, oldest first.

    `kinds` exists because art bodies are thousands of times bigger than a
    settings blob: a device fetching a toggle should not drag the picture
    library with it. Everything shares one cursor either way, so asking for a
    subset never loses a change — it arrives on the next unfiltered pull.
    """
    query: dict[str, Any] = {"familyId": family_id, "serverSeq": {"$gt": cursor}}
    if kinds:
        query["kind"] = {"$in": kinds}
    rows = db.docs.find(query).sort("serverSeq", 1)
    return await rows.to_list(length=limit)
