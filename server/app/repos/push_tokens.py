"""The browsers a family has agreed to be rung on.

Deliberately *not* a field on `devices`, though every row points at one. A
refresh token and an FCM registration token look alike and are not: the refresh
token is stored only as a hash, because holding it is being signed in, while
this one has to be kept in the clear — sending is handing it back to Google —
and grants no read access to anything. It is a capability to ring one browser.
Different rule, different lifetime, so: different collection.

What they do share is death. A token outlives nothing: `devices.revoke` and its
neighbours delete the rows for the sessions they end, because a tablet somebody
signed out and then kept hearing from is the bug this arrangement exists to
prevent.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now

#: Consecutive soft failures before a row is retired. Three, because the failure
#: it is counting is "FCM had a bad afternoon", and throwing a parent's
#: notifications away over a fault that was never theirs is the worse mistake.
FAILURE_LIMIT = 3

#: FCM stops honouring a token nobody has refreshed in this long, so a row older
#: than that is already dead; the sweep is only tidying up after it.
STALE_DAYS = 270


def stale_before() -> datetime:
    return now() - timedelta(days=STALE_DAYS)


async def save(
    db: AsyncIOMotorDatabase,
    *,
    token: str,
    family_id: str,
    user_id: str,
    device_id: str | None,
    install_id: str | None = None,
    ua: str | None = None,
    platform: str | None = None,
) -> dict[str, Any]:
    """Record a token, or re-point the one that already exists.

    Upsert rather than insert, because the client re-registers on every launch:
    FCM rotates a token on its own schedule, and a device that only ever
    registered once goes quiet after a rotation without anybody finding out. The
    common case is therefore "the same token, again", which must be one row.

    A token that turns up under a *different* account is re-pointed rather than
    duplicated — one phone that two parents sign into holds one subscription,
    and the browser only ever hands out the one token.
    """
    stamp = now()
    await db.push_tokens.update_one(
        {"token": token},
        {
            "$setOnInsert": {"_id": f"pt_{uuid4().hex[:20]}", "createdAt": stamp},
            "$set": {
                "token": token,
                "familyId": family_id,
                "userId": user_id,
                "deviceId": device_id,
                "installId": install_id,
                "ua": ua,
                "platform": platform,
                "refreshedAt": stamp,
                # Re-registering is the browser saying the subscription is good,
                # so it clears whatever the last bad afternoon left behind.
                "failures": 0,
                "disabledAt": None,
            },
        },
        upsert=True,
    )
    return await db.push_tokens.find_one({"token": token})


async def live_for_family(
    db: AsyncIOMotorDatabase,
    family_id: str,
    *,
    user_id: str | None = None,
    exclude_device_id: str | None = None,
) -> list[dict[str, Any]]:
    """Everything still worth sending to, inside one family.

    `exclude_device_id` is how a notification avoids the device that caused it:
    telling the phone in your hand that a new device just signed in is telling
    somebody something they are in the middle of doing.
    """
    mongo_filter: dict[str, Any] = {"familyId": family_id, "disabledAt": None}
    if user_id:
        mongo_filter["userId"] = user_id
    if exclude_device_id:
        mongo_filter["deviceId"] = {"$ne": exclude_device_id}
    return await db.push_tokens.find(mongo_filter).to_list(length=200)


async def delete(db: AsyncIOMotorDatabase, token: str) -> bool:
    """Forget a token. Used both by a sign-out and by FCM telling us it is dead."""
    result = await db.push_tokens.delete_one({"token": token})
    return result.deleted_count > 0


async def delete_for_devices(db: AsyncIOMotorDatabase, device_ids: list[str]) -> int:
    """Every token belonging to sessions that have just ended."""
    if not device_ids:
        return 0
    result = await db.push_tokens.delete_many({"deviceId": {"$in": device_ids}})
    return result.deleted_count


async def delete_for_user(db: AsyncIOMotorDatabase, user_id: str) -> int:
    result = await db.push_tokens.delete_many({"userId": user_id})
    return result.deleted_count


async def note_failure(db: AsyncIOMotorDatabase, token: str) -> bool:
    """Count one soft failure, and retire the row on the third.

    Retired rather than deleted: this counts the ambiguous failures, where the
    token may be perfectly good and FCM merely unreachable. `disabledAt` keeps
    the row long enough to answer "why did my phone stop?" before the sweep
    collects it. Returns whether this failure retired it.
    """
    row = await db.push_tokens.find_one_and_update(
        {"token": token},
        {"$inc": {"failures": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not row or row.get("failures", 0) < FAILURE_LIMIT:
        return False
    await db.push_tokens.update_one({"token": token}, {"$set": {"disabledAt": now()}})
    return True


async def sweep(db: AsyncIOMotorDatabase) -> int:
    """The nightly tidy: rows FCM has already stopped honouring, and long-retired ones."""
    result = await db.push_tokens.delete_many(
        {
            "$or": [
                {"refreshedAt": {"$lt": stale_before()}},
                {"disabledAt": {"$lt": now() - timedelta(days=30)}},
            ]
        }
    )
    return result.deleted_count
