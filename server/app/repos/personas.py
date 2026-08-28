"""The character roster: who Koda can be.

One row per persona in `DEFAULT_PERSONAS`, seeded create-if-absent so an
operator's reworded teacher survives every deploy — the same bargain the plan
catalogue and the menu make.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo import ReturnDocument

from app.models.common import now
from app.persona_defaults import EDITABLE_PERSONA_FIELDS


async def seed_default(db: AsyncIOMotorDatabase, persona: dict[str, Any]) -> bool:
    """Create a shipped character if it is absent. Never overwrites an edit."""
    result = await db.personas.update_one(
        {"_id": persona["personaId"]},
        {"$setOnInsert": {**persona, "createdAt": now(), "updatedAt": now()}},
        upsert=True,
    )
    return result.upserted_id is not None


async def listing(db: AsyncIOMotorDatabase, *, only_enabled: bool = False) -> list[dict[str, Any]]:
    """Every character, or only the ones a child may actually be given.

    The filter is the difference between the two audiences: an operator edits
    the whole roster including the retired ones, while a family may only choose
    from what is switched on.
    """
    selector: dict[str, Any] = {"enabled": True} if only_enabled else {}
    return await db.personas.find(selector).sort("order", 1).to_list(length=100)


async def by_id(db: AsyncIOMotorDatabase, persona_id: str) -> dict[str, Any] | None:
    return await db.personas.find_one({"_id": persona_id})


async def update(
    db: AsyncIOMotorDatabase, persona_id: str, patch: dict[str, Any]
) -> dict[str, Any] | None:
    """Reword a character. Anything outside `EDITABLE_PERSONA_FIELDS` is ignored."""
    known = {key: value for key, value in patch.items() if key in EDITABLE_PERSONA_FIELDS}
    if not known:
        return await by_id(db, persona_id)
    return await db.personas.find_one_and_update(
        {"_id": persona_id},
        {"$set": {**known, "updatedAt": now()}},
        return_document=ReturnDocument.AFTER,
    )


async def remove(db: AsyncIOMotorDatabase, persona_id: str) -> bool:
    """Delete one outright.

    Allowed because a child pointing at a character that no longer exists falls
    back to the default rather than breaking — the same way a lapsed plan falls
    back to free. Retiring with `enabled: false` is the gentler move and is what
    the screen offers first.
    """
    result = await db.personas.delete_one({"_id": persona_id})
    return result.deleted_count > 0
