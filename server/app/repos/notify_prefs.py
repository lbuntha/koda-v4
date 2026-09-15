"""What one person has chosen to be told about, and on which channel.

A row per person per kind per channel, rather than an object on the user
document, and the reason is not only the one the switchboard gives (two browsers
changing two switches at once should not overwrite each other).

It is also that **a kind id contains a dot**. `learn.goal_met` written into
`{"$set": {"notifyPrefs.learn.goal_met": True}}` is not one key with a dot in
it — Mongo reads the dots as a path and stores `{learn: {goal_met: true}}`,
which then never matches the key anything reads back. The switch appears to
save and silently does nothing. Rows have no such trap: the id is a value, not
a path.

**Push rows keep the id they always had.** Rows written before channels existed
carry no `channel` field and were all push choices, so the push channel reads
both, and nobody's switches moved when email arrived.
"""

from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.models.common import now

PUSH = "push"


def _row_id(user_id: str, kind: str, channel: str = PUSH) -> str:
    return f"{user_id}:{kind}" if channel == PUSH else f"{user_id}:{kind}:{channel}"


def _on_channel(channel: str) -> dict[str, Any]:
    if channel == PUSH:
        return {"$or": [{"channel": PUSH}, {"channel": {"$exists": False}}]}
    return {"channel": channel}


async def set_pref(
    db: AsyncIOMotorDatabase, user_id: str, kind: str, on: bool, channel: str = PUSH
) -> None:
    await db.notify_prefs.update_one(
        {"_id": _row_id(user_id, kind, channel)},
        {"$set": {"userId": user_id, "kind": kind, "channel": channel, "on": on, "updatedAt": now()}},
        upsert=True,
    )


async def for_user(db: AsyncIOMotorDatabase, user_id: str, channel: str = PUSH) -> dict[str, bool]:
    """One person's answers on one channel. Absent means "whatever the kind ships as"."""
    rows = await db.notify_prefs.find({"$and": [{"userId": user_id}, _on_channel(channel)]}).to_list(
        length=100
    )
    return {row["kind"]: bool(row["on"]) for row in rows}


async def for_users(
    db: AsyncIOMotorDatabase, user_ids: list[str], channel: str = PUSH
) -> dict[str, dict[str, bool]]:
    """Answers for everyone a send is about, in one query rather than one each.

    A family notification fans out across several browsers belonging to
    different adults, and each of them gets their own say.
    """
    if not user_ids:
        return {}
    rows = await db.notify_prefs.find(
        {"$and": [{"userId": {"$in": user_ids}}, _on_channel(channel)]}
    ).to_list(length=500)
    prefs: dict[str, dict[str, bool]] = {}
    for row in rows:
        prefs.setdefault(row["userId"], {})[row["kind"]] = bool(row["on"])
    return prefs


async def forget_user(db: AsyncIOMotorDatabase, user_id: str) -> int:
    """Deleting an account takes its choices with it, on every channel."""
    result = await db.notify_prefs.delete_many({"userId": user_id})
    return result.deleted_count


async def all_rows(db: AsyncIOMotorDatabase) -> list[dict[str, Any]]:
    return await db.notify_prefs.find({}).to_list(length=1000)
