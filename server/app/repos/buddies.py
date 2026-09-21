"""Invitations and accepted buddy relationships, without public identities.

Names, avatars and scores do not live here. A relationship says only that two
learners deliberately connected; the privacy store separately decides whether
either learner publishes a nickname to that accepted buddy.
"""

import hashlib
from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from app.models.common import now


def pair_id(first_learner_id: str, second_learner_id: str) -> str:
    pair = ":".join(sorted((first_learner_id, second_learner_id)))
    return "bud_" + hashlib.sha256(pair.encode()).hexdigest()[:24]


async def create_invite(
    db: AsyncIOMotorDatabase,
    *,
    code_hash: str,
    learner_id: str,
    family_id: str,
    created_by: str,
    expires_at,
) -> dict[str, Any]:
    # One live code at a time. Generating a replacement invalidates the one a
    # screenshot or shoulder-surfer may still hold.
    await db.buddy_invites.delete_many(
        {"learnerId": learner_id, "acceptedAt": None, "expiresAt": {"$gt": now()}}
    )
    row = {
        "_id": f"binv_{uuid4().hex[:20]}",
        "codeHash": code_hash,
        "learnerId": learner_id,
        "familyId": family_id,
        "createdBy": created_by,
        "createdAt": now(),
        "expiresAt": expires_at,
        "acceptedAt": None,
        "acceptedBy": None,
    }
    await db.buddy_invites.insert_one(row)
    return row


async def active_invites(
    db: AsyncIOMotorDatabase, family_id: str, learner_id: str, at
) -> list[dict[str, Any]]:
    return await db.buddy_invites.find(
        {
            "familyId": family_id,
            "learnerId": learner_id,
            "acceptedAt": None,
            "expiresAt": {"$gt": at},
        },
        {"codeHash": 0},
    ).sort("createdAt", -1).to_list(length=10)


async def revoke_invite(
    db: AsyncIOMotorDatabase, invite_id: str, family_id: str, learner_id: str
) -> bool:
    result = await db.buddy_invites.delete_one(
        {"_id": invite_id, "familyId": family_id, "learnerId": learner_id}
    )
    return result.deleted_count == 1


async def claim_invite(
    db: AsyncIOMotorDatabase, code_hash: str, accepted_by: str, at
) -> dict[str, Any] | None:
    return await db.buddy_invites.find_one_and_update(
        {"codeHash": code_hash, "acceptedAt": None, "expiresAt": {"$gt": at}},
        {"$set": {"acceptedAt": at, "acceptedBy": accepted_by}},
        return_document=ReturnDocument.BEFORE,
    )


async def relationship(
    db: AsyncIOMotorDatabase, first_learner_id: str, second_learner_id: str
) -> dict[str, Any] | None:
    return await db.buddy_relationships.find_one(
        {"_id": pair_id(first_learner_id, second_learner_id)}
    )


async def accept(
    db: AsyncIOMotorDatabase,
    *,
    first: dict[str, str],
    second: dict[str, str],
    invite_id: str,
) -> dict[str, Any] | None:
    """Create/reconnect a pair; return ``None`` when either side blocked it."""
    relationship_id = pair_id(first["learnerId"], second["learnerId"])
    existing = await db.buddy_relationships.find_one({"_id": relationship_id})
    if existing and existing.get("blockedBy"):
        return None
    at = now()
    participants = sorted((first, second), key=lambda row: row["learnerId"])
    try:
        return await db.buddy_relationships.find_one_and_update(
            {
                "_id": relationship_id,
                "$or": [{"blockedBy": []}, {"blockedBy": {"$exists": False}}],
            },
            {
                "$set": {
                    "participants": participants,
                    "status": "accepted",
                    "acceptedAt": at,
                    "inviteId": invite_id,
                    "updatedAt": at,
                    "blockedBy": [],
                },
                "$setOnInsert": {"createdAt": at},
                "$unset": {"removedAt": "", "removedBy": "", "blockedAt": ""},
            },
            upsert=existing is None,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        # Two valid invitations for the same pair may be accepted at once. The
        # unique pair id decides the winner; both callers receive the one safe
        # relationship rather than one becoming a 500.
        return await db.buddy_relationships.find_one(
            {"_id": relationship_id, "status": "accepted", "blockedBy": []}
        )


async def accepted_for(
    db: AsyncIOMotorDatabase, learner_id: str
) -> list[dict[str, Any]]:
    return await db.buddy_relationships.find(
        {
            "status": "accepted",
            "blockedBy": [],
            "participants.learnerId": learner_id,
        }
    ).sort("acceptedAt", 1).to_list(length=100)


async def for_participant(
    db: AsyncIOMotorDatabase, relationship_id: str, learner_id: str
) -> dict[str, Any] | None:
    return await db.buddy_relationships.find_one(
        {"_id": relationship_id, "participants.learnerId": learner_id}
    )


async def remove_relationship(
    db: AsyncIOMotorDatabase, relationship_id: str, learner_id: str
) -> bool:
    at = now()
    result = await db.buddy_relationships.update_one(
        {
            "_id": relationship_id,
            "participants.learnerId": learner_id,
            "status": "accepted",
        },
        {
            "$set": {
                "status": "removed",
                "removedAt": at,
                "removedBy": learner_id,
                "updatedAt": at,
            }
        },
    )
    return result.modified_count == 1


async def block(
    db: AsyncIOMotorDatabase, relationship_id: str, learner_id: str
) -> bool:
    at = now()
    result = await db.buddy_relationships.update_one(
        {"_id": relationship_id, "participants.learnerId": learner_id},
        {
            "$addToSet": {"blockedBy": learner_id},
            "$set": {"status": "blocked", "blockedAt": at, "updatedAt": at},
        },
    )
    return result.matched_count == 1


async def unblock(
    db: AsyncIOMotorDatabase, relationship_id: str, learner_id: str
) -> bool:
    row = await for_participant(db, relationship_id, learner_id)
    if not row or learner_id not in (row.get("blockedBy") or []):
        return False
    at = now()
    remaining = [item for item in row.get("blockedBy", []) if item != learner_id]
    await db.buddy_relationships.update_one(
        {"_id": relationship_id, "participants.learnerId": learner_id},
        {
            "$set": {
                "blockedBy": remaining,
                # Unblocking never silently reconnects anybody. A fresh code is
                # the next mutual decision.
                "status": "blocked" if remaining else "removed",
                "updatedAt": at,
            }
        },
    )
    return True


async def remove_learner(db: AsyncIOMotorDatabase, learner_id: str) -> None:
    await db.buddy_invites.delete_many({"learnerId": learner_id})
    await db.buddy_relationships.delete_many({"participants.learnerId": learner_id})
