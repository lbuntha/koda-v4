from typing import Any
from uuid import uuid4

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


async def create(db: AsyncIOMotorDatabase, name: str, owner_id: str) -> dict[str, Any]:
    doc = {"_id": f"f_{uuid4().hex[:20]}", "name": name, "ownerId": owner_id, "createdAt": now()}
    await db.families.insert_one(doc)
    return doc


async def by_id(db: AsyncIOMotorDatabase, family_id: str) -> dict[str, Any] | None:
    return await db.families.find_one({"_id": family_id})


async def set_pin(db: AsyncIOMotorDatabase, family_id: str, pin_hash: str) -> bool:
    """Store the family's PIN, hashed the way a password is.

    Hashed rather than compared in the clear for the ordinary reason, even
    though the secret is four digits and the threat is a seven-year-old: a
    database that leaks should not hand out anything directly reusable, and
    there is no version of "it is only a PIN" that makes plaintext right.
    """
    result = await db.families.update_one(
        {"_id": family_id}, {"$set": {"pinHash": pin_hash, "pinSetAt": now()}}
    )
    return result.matched_count > 0


async def clear_pin(db: AsyncIOMotorDatabase, family_id: str) -> bool:
    result = await db.families.update_one(
        {"_id": family_id}, {"$unset": {"pinHash": "", "pinSetAt": ""}}
    )
    return result.matched_count > 0


async def pin_hash_of(db: AsyncIOMotorDatabase, family_id: str) -> str | None:
    row = await db.families.find_one({"_id": family_id}, {"pinHash": 1})
    return (row or {}).get("pinHash")


async def rename(db: AsyncIOMotorDatabase, family_id: str, name: str) -> dict[str, Any] | None:
    await db.families.update_one({"_id": family_id}, {"$set": {"name": name.strip()}})
    return await by_id(db, family_id)
