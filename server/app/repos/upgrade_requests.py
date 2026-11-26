"""What a family has asked to be moved onto, until somebody acts on it.

One row per family, keyed by family id, because a request is a *want* and not a
queue: a parent who changes their mind replaces what they asked for rather than
leaving an operator two answers to choose between.

Deliberately a separate collection from `subscriptions`. A subscription is what
a family *has* and the entitlement service reads it on every call; a request is
what they would like and nothing is entitled by it. Writing the want onto the
subscription row would put an unpaid wish one typo away from being honoured.

This is the seam a card processor slots into. Today a request is answered by an
operator granting the plan by hand; when checkout exists it is the checkout that
answers it, and the row is created and cleared in exactly the same places.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now


async def for_family(db: AsyncIOMotorDatabase, family_id: str) -> dict[str, Any] | None:
    return await db.upgrade_requests.find_one({"_id": family_id})


async def want(
    db: AsyncIOMotorDatabase,
    family_id: str,
    *,
    plan_id: str,
    actor_id: str,
) -> dict[str, Any]:
    """Record that this family would like that plan, replacing any earlier ask."""
    return await db.upgrade_requests.find_one_and_update(
        {"_id": family_id},
        {
            "$set": {
                "planId": plan_id,
                # Which adult asked. An operator ringing back about a plan
                # should know who to ring, and a family has more than one.
                "requestedBy": actor_id,
                "requestedAt": now(),
            }
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


async def clear(db: AsyncIOMotorDatabase, family_id: str) -> None:
    """Forget the ask — the parent withdrew it, or it has been answered."""
    await db.upgrade_requests.delete_one({"_id": family_id})


async def answer(db: AsyncIOMotorDatabase, family_id: str, plan_id: str) -> dict[str, Any] | None:
    """Take the matching request once, leaving a request for a different plan alone."""
    return await db.upgrade_requests.find_one_and_delete({"_id": family_id, "planId": plan_id})


async def pending_page(
    db: AsyncIOMotorDatabase,
    *,
    pattern: dict[str, str] | None,
    offset: int,
    limit: int,
) -> list[dict[str, Any]]:
    """Oldest requests first, with search applied before pagination."""
    pipeline: list[dict[str, Any]] = [
        {"$sort": {"requestedAt": 1, "_id": 1}},
        {"$lookup": {"from": "families", "localField": "_id", "foreignField": "_id", "as": "family"}},
        {"$unwind": "$family"},
    ]
    if pattern:
        pipeline.extend([
            {"$lookup": {"from": "users", "localField": "requestedBy", "foreignField": "_id", "as": "requester"}},
            {"$lookup": {"from": "users", "localField": "family.ownerId", "foreignField": "_id", "as": "owner"}},
            {"$match": {"$or": [
                {"family.name": pattern},
                {"requester.email": pattern},
                {"requester.displayName": pattern},
                {"owner.email": pattern},
                {"owner.displayName": pattern},
            ]}},
        ])
    pipeline.extend([
        {"$skip": offset},
        {"$limit": limit},
        {"$project": {"family": 1, "planId": 1, "requestedAt": 1, "requestedBy": 1}},
    ])
    return await db.upgrade_requests.aggregate(pipeline).to_list(length=limit)


async def listing(
    db: AsyncIOMotorDatabase, family_ids: list[str]
) -> dict[str, dict[str, Any]]:
    """Requests for a page of families, keyed by family id.

    One query for the page rather than one per row: the operator's list is fifty
    families wide and a lookup inside that loop is fifty round trips.
    """
    if not family_ids:
        return {}
    rows = await db.upgrade_requests.find({"_id": {"$in": family_ids}}).to_list(
        length=len(family_ids)
    )
    return {row["_id"]: row for row in rows}
