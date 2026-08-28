"""The reward rules, for every family on the deployment.

Scoring, the streak rule and the badges used to be family documents, synced
through the same store as a child's progress. They are not: one operator decides
what a star is worth and what a badge takes, and every family lives with the
answer — the same shape as the switchboard, not the same shape as a preference.

One row per kind, holding the whole config blob. The blob is the client's own
shape and this file never looks inside it, exactly as the sync store never did:
the rules for what a valid scoring config is live in `scoring.ts`, where they
are also enforced on read, and duplicating them here would give two answers.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now

#: The kinds this collection holds. A closed list for the same reason
#: `DOC_KINDS` is one: a typo in a client should not create a row nothing reads.
DEFAULT_KINDS = ("scoring", "streak", "badges")


async def all_defaults(db: AsyncIOMotorDatabase) -> dict[str, Any]:
    """Every rule, as `{kind: body}`. Absent kinds are simply missing, and the
    client falls back to what it ships with — which is what a fresh deployment
    wants anyway."""
    rows = await db.defaults.find({}).to_list(length=len(DEFAULT_KINDS))
    return {row["_id"]: row.get("value", {}) for row in rows}


async def put(
    db: AsyncIOMotorDatabase, kind: str, value: dict[str, Any], actor_id: str
) -> dict[str, Any]:
    row = await db.defaults.find_one_and_update(
        {"_id": kind},
        {"$set": {"value": value, "updatedAt": now(), "updatedBy": actor_id}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    return row.get("value", {})


async def adopt_family_rules(db: AsyncIOMotorDatabase) -> int:
    """Carry a family's tuned rules over the first time this runs.

    These lived in `docs` until they became deployment-wide, and a deployment
    that had already priced a round at 40 XP should not silently drop back to 20
    because the storage moved. Runs once per kind — a row that exists is never
    overwritten — and takes the most recently edited family's copy, because with
    several answers to a question that now has one, the newest is the only
    defensible choice.
    """
    adopted = 0
    for kind in DEFAULT_KINDS:
        if await db.defaults.find_one({"_id": kind}):
            continue
        row = await db.docs.find_one(
            {"kind": kind, "deletedAt": None}, sort=[("updatedAt", -1)]
        )
        if not row or not row.get("body"):
            continue
        await db.defaults.update_one(
            {"_id": kind},
            {
                "$set": {
                    "value": row["body"],
                    "updatedAt": now(),
                    "updatedBy": "migration",
                }
            },
            upsert=True,
        )
        adopted += 1
    return adopted
