"""Devices, and the refresh tokens attached to them.

The token itself is never stored — only its SHA-256 — so a leaked database
cannot be replayed as a session. Rotation replaces the hash in place, which is
also how "sign out that tablet" works: clear the hash and the token is dead.
"""

from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


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


async def revoke(db: AsyncIOMotorDatabase, device_id: str) -> None:
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
    result = await db.devices.update_many(
        mongo_filter,
        {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}},
    )
    return result.modified_count


async def for_family(db: AsyncIOMotorDatabase, family_id: str) -> list[dict[str, Any]]:
    cursor = db.devices.find({"familyId": family_id}, {"refreshHash": 0})
    return await cursor.to_list(length=100)


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
    result = await db.devices.update_many(
        {"userId": user_id, "familyId": family_id, "revokedAt": None},
        {"$set": {"revokedAt": now()}, "$unset": {"refreshHash": ""}},
    )
    return result.modified_count
