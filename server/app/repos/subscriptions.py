"""What a family is subscribed to, one row per family.

No row means the free plan — a family that has never subscribed should not need
a record to exist before they can use the app, and a deployment should not have
to backfill one for every family that ever signed up.

A row is a *grant with an end date*. Nothing here renews anything: when
`currentPeriodEnd` passes, the entitlement service stops honouring it and the
family is back on free. That is what makes the model safe without a payment
processor attached — an unpaid month lapses by doing nothing at all.
"""

from datetime import datetime
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now


async def for_family(db: AsyncIOMotorDatabase, family_id: str) -> dict[str, Any] | None:
    return await db.subscriptions.find_one({"_id": family_id})


async def set_plan(
    db: AsyncIOMotorDatabase,
    family_id: str,
    *,
    plan_id: str,
    status: str,
    current_period_end: datetime | None,
    actor_id: str,
    note: str | None = None,
) -> dict[str, Any]:
    """Put a family on a plan until a date. The one write this collection has."""
    return await db.subscriptions.find_one_and_update(
        {"_id": family_id},
        {
            "$set": {
                "planId": plan_id,
                "status": status,
                "currentPeriodEnd": current_period_end,
                "note": note,
                # Who granted it. A subscription somebody cannot account for is
                # worse than none, and this is the only record of that.
                "updatedBy": actor_id,
                "updatedAt": now(),
                # The seam for a card processor: a row this service granted says
                # so, and a row Stripe granted will say that instead.
                "source": "manual",
            },
            "$setOnInsert": {"createdAt": now()},
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )


async def listing(
    db: AsyncIOMotorDatabase, family_ids: list[str]
) -> dict[str, dict[str, Any]]:
    """Subscriptions for a page of families, keyed by family id."""
    rows = await db.subscriptions.find({"_id": {"$in": family_ids}}).to_list(length=len(family_ids) or 1)
    return {row["_id"]: row for row in rows}
