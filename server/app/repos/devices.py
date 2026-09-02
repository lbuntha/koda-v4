"""Devices, and the refresh tokens attached to them.

The token itself is never stored — only its SHA-256 — so a leaked database
cannot be replayed as a session. Rotation replaces the hash in place, which is
also how "sign out that tablet" works: clear the hash and the token is dead.
"""

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import DESCENDING

from app.models.common import now
from app.repos import push_tokens
from app.settings import settings


def stale_before() -> datetime:
    """The moment a session stops counting as live.

    A refresh rotates `lastSeenAt`, so a row untouched for longer than the
    refresh token's own lifetime is one nothing can present any more. That is
    what makes it safe for the device list to stop showing it: the row is not
    being hidden, it is being retired.
    """
    return now() - timedelta(days=settings().refresh_ttl_days)


async def register(
    db: AsyncIOMotorDatabase,
    family_id: str,
    name: str,
    kind: str,
    refresh_hash: str,
    user_id: str | None = None,
    learner_id: str | None = None,
    install_id: str | None = None,
) -> dict[str, Any]:
    doc = {
        "_id": f"d_{uuid4().hex[:20]}",
        "familyId": family_id,
        "name": name,
        "kind": kind,
        "userId": user_id,
        "learnerId": learner_id,
        "installId": install_id,
        "refreshHash": refresh_hash,
        "createdAt": now(),
        "lastSeenAt": now(),
        "revokedAt": None,
    }
    await db.devices.insert_one(doc)
    return doc


async def live_install(
    db: AsyncIOMotorDatabase,
    install_id: str,
    *,
    user_id: str | None = None,
    learner_id: str | None = None,
) -> dict[str, Any] | None:
    """The row this install already has, if any.

    Scoped to the account as well as the install: one family tablet that two
    people sign into is two sessions, and folding them into one row would let
    revoking a parent's session take the child's with it.
    """
    mongo_filter: dict[str, Any] = {"installId": install_id, "revokedAt": None}
    mongo_filter["userId"] = user_id
    mongo_filter["learnerId"] = learner_id
    return await db.devices.find_one(mongo_filter)


async def by_refresh_hash(db: AsyncIOMotorDatabase, refresh_hash: str) -> dict[str, Any] | None:
    return await db.devices.find_one({"refreshHash": refresh_hash, "revokedAt": None})


async def rotate(db: AsyncIOMotorDatabase, device_id: str, refresh_hash: str) -> None:
    await db.devices.update_one(
        {"_id": device_id},
        {"$set": {"refreshHash": refresh_hash, "lastSeenAt": now()}},
    )


async def _forget_push(db: AsyncIOMotorDatabase, mongo_filter: dict[str, Any]) -> None:
    """Drop the notification tokens belonging to sessions that are about to end.

    Called by every path that revokes, and the reason `push_tokens` rows carry a
    `deviceId` at all. A tablet somebody signed out of and then kept hearing
    from is the bug this prevents — and the only way to not have it is for the
    token to die with the row it belongs to, rather than in a sweep somebody has
    to remember to write.

    Read before the revoke, because after it the filter no longer matches.
    """
    ids = [row["_id"] for row in await db.devices.find(mongo_filter, {"_id": 1}).to_list(length=500)]
    await push_tokens.delete_for_devices(db, ids)


async def revoke(db: AsyncIOMotorDatabase, device_id: str) -> None:
    await _forget_push(db, {"_id": device_id})
    # `$unset` rather than a null: the unique index is partial on strings, and
    # an absent field is the honest way to say "this session no longer exists".
    await db.devices.update_one(
        {"_id": device_id}, {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}}
    )


async def revoke_all_for_user(
    db: AsyncIOMotorDatabase, user_id: str, *, except_device_id: str | None = None
) -> int:
    """End every session an account holds — what a password change must do.

    `except_device_id` spares the one making the request. A person changing
    their password deliberately should not be thrown back to the sign-in screen
    for doing it; an *administrator* resetting somebody else's passes nothing,
    and every session goes, which is the point of that gesture.
    """
    mongo_filter: dict[str, Any] = {"userId": user_id, "revokedAt": None}
    if except_device_id:
        mongo_filter["_id"] = {"$ne": except_device_id}
    await _forget_push(db, mongo_filter)
    result = await db.devices.update_many(
        mongo_filter,
        {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}},
    )
    return result.modified_count


async def for_family(
    db: AsyncIOMotorDatabase, family_id: str, *, page: int = 1, page_size: int = 10
) -> tuple[list[dict[str, Any]], int]:
    """One page of a family's live sessions, and how many there are in all.

    Most recently used first, because that is the order the list is read in:
    the machine in your hand is at the top, and the tablet that has not been
    touched in a month is the one you are looking for when you came here to
    sign something out.

    Revoked rows never appear. They are history, and a list that carries its
    own history is the list this page started as — mostly dead entries with the
    live one buried among them.
    """
    mongo_filter = {"familyId": family_id, "revokedAt": None}
    total = await db.devices.count_documents(mongo_filter)
    cursor = (
        db.devices.find(mongo_filter, {"refreshHash": 0})
        .sort("lastSeenAt", DESCENDING)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    return await cursor.to_list(length=page_size), total


async def expire_stale(db: AsyncIOMotorDatabase, family_id: str) -> int:
    """Retire the family's rows that have aged past the refresh lifetime.

    Swept when the list is read rather than on a timer: this is the moment the
    count has to be true, and a family's device list is small enough that the
    sweep costs one indexed update. The rows are revoked rather than deleted,
    so `revokedAt` still answers "when did this stop being a session?".
    """
    await _forget_push(db, {"familyId": family_id, "revokedAt": None, "lastSeenAt": {"$lt": stale_before()}})
    result = await db.devices.update_many(
        {"familyId": family_id, "revokedAt": None, "lastSeenAt": {"$lt": stale_before()}},
        {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}},
    )
    return result.modified_count


async def revoke_others_in_family(
    db: AsyncIOMotorDatabase, family_id: str, except_device_id: str
) -> int:
    """Sign out everything in this family but the device asking.

    The gesture for a list that has got away from somebody — a lost tablet
    among twenty rows they no longer recognise. Sparing the caller is the whole
    point: signing yourself out along with the rest would leave a parent at the
    sign-in screen with no way to see whether it worked.
    """
    await _forget_push(db, {"familyId": family_id, "revokedAt": None, "_id": {"$ne": except_device_id}})
    result = await db.devices.update_many(
        {"familyId": family_id, "revokedAt": None, "_id": {"$ne": except_device_id}},
        {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}},
    )
    return result.modified_count


async def reassign_family(db: AsyncIOMotorDatabase, user_id: str, family_id: str) -> int:
    """Move an adult's live sessions to a family they have just joined.

    A refresh reads the family off the *device* row, so without this a person
    who accepted an invite would keep being handed tokens for the family they
    left until every device signed in again.

    Only their own user sessions: a child device belongs to a learner, and
    learners do not move.
    """
    result = await db.devices.update_many(
        {"userId": user_id, "revokedAt": None},
        {"$set": {"familyId": family_id}},
    )
    return result.modified_count


async def revoke_for_user_in_family(
    db: AsyncIOMotorDatabase, user_id: str, family_id: str
) -> int:
    """End the sessions somebody holds *in one family* — what removing a member
    has to do, without touching sessions they hold elsewhere."""
    await _forget_push(db, {"userId": user_id, "familyId": family_id, "revokedAt": None})
    result = await db.devices.update_many(
        {"userId": user_id, "familyId": family_id, "revokedAt": None},
        {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}},
    )
    return result.modified_count
