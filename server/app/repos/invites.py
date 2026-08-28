"""Invitations for a second adult, as codes rather than links.

A code and not an emailed link, for three reasons. It does not depend on the
mail transport, so it worked before that existed and still works if it breaks.
It reuses the join-code shape already trusted for pairing a child's tablet. And
it fits the case this is actually for: two parents standing in the same kitchen,
one reading eight characters to the other.

Like a join code, only the hash is stored. A leaked database hands nobody a way
into a family.
"""

from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def create(
    db: AsyncIOMotorDatabase,
    *,
    family_id: str,
    code_hash: str,
    role: str,
    created_by: str,
    expires_at,
) -> dict[str, Any]:
    doc = {
        "_id": f"inv_{uuid4().hex[:20]}",
        "familyId": family_id,
        "codeHash": code_hash,
        # Baked in at creation, so accepting an invite cannot be a negotiation
        # about what it was for. A caregiver invite makes a caregiver.
        "role": role,
        "createdBy": created_by,
        "createdAt": now(),
        "expiresAt": expires_at,
        "redeemedAt": None,
        "redeemedBy": None,
    }
    await db.invites.insert_one(doc)
    return doc


async def claim(db: AsyncIOMotorDatabase, code_hash: str, at, user_id: str) -> dict[str, Any] | None:
    """Spend a live invite, atomically.

    `find_one_and_update` rather than read-then-write: two people racing the same
    code must not both end up in the family, and the filter is what decides the
    winner.
    """
    return await db.invites.find_one_and_update(
        {"codeHash": code_hash, "redeemedAt": None, "expiresAt": {"$gt": at}},
        {"$set": {"redeemedAt": now(), "redeemedBy": user_id}},
    )


async def outstanding(db: AsyncIOMotorDatabase, family_id: str, at) -> list[dict[str, Any]]:
    """Invites still worth showing: unspent and unexpired."""
    cursor = db.invites.find(
        {"familyId": family_id, "redeemedAt": None, "expiresAt": {"$gt": at}},
        {"codeHash": 0},
    ).sort("createdAt", -1)
    return await cursor.to_list(length=50)


async def revoke(db: AsyncIOMotorDatabase, invite_id: str, family_id: str) -> bool:
    """Withdraw one. Tenancy is in the filter, so another family's id is simply
    not found rather than refused."""
    result = await db.invites.delete_one({"_id": invite_id, "familyId": family_id})
    return result.deleted_count > 0
