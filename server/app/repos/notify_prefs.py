"""What one person has chosen to be told about.

A row per person per kind, rather than an object on the user document, and the
reason is not only the one the switchboard gives (two browsers changing two
switches at once should not overwrite each other).

It is also that **a kind id contains a dot**. `learn.goal_met` written into
`{"$set": {"notifyPrefs.learn.goal_met": True}}` is not one key with a dot in
it — Mongo reads the dots as a path and stores `{learn: {goal_met: true}}`,
which then never matches the key anything reads back. The switch appears to
save and silently does nothing. Rows have no such trap: the id is a value, not
a path.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now


def _row_id(user_id: str, kind: str) -> str:
    return f"{user_id}:{kind}"


async def set_pref(db: AsyncIOMotorDatabase, user_id: str, kind: str, on: bool) -> None:
    await db.notify_prefs.update_one(
        {"_id": _row_id(user_id, kind)},
        {"$set": {"userId": user_id, "kind": kind, "on": on, "updatedAt": now()}},
        upsert=True,
    )


async def for_user(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, bool]:
    """One person's answers. Absent means "whatever the kind ships as"."""
    rows = await db.notify_prefs.find({"userId": user_id}).to_list(length=100)
    return {row["kind"]: bool(row["on"]) for row in rows}


async def for_users(db: AsyncIOMotorDatabase, user_ids: list[str]) -> dict[str, dict[str, bool]]:
    """Answers for everyone a send is about, in one query rather than one each.

    A family notification fans out across several browsers belonging to
    different adults, and each of them gets their own say.
    """
    if not user_ids:
        return {}
    rows = await db.notify_prefs.find({"userId": {"$in": user_ids}}).to_list(length=500)
    prefs: dict[str, dict[str, bool]] = {}
    for row in rows:
        prefs.setdefault(row["userId"], {})[row["kind"]] = bool(row["on"])
    return prefs


async def forget_user(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Deleting an account takes its choices with it."""
    result = await db.notify_prefs.delete_many({"userId": user_id})
    return result.deleted_count


async def all_rows(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    return await db.notify_prefs.find({}).to_list(length=1000)
