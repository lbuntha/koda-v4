"""What a person was told, kept so they can read it later.

A push notification is *ephemeral*: it lives on a lock screen until somebody
swipes it away, and then there is no trace of it anywhere. That is fine for a
courtesy — a missed "goal met" costs nothing — and wrong for the reason the
account kinds exist. "A new device signed in" is a security notice, and a
security notice nobody can go back and check is not much of one.

So the row is written first and the send comes after. This collection is the
durable half of the feature and FCM is the best-effort half, which is also why
a person with no browser registered still accumulates a history: the fact
happened, and the app is where they read it.

One row per *person*, not per browser. Somebody with a phone and a laptop was
told once.
"""

from datetime import timedelta
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from app.models.common import now

#: How long a notification is kept. Long enough that "did I get told about
#: that?" has an answer, short enough that the collection is not a second
#: learning log.
KEEP_DAYS = 90


async def record(
    db: AsyncIOMotorDatabase,
    *,
    user_id: str,
    family_id: str | None,
    kind: str,
    title: str,
    body: str,
    path: str = "/",
) -> dict[str, Any]:
    doc = {
        "_id": f"n_{uuid4().hex[:20]}",
        "userId": user_id,
        "familyId": family_id,
        "kind": kind,
        "title": title,
        "body": body,
        "path": path,
        "createdAt": now(),
        "readAt": None,
    }
    await db.notifications.insert_one(doc)
    return doc


async def for_user(
    db: AsyncIOMotorDatabase, user_id: str, *, limit: int = 30
) -> list[dict[str, Any]]:
    """Newest first, which is the only order this list is ever read in."""
    return await (
        db.notifications.find({"userId": user_id})
        .sort("createdAt", DESCENDING)
        .limit(limit)
        .to_list(length=limit)
    )


async def unread_count(db: AsyncIOMotorDatabase, user_id: str) -> int:
    return await db.notifications.count_documents({"userId": user_id, "readAt": None})


async def mark_read(db: AsyncIOMotorDatabase, user_id: str, notification_id: str | None = None) -> int:
    """Mark one as read, or all of them.

    Opening the list marks everything: a badge that survives being looked at is
    a badge people stop looking at.
    """
    mongo_filter: dict[str, Any] = {"userId": user_id, "readAt": None}
    if notification_id:
        mongo_filter["_id"] = notification_id
    result = await db.notifications.update_many(mongo_filter, {"$set": {"readAt": now()}})
    return result.modified_count


async def sweep(db: AsyncIOMotorDatabase) -> int:
    result = await db.notifications.delete_many(
        {"createdAt": {"$lt": now() - timedelta(days=KEEP_DAYS)}}
    )
    return result.deleted_count
